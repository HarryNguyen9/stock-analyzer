import type { AnalysisContext, SupportResistance } from "@/lib/technical-analysis/types";
import { highest, lowest, round } from "@/lib/technical-analysis/utils";

export function analyzeSupportResistance(context: AnalysisContext): SupportResistance {
  const high20 = highest(context.highs.slice(-20));
  const low20 = lowest(context.lows.slice(-20));
  const high50 = highest(context.highs.slice(-50));
  const low50 = lowest(context.lows.slice(-50));
  const latestClose = context.latest.close;
  const candidateSupports = [low20, low50, ...context.lows.slice(-30)]
    .filter((value): value is number => value !== null && value < latestClose)
    .sort((a, b) => b - a);
  const candidateResistances = [high20, high50, ...context.highs.slice(-30)]
    .filter((value): value is number => value !== null && value > latestClose)
    .sort((a, b) => a - b);
  const nearestSupport = dedupe(candidateSupports)[0] ?? low20 ?? null;
  const nearestResistance = dedupe(candidateResistances)[0] ?? high20 ?? null;

  return {
    nearestSupport,
    nearestResistance,
    high20,
    low20,
    high50,
    low50,
    distanceToSupportPercent:
      nearestSupport && latestClose > 0 ? round(((latestClose - nearestSupport) / latestClose) * 100) : null,
    distanceToResistancePercent:
      nearestResistance && latestClose > 0 ? round(((nearestResistance - latestClose) / latestClose) * 100) : null,
  };
}

function dedupe(values: number[]): number[] {
  const result: number[] = [];

  for (const value of values) {
    if (!result.some((current) => Math.abs(current - value) / Math.max(current, value) < 0.005)) {
      result.push(value);
    }
  }

  return result;
}
