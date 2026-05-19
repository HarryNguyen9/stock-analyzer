export const MIN_AVG_VOLUME20 = 500_000;
export const MIN_TRADED_VALUE20 = 10_000_000_000;
export const MAX_TOP_SYMBOLS_PER_SECTOR = 5;
export const MAX_ALERTS = 8;

export type LiquidityMetrics = {
  avgVolume20?: number | null;
  avgTradedValue20?: number | null;
  exchange?: string | null;
  liquidityRank?: number | null;
};

export function isLiquidEnough(
  metrics: LiquidityMetrics,
  threshold: {
    minAvgVolume20?: number;
    minTradedValue20?: number;
  } = {},
): boolean {
  const minAvgVolume20 = threshold.minAvgVolume20 ?? getEnvNumber("MIN_AVG_VOLUME20", MIN_AVG_VOLUME20);
  const minTradedValue20 = threshold.minTradedValue20 ?? getEnvNumber("MIN_TRADED_VALUE20", MIN_TRADED_VALUE20);
  const avgVolume20 = metrics.avgVolume20 ?? 0;
  const avgTradedValue20 = metrics.avgTradedValue20 ?? 0;

  return avgVolume20 >= minAvgVolume20 || avgTradedValue20 >= minTradedValue20;
}

export function getLiquidityScore(metrics: LiquidityMetrics): number {
  const avgVolume20 = metrics.avgVolume20 ?? 0;
  const avgTradedValue20 = metrics.avgTradedValue20 ?? 0;
  const exchangeBoost = metrics.exchange === "HOSE" ? 15 : metrics.exchange === "HNX" ? 8 : 0;
  const rankBoost = typeof metrics.liquidityRank === "number" ? Math.max(0, 80 - metrics.liquidityRank / 4) : 0;

  return (
    Math.log10(Math.max(1, avgTradedValue20)) * 12 +
    Math.log10(Math.max(1, avgVolume20)) * 4 +
    exchangeBoost +
    rankBoost
  );
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
