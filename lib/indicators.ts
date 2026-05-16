import type { OHLCV } from "@/types/stock";

export function calculateSMA(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return null;
    }

    const slice = values.slice(index + 1 - period, index + 1);
    return round(slice.reduce((total, value) => total + value, 0) / period, 2);
  });
}

export function calculateRSI(values: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = Array(values.length).fill(null);

  if (values.length <= period) {
    return rsi;
  }

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }

  averageGain /= period;
  averageLoss /= period;
  rsi[period] = toRSI(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    rsi[index] = toRSI(averageGain, averageLoss);
  }

  return rsi;
}

export function calculateVolumeAverage(data: OHLCV[], period = 20): (number | null)[] {
  return calculateSMA(
    data.map((candle) => candle.volume),
    period,
  );
}

export function latestValue(values: (number | null)[]): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) {
      return values[index];
    }
  }

  return null;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toRSI(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return round(100 - 100 / (1 + relativeStrength), 2);
}
