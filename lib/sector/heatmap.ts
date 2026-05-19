import { getStockSummaries } from "@/lib/data-source/prices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { StockSummary } from "@/types/stock";

export const SECTOR_HEATMAP_SNAPSHOT_TYPE = "sector_heatmap";

export type SectorTopSymbol = {
  symbol: string;
  name: string;
  exchange: StockSummary["exchange"];
  lastClose: number;
  changePercent: number;
  technicalScore: number;
  status: StockSummary["status"];
};

export type SectorSummary = {
  sector: string;
  symbolCount: number;
  averageChangePercent: number;
  averageTechnicalScore: number;
  advancingCount: number;
  decliningCount: number;
  topSymbols: SectorTopSymbol[];
};

type SnapshotRow = {
  data: Json;
  updated_at?: string | null;
};

const TOP_SYMBOLS_PER_SECTOR = 5;

export function buildSectorSummaries(stocks: StockSummary[]): SectorSummary[] {
  const grouped = new Map<string, StockSummary[]>();

  for (const stock of stocks) {
    if (stock.dataStatus !== "ready") {
      continue;
    }

    const sector = stock.sector?.trim();

    if (!sector) {
      continue;
    }

    grouped.set(sector, [...(grouped.get(sector) ?? []), stock]);
  }

  return Array.from(grouped.entries())
    .map(([sector, items]) => {
      const averageChangePercent = average(items.map((stock) => stock.dayChangePercent));
      const averageTechnicalScore = average(items.map((stock) => stock.score));
      const topSymbols = [...items]
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.dayChangePercent - a.dayChangePercent ||
            a.symbol.localeCompare(b.symbol),
        )
        .slice(0, TOP_SYMBOLS_PER_SECTOR)
        .map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          lastClose: stock.lastClose,
          changePercent: stock.dayChangePercent,
          technicalScore: stock.score,
          status: stock.status,
        }));

      return {
        sector,
        symbolCount: items.length,
        averageChangePercent,
        averageTechnicalScore,
        advancingCount: items.filter((stock) => stock.dayChangePercent >= 0).length,
        decliningCount: items.filter((stock) => stock.dayChangePercent < 0).length,
        topSymbols,
      };
    })
    .sort(
      (a, b) =>
        b.averageChangePercent - a.averageChangePercent ||
        b.averageTechnicalScore - a.averageTechnicalScore ||
        b.symbolCount - a.symbolCount ||
        a.sector.localeCompare(b.sector),
    );
}

export async function refreshSectorHeatmapSnapshot(stocks?: StockSummary[]): Promise<boolean> {
  try {
    const sourceStocks = stocks ?? await getStockSummaries();
    const sectors = buildSectorSummaries(sourceStocks);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("market_snapshots").upsert(
      {
        snapshot_type: SECTOR_HEATMAP_SNAPSHOT_TYPE,
        data: sectors as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_type" },
    );

    if (error) {
      throw error;
    }

    console.info("sector_heatmap snapshot updated:", {
      sectorCount: sectors.length,
      symbolCount: sourceStocks.length,
    });

    return true;
  } catch (error) {
    console.warn("Khong cap nhat duoc sector_heatmap snapshot:", error);
    return false;
  }
}

export async function readSectorHeatmapSnapshot(currentStocks: StockSummary[] = []): Promise<SectorSummary[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("data,updated_at")
      .eq("snapshot_type", SECTOR_HEATMAP_SNAPSHOT_TYPE)
      .maybeSingle();

    if (error || !data) {
      return buildSectorSummaries(currentStocks);
    }

    const row = data as SnapshotRow;
    const sectors = parseSectorSummaries(row.data);

    if (!sectors) {
      return buildSectorSummaries(currentStocks);
    }

    return sectors;
  } catch (error) {
    console.warn("Khong doc duoc sector_heatmap snapshot, fallback runtime sector summary:", error);
    return buildSectorSummaries(currentStocks);
  }
}

function parseSectorSummaries(value: unknown): SectorSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const sectors = value.map(parseSectorSummary).filter((item): item is SectorSummary => item !== null);
  return sectors.length > 0 ? sectors : null;
}

function parseSectorSummary(value: unknown): SectorSummary | null {
  if (!isRecord(value) || typeof value.sector !== "string") {
    return null;
  }

  if (
    typeof value.symbolCount !== "number" ||
    typeof value.averageChangePercent !== "number" ||
    typeof value.averageTechnicalScore !== "number" ||
    typeof value.advancingCount !== "number" ||
    typeof value.decliningCount !== "number" ||
    !Array.isArray(value.topSymbols)
  ) {
    return null;
  }

  return {
    sector: value.sector,
    symbolCount: value.symbolCount,
    averageChangePercent: value.averageChangePercent,
    averageTechnicalScore: value.averageTechnicalScore,
    advancingCount: value.advancingCount,
    decliningCount: value.decliningCount,
    topSymbols: value.topSymbols.map(parseTopSymbol).filter((item): item is SectorTopSymbol => item !== null),
  };
}

function parseTopSymbol(value: unknown): SectorTopSymbol | null {
  if (
    !isRecord(value) ||
    typeof value.symbol !== "string" ||
    typeof value.name !== "string" ||
    typeof value.exchange !== "string" ||
    typeof value.lastClose !== "number" ||
    typeof value.changePercent !== "number" ||
    typeof value.technicalScore !== "number" ||
    typeof value.status !== "string"
  ) {
    return null;
  }

  return {
    symbol: value.symbol,
    name: value.name,
    exchange: value.exchange as StockSummary["exchange"],
    lastClose: value.lastClose,
    changePercent: value.changePercent,
    technicalScore: value.technicalScore,
    status: value.status as StockSummary["status"],
  };
}

function average(values: number[]): number {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
