import type { CoveredWarrantMetrics, CoveredWarrantRecord, CoveredWarrantWithMetrics } from "@/lib/cw/types";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateCoveredWarrantMetrics(warrant: CoveredWarrantRecord, today = new Date()): CoveredWarrantMetrics {
  const daysToMaturity = Math.max(0, Math.ceil((new Date(warrant.maturityDate).getTime() - today.getTime()) / millisecondsPerDay));
  const isCall = warrant.type.toLowerCase() !== "put";
  const underlyingPrice = warrant.underlyingPrice;
  const ratio = warrant.exerciseRatio > 0 ? warrant.exerciseRatio : null;
  const intrinsicValue =
    underlyingPrice !== null && ratio
      ? Math.max(0, (isCall ? underlyingPrice - warrant.strikePrice : warrant.strikePrice - underlyingPrice) / ratio)
      : null;
  const timeValue = intrinsicValue === null ? null : Math.max(0, warrant.lastPrice - intrinsicValue);
  const breakEvenPrice = ratio
    ? isCall
      ? warrant.strikePrice + warrant.lastPrice * ratio
      : warrant.strikePrice - warrant.lastPrice * ratio
    : null;
  const premiumPercent =
    underlyingPrice && breakEvenPrice !== null
      ? ((isCall ? breakEvenPrice - underlyingPrice : underlyingPrice - breakEvenPrice) / underlyingPrice) * 100
      : null;
  const gearing =
    underlyingPrice && warrant.lastPrice > 0 && ratio
      ? underlyingPrice / (warrant.lastPrice * ratio)
      : null;
  const spreadPercent =
    warrant.bid !== null && warrant.ask !== null && warrant.bid > 0 && warrant.ask > 0
      ? ((warrant.ask - warrant.bid) / ((warrant.ask + warrant.bid) / 2)) * 100
      : null;

  return {
    daysToMaturity,
    breakEvenPrice,
    intrinsicValue,
    timeValue,
    premiumPercent,
    gearing,
    effectiveLeverage: gearing,
    spreadPercent,
  };
}

export function attachCoveredWarrantMetrics(warrants: CoveredWarrantRecord[]): CoveredWarrantWithMetrics[] {
  return warrants.map((warrant) => ({
    ...warrant,
    metrics: calculateCoveredWarrantMetrics(warrant),
  }));
}

export function sortCoveredWarrants(warrants: CoveredWarrantWithMetrics[]): CoveredWarrantWithMetrics[] {
  return [...warrants].sort((a, b) => {
    const liquidityDiff = b.volume - a.volume;
    if (liquidityDiff !== 0) return liquidityDiff;

    const maturityDiff = new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime();
    if (maturityDiff !== 0) return maturityDiff;

    return nullableSortValue(a.metrics.premiumPercent) - nullableSortValue(b.metrics.premiumPercent);
  });
}

function nullableSortValue(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

