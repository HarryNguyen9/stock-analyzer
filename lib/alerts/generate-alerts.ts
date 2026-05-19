import { getStockSummaries } from "@/lib/data-source/prices";
import { getLiquidityScore, isLiquidEnough, MAX_ALERTS } from "@/lib/market/liquidity";
import { readMarketBreadthSnapshot, type MarketBreadthSnapshot } from "@/lib/market/breadth";
import { recordSnapshotHistory } from "@/lib/market/snapshot-history";
import { readSectorHeatmapSnapshot, type SectorSummary } from "@/lib/sector/heatmap";
import { sortSignalsByPriority } from "@/lib/signals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { Signal } from "@/lib/technical-analysis/types";
import type { StockSummary } from "@/types/stock";

export const MARKET_ALERTS_SNAPSHOT_TYPE = "market_alerts";

export type MarketAlertSeverity = "info" | "warning" | "bullish" | "bearish";
export type MarketAlertGroup = "market" | "sector" | "symbol";

export type MarketAlertType =
  | "breakout_volume"
  | "technical_score_threshold"
  | "rsi_extreme"
  | "volume_spike"
  | "sector_strength_surge"
  | "market_breadth_strength"
  | "market_breadth_weakness"
  | "unusual_move";

export type MarketAlert = {
  type: MarketAlertType;
  title: string;
  description: string;
  symbol?: string;
  sector?: string;
  severity: MarketAlertSeverity;
  group: MarketAlertGroup;
  created_at: string;
  expires_at?: string;
  priority: number;
  dedupeKey: string;
  liquidityScore?: number;
  technicalScore?: number;
};

type SnapshotRow = {
  data: Json;
};

const DEFAULT_SCORE_THRESHOLD = 80;
const DEFAULT_UNUSUAL_MOVE_PERCENT = 5;
const DEFAULT_ALERT_COOLDOWN_HOURS = 4;
const DEFAULT_MAX_ALERTS = MAX_ALERTS;

export async function refreshMarketAlertsSnapshot(stocks?: StockSummary[]): Promise<boolean> {
  try {
    const sourceStocks = stocks ?? await getStockSummaries();
    const [sectors, breadth, previousAlerts] = await Promise.all([
      readSectorHeatmapSnapshot(sourceStocks),
      readMarketBreadthSnapshot(sourceStocks),
      readMarketAlertsSnapshot(),
    ]);
    const alerts = generateMarketAlerts(sourceStocks, sectors, breadth, previousAlerts);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("market_snapshots").upsert(
      {
        snapshot_type: MARKET_ALERTS_SNAPSHOT_TYPE,
        data: alerts as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_type" },
    );

    if (error) {
      throw error;
    }

    await recordSnapshotHistory(MARKET_ALERTS_SNAPSHOT_TYPE, alerts as unknown as Json);

    console.info("market_alerts snapshot updated:", {
      alertCount: alerts.length,
      symbolCount: sourceStocks.length,
      groups: countByGroup(alerts),
    });

    return true;
  } catch (error) {
    console.warn("Khong cap nhat duoc market_alerts snapshot:", error);
    return false;
  }
}

export async function readMarketAlertsSnapshot(): Promise<MarketAlert[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("data")
      .eq("snapshot_type", MARKET_ALERTS_SNAPSHOT_TYPE)
      .maybeSingle();

    if (error || !data) {
      return [];
    }

    const row = data as SnapshotRow;
    return parseMarketAlerts(row.data);
  } catch (error) {
    console.warn("Khong doc duoc market_alerts snapshot:", error);
    return [];
  }
}

export function generateMarketAlerts(
  stocks: StockSummary[],
  sectors: SectorSummary[],
  breadth: MarketBreadthSnapshot,
  previousAlerts: MarketAlert[] = [],
): MarketAlert[] {
  const now = new Date();
  const cooldownHours = getEnvNumber("ALERT_COOLDOWN_HOURS", DEFAULT_ALERT_COOLDOWN_HOURS);
  const candidates = [
    ...generateStockAlerts(stocks, now),
    ...generateSectorAlerts(sectors, now),
    ...generateBreadthAlerts(breadth, now),
  ];

  return applyDedupeAndCooldown(candidates, previousAlerts, cooldownHours)
    .sort(sortAlerts)
    .slice(0, getEnvNumber("ALERT_MAX_ITEMS", DEFAULT_MAX_ALERTS));
}

