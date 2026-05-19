import { getStockSummaries } from "@/lib/data-source/prices";
import {
  filterScannerGroupsByQuality,
  getScannerDiagnostics,
  getScannerGroups,
  type ScannerGroup,
} from "@/lib/scanner/groups";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { Signal } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";
import { refreshSectorHeatmapSnapshot } from "@/lib/sector/heatmap";
import { refreshMarketBreadthSnapshot } from "@/lib/market/breadth";
import { refreshMarketAlertsSnapshot } from "@/lib/alerts/generate-alerts";
import { recordSnapshotHistory } from "@/lib/market/snapshot-history";

export const HOME_SCANNER_SNAPSHOT_TYPE = "home_scanner";

type SnapshotRow = {
  data: Json;
  updated_at?: string | null;
};

export async function refreshHomeScannerSnapshot(): Promise<boolean> {
  try {
    const stocks = await getStockSummaries();
    const groups = getScannerGroups(stocks);
    const diagnostics = getScannerDiagnostics(groups);
    const supabase = createSupabaseAdminClient();
    const [sectorSnapshotUpdated, marketBreadthSnapshotUpdated] = await Promise.all([
      refreshSectorHeatmapSnapshot(stocks),
      refreshMarketBreadthSnapshot(stocks),
    ]);
    const marketAlertsSnapshotUpdated = await refreshMarketAlertsSnapshot(stocks);
    console.info("home_scanner snapshot metadata source:", {
      metadataSource: "supabase-symbols-via-stock-summaries",
      symbolCount: stocks.length,
      scannerDiagnostics: diagnostics,
      sectorSnapshotUpdated,
      marketBreadthSnapshotUpdated,
      marketAlertsSnapshotUpdated,
    });
    const { error } = await supabase.from("market_snapshots").upsert(
      {
        snapshot_type: HOME_SCANNER_SNAPSHOT_TYPE,
        data: groups as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_type" },
    );

    if (error) {
      throw error;
    }

    await recordSnapshotHistory(HOME_SCANNER_SNAPSHOT_TYPE, groups as unknown as Json);

    return true;
  } catch (error) {
    console.warn("Khong cap nhat duoc home_scanner snapshot:", error);
    return false;
  }
}

export async function readHomeScannerSnapshot(currentStocks: StockSummary[] = []): Promise<ScannerGroup[] | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("data,updated_at")
      .eq("snapshot_type", HOME_SCANNER_SNAPSHOT_TYPE)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as SnapshotRow;
    const groups = parseScannerGroups(row.data);

    if (!groups) {
      return null;
    }

    if (currentStocks.length === 0) {
      return filterScannerGroupsByQuality(groups);
    }

    const latestMetadata = await readLatestSymbolMetadata();
    return filterScannerGroupsByQuality(mergeLatestMetadata(groups, currentStocks, latestMetadata, row.updated_at));
  } catch (error) {
    console.warn("Khong doc duoc home_scanner snapshot, fallback runtime scanner:", error);
    return null;
  }
}

function mergeLatestMetadata(
  groups: ScannerGroup[],
  currentStocks: StockSummary[],
  latestMetadata: Map<
    string,
    Pick<
      StockSummary,
      "symbol" | "name" | "exchange" | "sector" | "tier" | "liquidityRank" | "avgVolume20" | "avgTradedValue20"
    >
  >,
  snapshotUpdatedAt?: string | null,
): ScannerGroup[] {
  if (isSnapshotStale(snapshotUpdatedAt)) {
    console.warn("home_scanner snapshot co the da cu, van merge metadata moi nhat truoc khi render:", {
      snapshotUpdatedAt,
    });
  }

  const latestBySymbol = new Map(currentStocks.map((stock) => [stock.symbol, stock]));

  for (const [symbol, metadata] of latestMetadata) {
    if (!latestBySymbol.has(symbol)) {
      latestBySymbol.set(symbol, metadata as StockSummary);
    }
  }

  if (latestBySymbol.size === 0) {
    return groups;
  }
  const mismatches: Array<{ symbol: string; snapshotExchange: string; latestExchange: string }> = [];
  const mergedGroups = groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const latest = latestBySymbol.get(item.stock.symbol);

      if (!latest) {
        return item;
      }

      if (item.stock.exchange !== latest.exchange) {
        mismatches.push({
          symbol: item.stock.symbol,
          snapshotExchange: item.stock.exchange,
          latestExchange: latest.exchange,
        });
      }

      return {
        ...item,
        stock: {
          ...item.stock,
          name: latest.name,
          exchange: latest.exchange,
          sector: latest.sector,
          tier: latest.tier,
          liquidityRank: latest.liquidityRank,
          avgVolume20: latest.avgVolume20,
          avgTradedValue20: latest.avgTradedValue20,
        },
      };
    }),
  }));

  if (mismatches.length > 0) {
    console.warn("home_scanner snapshot metadata mismatch, merged latest symbols metadata:", {
      snapshotUpdatedAt,
      mismatchCount: mismatches.length,
      sample: mismatches.slice(0, 10),
    });
  }

  return mergedGroups;
}

