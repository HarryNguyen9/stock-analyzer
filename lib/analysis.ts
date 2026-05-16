import type { OHLCV, TechnicalAnalysis } from "../types/stock";
import {
  calculateRSI,
  calculateSMA,
  calculateVolumeAverage,
  latestValue,
  round,
} from "./indicators";
import { vi } from "./i18n/vi";

export function analyzeTechnical(data: OHLCV[]): TechnicalAnalysis {
  const closes = data.map((candle) => candle.close);
  const sma20Series = calculateSMA(closes, 20);
  const sma50Series = calculateSMA(closes, 50);
  const rsi14Series = calculateRSI(closes, 14);
  const volumeAverage20Series = calculateVolumeAverage(data, 20);

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const sma20 = latestValue(sma20Series);
  const sma50 = latestValue(sma50Series);
  const rsi14 = latestValue(rsi14Series);
  const volumeAverage20 = latestValue(volumeAverage20Series);
  const volumeRatio = volumeAverage20 ? latest.volume / volumeAverage20 : 1;
  const twentyDayHigh = Math.max(...data.slice(-20).map((candle) => candle.high));
  const twentyDayLow = Math.min(...data.slice(-20).map((candle) => candle.low));
  const drawdown = (twentyDayHigh - latest.close) / twentyDayHigh;
  const rangeRisk = (twentyDayHigh - twentyDayLow) / latest.close;

  let score = 45;

  if (sma20 && latest.close > sma20) score += 12;
  if (sma50 && latest.close > sma50) score += 12;
  if (sma20 && sma50 && sma20 > sma50) score += 10;
  if (latest.close > previous.close) score += 5;
  if (rsi14 !== null && rsi14 >= 45 && rsi14 <= 65) score += 9;
  if (rsi14 !== null && rsi14 > 65 && rsi14 <= 75) score += 5;
  if (rsi14 !== null && rsi14 < 35) score -= 10;
  if (rsi14 !== null && rsi14 > 78) score -= 8;
  if (volumeRatio > 1.2 && latest.close > previous.close) score += 8;
  if (volumeRatio > 1.6 && latest.close < previous.close) score -= 9;
  if (drawdown > 0.1) score -= 8;
  if (rangeRisk > 0.18) score -= 6;

  const boundedScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score: boundedScore,
    indicators: {
      sma20,
      sma50,
      rsi14,
      volumeAverage20,
    },
    signals: [
      getTrendSignal(latest.close, sma20, sma50),
      getMomentumSignal(rsi14),
      getVolumeSignal(volumeRatio, latest.close >= previous.close),
      getRiskSignal(drawdown, rangeRisk),
    ],
  };
}

function getTrendSignal(close: number, sma20: number | null, sma50: number | null) {
  if (sma20 && sma50 && close > sma20 && sma20 > sma50) {
    return {
      title: vi.signal.titles.trend,
      label: vi.signal.trend.uptrend,
      detail: vi.signal.trend.uptrendDetail(sma20, sma50),
      tone: "positive" as const,
    };
  }

  if (sma20 && close < sma20) {
    return {
      title: vi.signal.titles.trend,
      label: vi.signal.trend.weakening,
      detail: vi.signal.trend.weakeningDetail(sma20),
      tone: "warning" as const,
    };
  }

  return {
    title: vi.signal.titles.trend,
    label: vi.signal.trend.sideways,
    detail: vi.signal.trend.sidewaysDetail,
    tone: "neutral" as const,
  };
}

function getMomentumSignal(rsi14: number | null) {
  if (rsi14 === null) {
    return {
      title: vi.signal.titles.momentum,
      label: vi.signal.momentum.notReady,
      detail: vi.signal.momentum.notReadyDetail,
      tone: "neutral" as const,
    };
  }

  if (rsi14 > 78) {
    return {
      title: vi.signal.titles.momentum,
      label: vi.signal.momentum.overbought,
      detail: vi.signal.momentum.overboughtDetail(rsi14),
      tone: "warning" as const,
    };
  }

  if (rsi14 < 30) {
    return {
      title: vi.signal.titles.momentum,
      label: vi.signal.momentum.oversold,
      detail: vi.signal.momentum.oversoldDetail(rsi14),
      tone: "negative" as const,
    };
  }

  if (rsi14 >= 50 && rsi14 <= 70) {
    return {
      title: vi.signal.titles.momentum,
      label: vi.signal.momentum.healthy,
      detail: vi.signal.momentum.healthyDetail(rsi14),
      tone: "positive" as const,
    };
  }

  if (rsi14 > 70) {
    return {
      title: vi.signal.titles.momentum,
      label: vi.signal.momentum.stretched,
      detail: vi.signal.momentum.stretchedDetail(rsi14),
      tone: "warning" as const,
    };
  }

  return {
    title: vi.signal.titles.momentum,
    label: vi.signal.momentum.soft,
    detail: vi.signal.momentum.softDetail(rsi14),
    tone: "negative" as const,
  };
}

function getVolumeSignal(volumeRatio: number, isGreenDay: boolean) {
  const ratio = round(volumeRatio, 1);

  if (volumeRatio > 1.2 && isGreenDay) {
    return {
      title: vi.signal.titles.volume,
      label: vi.signal.volume.accumulation,
      detail: vi.signal.volume.accumulationDetail(ratio),
      tone: "positive" as const,
    };
  }

  if (volumeRatio > 1.5 && !isGreenDay) {
    return {
      title: vi.signal.titles.volume,
      label: vi.signal.volume.distribution,
      detail: vi.signal.volume.distributionDetail(ratio),
      tone: "negative" as const,
    };
  }

  return {
    title: vi.signal.titles.volume,
    label: vi.signal.volume.normal,
    detail: vi.signal.volume.normalDetail(ratio),
    tone: "neutral" as const,
  };
}

function getRiskSignal(drawdown: number, rangeRisk: number) {
  if (drawdown < 0.04 && rangeRisk < 0.14) {
    return {
      title: vi.signal.titles.risk,
      label: vi.signal.risk.controlled,
      detail: vi.signal.risk.controlledDetail,
      tone: "positive" as const,
    };
  }

  if (drawdown > 0.12 || rangeRisk > 0.2) {
    return {
      title: vi.signal.titles.risk,
      label: vi.signal.risk.elevated,
      detail: vi.signal.risk.elevatedDetail,
      tone: "warning" as const,
    };
  }

  return {
    title: vi.signal.titles.risk,
    label: vi.signal.risk.balanced,
    detail: vi.signal.risk.balancedDetail,
    tone: "neutral" as const,
  };
}