function generateStockAlerts(stocks: StockSummary[], now: Date): MarketAlert[] {
  const alerts: MarketAlert[] = [];
  const scoreThreshold = getEnvNumber("ALERT_SCORE_THRESHOLD", DEFAULT_SCORE_THRESHOLD);
  const unusualMovePercent = getEnvNumber("ALERT_UNUSUAL_MOVE_PERCENT", DEFAULT_UNUSUAL_MOVE_PERCENT);

  for (const stock of stocks) {
    if (stock.dataStatus !== "ready" || !isLiquidEnough(stock)) {
      continue;
    }

    const signals = sortSignalsByPriority(stock.scannerSignals ?? []);
    const breakoutVolume = signals.find((signal) => signal.code === "BREAKOUT_VOLUME_CONFIRM");
    const breakHigh = signals.find((signal) => signal.code === "BREAK_HIGH_20");
    const volumeSpike = signals.find((signal) => signal.code === "PRICE_UP_VOLUME_UP");
    const rsiExtreme = signals.find((signal) => signal.code === "RSI_OVERBOUGHT" || signal.code === "RSI_OVERSOLD");

    if (breakoutVolume) {
      alerts.push(
        createStockAlert(stock, now, {
          type: "breakout_volume",
          severity: "bullish",
          priority: 100 + breakoutVolume.strength,
          title: `${stock.symbol} breakout kèm thanh khoản cao`,
          description: `${stock.symbol} vượt vùng kỹ thuật với thanh khoản xác nhận, thuộc nhóm tín hiệu mạnh cần theo dõi.`,
        }),
      );
    } else if (breakHigh) {
      alerts.push(
        createStockAlert(stock, now, {
          type: "breakout_volume",
          severity: "bullish",
          priority: 92 + breakHigh.strength,
          title: `${stock.symbol} vượt đỉnh 20 phiên`,
          description: `${stock.symbol} phá vùng đỉnh ngắn hạn; tín hiệu sẽ đáng tin hơn nếu thanh khoản tiếp tục xác nhận.`,
        }),
      );
    }

    if (stock.score >= scoreThreshold) {
      alerts.push(
        createStockAlert(stock, now, {
          type: "technical_score_threshold",
          severity: "bullish",
          priority: 90 + Math.min(10, stock.score - scoreThreshold),
          title: `${stock.symbol} có điểm kỹ thuật cao`,
          description: `${stock.symbol} đạt ${Math.round(stock.score)}/100, nằm trong nhóm kỹ thuật mạnh của thị trường.`,
        }),
      );
    }

    if (volumeSpike) {
      alerts.push(
        createStockAlert(stock, now, {
          type: "volume_spike",
          severity: "bullish",
          priority: 84 + volumeSpike.strength,
          title: `${stock.symbol} volume tăng mạnh`,
          description: `${stock.symbol} có khối lượng cao hơn nền gần đây, cho thấy dòng tiền đang chú ý hơn.`,
        }),
      );
    }

    if (rsiExtreme) {
      const isOverbought = rsiExtreme.code === "RSI_OVERBOUGHT";
      alerts.push(
        createStockAlert(stock, now, {
          type: "rsi_extreme",
          severity: isOverbought ? "warning" : "info",
          priority: 76 + rsiExtreme.strength,
          title: `${stock.symbol} ${rsiExtreme.labelVi.toLowerCase()}`,
          description: rsiExtreme.descriptionVi,
        }),
      );
    }

    if (Math.abs(stock.dayChangePercent) >= unusualMovePercent) {
      alerts.push(
        createStockAlert(stock, now, {
          type: "unusual_move",
          severity: stock.dayChangePercent > 0 ? "bullish" : "bearish",
          priority: 72 + Math.abs(stock.dayChangePercent),
          title: `${stock.symbol} biến động mạnh`,
          description: `${stock.symbol} biến động ${formatPercent(stock.dayChangePercent)} trong phiên gần nhất.`,
        }),
      );
    }
  }

  return alerts;
}

function generateSectorAlerts(sectors: SectorSummary[], now: Date): MarketAlert[] {
  return sectors
    .filter(
      (sector) =>
        sector.symbolCount >= 3 &&
        sector.topSymbols.length > 0 &&
        sector.averageChangePercent >= 2 &&
        sector.averageTechnicalScore >= 65,
    )
    .slice(0, 4)
    .map((sector) => ({
      type: "sector_strength_surge" as const,
      title: `Ngành ${sector.sector} dẫn sóng`,
      description: `Ngành ${sector.sector} tăng trung bình ${formatPercent(sector.averageChangePercent)}, điểm kỹ thuật bình quân ${Math.round(sector.averageTechnicalScore)}.`,
      sector: sector.sector,
      severity: "bullish" as const,
      group: "sector" as const,
      created_at: now.toISOString(),
      expires_at: addHours(now, DEFAULT_ALERT_COOLDOWN_HOURS).toISOString(),
      priority: 84 + sector.averageChangePercent + Math.min(6, sector.topSymbols.length),
      dedupeKey: `sector_strength_surge:${sector.sector}`,
      liquidityScore: sector.topSymbols.reduce((total, stock) => total + stock.technicalScore, 0) / sector.topSymbols.length,
      technicalScore: sector.averageTechnicalScore,
    }));
}

