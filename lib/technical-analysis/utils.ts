import type { OHLCV } from "@/types/stock";

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function latest(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return values[index];
  }

  return null;
}

export function sma(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return round(slice.reduce((total, value) => total + value, 0) / period);
  });
}

export function ema(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);

  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  result[period - 1] = round(current);

  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = round(current);
  }

  return result;
}

export function rsi(values: number[], period = 14): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }

  averageGain /= period;
  averageLoss /= period;
  result[period] = toRsi(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[index] = toRsi(averageGain, averageLoss);
  }

  return result;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function highest(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

export function lowest(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

export function average(values: number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function trueRange(current: OHLCV, previous: OHLCV | null): number {
  if (!previous) return current.high - current.low;
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close),
  );
}

function toRsi(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return round(100 - 100 / (1 + relativeStrength));
}