async function readLatestSymbolMetadata(): Promise<
  Map<
    string,
    Pick<
      StockSummary,
      "symbol" | "name" | "exchange" | "sector" | "tier" | "liquidityRank" | "avgVolume20" | "avgTradedValue20"
    >
  >
> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,tier,liquidity_rank")
    .eq("is_active", true)
    .order("symbol", { ascending: true })
    .limit(3000);

  if (error || !data) {
    if (error) {
      console.warn("Khong doc duoc symbols metadata de merge home_scanner snapshot:", error);
    }
    return new Map();
  }

  return new Map(
    (data as Array<{
      symbol: string;
      name: string;
      exchange: StockSummary["exchange"];
      sector: string;
      tier: StockSummary["tier"];
      liquidity_rank: number | null;
    }>).map((row) => [
      row.symbol,
      {
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange,
        sector: row.sector,
        tier: row.tier,
        liquidityRank: row.liquidity_rank,
        avgVolume20: undefined,
        avgTradedValue20: undefined,
      },
    ]),
  );
}

function isSnapshotStale(snapshotUpdatedAt?: string | null): boolean {
  if (!snapshotUpdatedAt) {
    return true;
  }

  const updatedAtMs = new Date(snapshotUpdatedAt).getTime();

  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }

  return Date.now() - updatedAtMs > 60 * 60 * 1000;
}

function parseScannerGroups(value: unknown): ScannerGroup[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const groups = value.map(parseScannerGroup).filter((group): group is ScannerGroup => group !== null);
  return groups.length > 0 ? groups : null;
}

function parseScannerGroup(value: unknown): ScannerGroup | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(parseScannerItem).filter((item): item is ScannerGroup["items"][number] => item !== null);

  return {
    id: value.id as ScannerGroup["id"],
    title: value.title,
    items,
  };
}

function parseScannerItem(value: unknown): ScannerGroup["items"][number] | null {
  if (!isRecord(value) || !isRecord(value.stock)) {
    return null;
  }

  const stock = parseStockSummary(value.stock);

  if (!stock) {
    return null;
  }

  return {
    stock,
    signal: parseSignal(value.signal),
    sortSignalPriority: toNumber(value.sortSignalPriority),
    sortVolumeSpike: toNumber(value.sortVolumeSpike),
    sortLiquidity: toNumber(value.sortLiquidity),
  };
}

function parseStockSummary(value: Record<string, unknown>): StockSummary | null {
  if (
    typeof value.symbol !== "string" ||
    typeof value.name !== "string" ||
    typeof value.exchange !== "string" ||
    typeof value.sector !== "string" ||
    typeof value.lastClose !== "number" ||
    typeof value.dayChangePercent !== "number" ||
    typeof value.latestDate !== "string" ||
    typeof value.latestVolume !== "number" ||
    typeof value.score !== "number" ||
    typeof value.status !== "string" ||
    typeof value.signal !== "string" ||
    value.dataStatus !== "ready"
  ) {
    return null;
  }

  return {
    symbol: value.symbol,
    name: value.name,
    exchange: value.exchange as StockSummary["exchange"],
    sector: value.sector,
    tier: value.tier as StockSummary["tier"],
    liquidityRank: typeof value.liquidityRank === "number" ? value.liquidityRank : null,
    lastClose: value.lastClose,
    dayChangePercent: value.dayChangePercent,
    latestDate: value.latestDate,
    latestVolume: value.latestVolume,
    avgVolume20: typeof value.avgVolume20 === "number" ? value.avgVolume20 : undefined,
    avgTradedValue20: typeof value.avgTradedValue20 === "number" ? value.avgTradedValue20 : undefined,
    score: value.score,
    previousScore: typeof value.previousScore === "number" ? value.previousScore : undefined,
    status: value.status as StockSummary["status"],
    signal: value.signal,
    topSignals: Array.isArray(value.topSignals) ? value.topSignals.map(parseSignal).filter((signal): signal is Signal => signal !== null) : undefined,
    scannerSignals: Array.isArray(value.scannerSignals)
      ? value.scannerSignals.map(parseSignal).filter((signal): signal is Signal => signal !== null)
      : undefined,
    dataStatus: "ready",
  };
}

function parseSignal(value: unknown): Signal | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.code !== "string" ||
    typeof value.labelVi !== "string" ||
    typeof value.descriptionVi !== "string" ||
    typeof value.category !== "string" ||
    typeof value.sentiment !== "string" ||
    typeof value.strength !== "number" ||
    typeof value.priority !== "number"
  ) {
    return null;
  }

  return {
    code: value.code,
    labelVi: value.labelVi,
    descriptionVi: value.descriptionVi,
    explanationVi: typeof value.explanationVi === "string" ? value.explanationVi : "",
    implicationVi: typeof value.implicationVi === "string" ? value.implicationVi : "",
    category: value.category as Signal["category"],
    sentiment: value.sentiment as Signal["sentiment"],
    strength: value.strength as Signal["strength"],
    priority: value.priority,
  };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