function generateBreadthAlerts(breadth: MarketBreadthSnapshot, now: Date): MarketAlert[] {
  if (breadth.totalSymbols === 0) {
    return [];
  }

  if (breadth.advancers > breadth.decliners * 1.5 && breadth.percentAboveSMA20 >= 55) {
    return [
      {
        type: "market_breadth_strength",
        title: "Độ rộng thị trường tích cực",
        description: `${breadth.advancers} mã tăng so với ${breadth.decliners} mã giảm, ${breadth.percentAboveSMA20.toFixed(0)}% mã nằm trên MA20.`,
        severity: "bullish",
        group: "market",
        created_at: now.toISOString(),
        expires_at: addHours(now, DEFAULT_ALERT_COOLDOWN_HOURS).toISOString(),
        priority: 92,
        dedupeKey: "market_breadth_strength:market",
      },
    ];
  }

  if (breadth.decliners > breadth.advancers * 1.5 || breadth.percentAboveSMA20 < 35) {
    return [
      {
        type: "market_breadth_weakness",
        title: "Độ rộng thị trường suy yếu",
        description: `${breadth.decliners} mã giảm so với ${breadth.advancers} mã tăng, chỉ ${breadth.percentAboveSMA20.toFixed(0)}% mã nằm trên MA20.`,
        severity: "bearish",
        group: "market",
        created_at: now.toISOString(),
        expires_at: addHours(now, DEFAULT_ALERT_COOLDOWN_HOURS).toISOString(),
        priority: 92,
        dedupeKey: "market_breadth_weakness:market",
      },
    ];
  }

  return [];
}

function createStockAlert(
  stock: StockSummary,
  now: Date,
  input: {
    type: MarketAlertType;
    severity: MarketAlertSeverity;
    priority: number;
    title: string;
    description: string;
  },
): MarketAlert {
  return {
    type: input.type,
    title: input.title,
    description: input.description,
    symbol: stock.symbol,
    sector: stock.sector,
    severity: input.severity,
    group: "symbol",
    created_at: now.toISOString(),
    expires_at: addHours(now, DEFAULT_ALERT_COOLDOWN_HOURS).toISOString(),
    priority: input.priority,
    dedupeKey: `${stock.symbol}:${input.type}`,
    liquidityScore: getLiquidityScore(stock),
    technicalScore: stock.score,
  };
}

function applyDedupeAndCooldown(
  candidates: MarketAlert[],
  previousAlerts: MarketAlert[],
  cooldownHours: number,
): MarketAlert[] {
  const nowMs = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const previousByKey = new Map(previousAlerts.map((alert) => [alert.dedupeKey, alert]));
  const deduped = new Map<string, MarketAlert>();

  for (const alert of candidates.sort(sortAlerts)) {
    const previous = previousByKey.get(alert.dedupeKey);
    const previousTime = previous ? new Date(previous.created_at).getTime() : Number.NaN;
    const strongerThanPrevious = previous ? alert.priority > previous.priority : false;
    const shouldKeepPreviousTime =
      previous && Number.isFinite(previousTime) && nowMs - previousTime < cooldownMs && !strongerThanPrevious;
    const created_at = shouldKeepPreviousTime ? previous.created_at : alert.created_at;
    const expires_at = addHours(new Date(created_at), cooldownHours).toISOString();
    const nextAlert = { ...alert, created_at, expires_at };
    const current = deduped.get(alert.dedupeKey);

    if (!current || sortAlerts(nextAlert, current) < 0) {
      deduped.set(alert.dedupeKey, nextAlert);
    }
  }

  return [...deduped.values()];
}

function parseMarketAlerts(value: unknown): MarketAlert[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseMarketAlert).filter((alert): alert is MarketAlert => alert !== null);
}

function parseMarketAlert(value: unknown): MarketAlert | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.type !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.severity !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.priority !== "number" ||
    typeof value.dedupeKey !== "string"
  ) {
    return null;
  }

  return {
    type: value.type as MarketAlertType,
    title: value.title,
    description: value.description,
    symbol: typeof value.symbol === "string" ? value.symbol : undefined,
    sector: typeof value.sector === "string" ? value.sector : undefined,
    severity: value.severity as MarketAlertSeverity,
    group: isMarketAlertGroup(value.group) ? value.group : value.symbol ? "symbol" : value.sector ? "sector" : "market",
    created_at: value.created_at,
    expires_at: typeof value.expires_at === "string" ? value.expires_at : undefined,
    priority: value.priority,
    dedupeKey: value.dedupeKey,
    liquidityScore: typeof value.liquidityScore === "number" ? value.liquidityScore : undefined,
    technicalScore: typeof value.technicalScore === "number" ? value.technicalScore : undefined,
  };
}

function sortAlerts(a: MarketAlert, b: MarketAlert): number {
  return (
    severityRank(b.severity) - severityRank(a.severity) ||
    (b.liquidityScore ?? 0) - (a.liquidityScore ?? 0) ||
    (b.technicalScore ?? 0) - (a.technicalScore ?? 0) ||
    b.priority - a.priority ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function severityRank(severity: MarketAlertSeverity): number {
  if (severity === "bearish") return 4;
  if (severity === "bullish") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function countByGroup(alerts: MarketAlert[]): Record<MarketAlertGroup, number> {
  return alerts.reduce(
    (counts, alert) => ({
      ...counts,
      [alert.group]: counts[alert.group] + 1,
    }),
    { market: 0, sector: 0, symbol: 0 },
  );
}

function isMarketAlertGroup(value: unknown): value is MarketAlertGroup {
  return value === "market" || value === "sector" || value === "symbol";
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
