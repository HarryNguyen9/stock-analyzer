import type { CoveredWarrantMetrics, CoveredWarrantRecord, CoveredWarrantWithMetrics } from "@/lib/cw/types";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateCoveredWarrantMetrics(warrant: CoveredWarrantRecord, today = new Date()): CoveredWarrantMetrics {
  const maturityTime = warrant.maturityDate ? new Date(warrant.maturityDate).getTime() : Number.NaN;
  const daysToMaturity = warrant.daysToMaturity ?? (Number.isFinite(maturityTime)
    ? Math.max(0, Math.ceil((maturityTime - today.getTime()) / millisecondsPerDay))
    : 0);
  const isCall = warrant.type?.toLowerCase() !== "put";
  const underlyingPrice = warrant.underlyingPrice;
  const derivedStrikePrice = deriveStrikePrice(warrant);
  const strikePrice = warrant.strikePrice ?? derivedStrikePrice;
  const derivedRatio = deriveExerciseRatio(warrant, strikePrice, isCall);
  const ratio = warrant.exerciseRatio !== null && warrant.exerciseRatio > 0 ? warrant.exerciseRatio : derivedRatio;
  const lastPrice = warrant.lastPrice;
  const intrinsicValue =
    underlyingPrice !== null && ratio && strikePrice !== null
      ? Math.max(0, (isCall ? underlyingPrice - strikePrice : strikePrice - underlyingPrice) / ratio)
      : null;
  const timeValue = intrinsicValue === null || lastPrice === null ? null : Math.max(0, lastPrice - intrinsicValue);
  const breakEvenPrice =
    warrant.breakEvenPrice ??
    (ratio && strikePrice !== null && lastPrice !== null
      ? isCall
        ? strikePrice + lastPrice * ratio
        : strikePrice - lastPrice * ratio
      : null);
  const premiumPercent =
    underlyingPrice && breakEvenPrice !== null
      ? ((isCall ? breakEvenPrice - underlyingPrice : underlyingPrice - breakEvenPrice) / underlyingPrice) * 100
      : null;
  const gearing =
    underlyingPrice && lastPrice !== null && lastPrice > 0 && ratio
      ? underlyingPrice / (lastPrice * ratio)
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

function deriveStrikePrice(warrant: CoveredWarrantRecord): number | null {
  if (warrant.underlyingPrice === null || warrant.sxValue === null) return null;
  const isCall = warrant.type?.toLowerCase() !== "put";
  const strikePrice = isCall
    ? warrant.underlyingPrice - warrant.sxValue
    : warrant.underlyingPrice + warrant.sxValue;

  return Number.isFinite(strikePrice) && strikePrice > 0 ? strikePrice : null;
}

function deriveExerciseRatio(warrant: CoveredWarrantRecord, strikePrice: number | null, isCall: boolean): number | null {
  if (strikePrice === null || warrant.breakEvenPrice === null || warrant.lastPrice === null || warrant.lastPrice <= 0) {
    return null;
  }

  const ratio = isCall
    ? (warrant.breakEvenPrice - strikePrice) / warrant.lastPrice
    : (strikePrice - warrant.breakEvenPrice) / warrant.lastPrice;

  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function attachCoveredWarrantMetrics(warrants: CoveredWarrantRecord[]): CoveredWarrantWithMetrics[] {
  return warrants.map((warrant) => ({
    ...warrant,
    metrics: calculateCoveredWarrantMetrics(warrant),
  }));
}

export function sortCoveredWarrants(warrants: CoveredWarrantWithMetrics[]): CoveredWarrantWithMetrics[] {
  return [...warrants].sort((a, b) => {
    const liquidityDiff = (b.volume ?? 0) - (a.volume ?? 0);
    if (liquidityDiff !== 0) return liquidityDiff;

    const maturityDiff = nullableTime(a.maturityDate) - nullableTime(b.maturityDate);
    if (maturityDiff !== 0) return maturityDiff;

    return nullableSortValue(a.metrics.premiumPercent) - nullableSortValue(b.metrics.premiumPercent);
  });
}

function nullableSortValue(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

function nullableTime(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
