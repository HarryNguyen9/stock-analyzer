import { topSignals } from "@/lib/signals";
import { analyzeBreakout } from "@/lib/technical-analysis/breakout";
import { analyzeCandlestickPatterns } from "@/lib/technical-analysis/candlestick-analysis";
import { analyzeMomentum } from "@/lib/technical-analysis/momentum";
import { analyzePatterns } from "@/lib/technical-analysis/patterns";
import { analyzeRisk } from "@/lib/technical-analysis/risk";
import { calculateTechnicalScore } from "@/lib/technical-analysis/score";
import { createMethodSummaries } from "@/lib/technical-analysis/method-summaries";
import { analyzeSupportResistance } from "@/lib/technical-analysis/support-resistance";
import { buildTechnicalThesis } from "@/lib/technical-analysis/thesis";
import { analyzeTrend } from "@/lib/technical-analysis/trend";
import type { AnalysisContext, TechnicalAnalysisResult, TechnicalIndicators } from "@/lib/technical-analysis/types";
import { analyzeVolume } from "@/lib/technical-analysis/volume";
import { analyzeVolatility } from "@/lib/technical-analysis/volatility";
import { analyzeWyckoffPhase } from "@/lib/technical-analysis/wyckoff-lite";
import type { OHLCV } from "@/types/stock";

export function generateTechnicalAnalysis(candles: OHLCV[]): TechnicalAnalysisResult {
  if (candles.length < 2) {
    throw new Error("Cần tối thiểu 2 nến OHLCV để phân tích kỹ thuật.");
  }

  const context = createContext(candles);
  const trend = analyzeTrend(context);
  const breakout = analyzeBreakout(context, trend.sma20);
  const momentum = analyzeMomentum(context);
  const volume = analyzeVolume(context, breakout.breakHigh20);
  const volatility = analyzeVolatility(context);
  const risk = analyzeRisk(context, {
    sma20: trend.sma20,
    sma50: trend.sma50,
    rsi14: momentum.rsi14,
    macdHistogram: momentum.macd.histogram,
    volumeSpikeRatio: volume.volumeSpikeRatio,
  });
  const patterns = analyzePatterns(context);
  const supportResistance = analyzeSupportResistance(context);
  const indicators: TechnicalIndicators = {
    sma20: trend.sma20,
    sma50: trend.sma50,
    sma200: trend.sma200,
    ema20: trend.ema20,
    ema50: trend.ema50,
    ema200: trend.ema200,
    goldenCross: trend.goldenCross,
    deathCross: trend.deathCross,
    rsi14: momentum.rsi14,
    macd: momentum.macd,
    roc10: momentum.roc10,
    adx14: momentum.adx14,
    stochasticRsi: momentum.stochasticRsi,
    volumeAverage20: volume.volumeAverage20,
    volumeSpikeRatio: volume.volumeSpikeRatio,
    obv: volume.obv,
    priceUpWithVolumeUp: volume.priceUpWithVolumeUp,
    breakoutVolumeConfirmation: volume.breakoutVolumeConfirmation,
    bollingerBands20: volatility.bollingerBands20,
    atr14: volatility.atr14,
    breakHigh20: breakout.breakHigh20,
    breakLow20: breakout.breakLow20,
    pullbackToMA20: breakout.pullbackToMA20,
    retestBreakoutZone: breakout.retestBreakoutZone,
    brokenMA20: risk.brokenMA20,
    brokenMA50: risk.brokenMA50,
    rsiOverbought: risk.rsiOverbought,
    macdBearish: risk.macdBearish,
    heavySellingVolume: risk.heavySellingVolume,
    higherHighHigherLow: patterns.higherHighHigherLow,
    lowerHighLowerLow: patterns.lowerHighLowerLow,
    consolidationRange: patterns.consolidationRange,
    gapUp: patterns.gapUp,
    gapDown: patterns.gapDown,
  };
  const candlestickPatterns = patterns.candlestickPatterns;
  const methodSummaries = createMethodSummaries({
    latest: context.latest,
    indicators,
    patterns: candlestickPatterns,
    supportResistance,
  });
  const score = calculateTechnicalScore(indicators);
  const signals = topSignals(
    [
      ...trend.signals,
      ...momentum.signals,
      ...volume.signals,
      ...volatility.signals,
      ...breakout.signals,
      ...risk.signals,
      ...patterns.signals,
    ],
    12,
  );
  const priceBehavior = {
    candlestickPatterns: analyzeCandlestickPatterns(candles),
    wyckoffLite: analyzeWyckoffPhase(candles, context.volumes, indicators),
  };

  const analysisWithoutThesis: Omit<TechnicalAnalysisResult, "thesis"> = {
    indicators,
    patterns: candlestickPatterns,
    priceBehavior,
    supportResistance,
    methodSummaries,
    signals,
    score: score.score,
    scoreBreakdown: score.breakdown,
    summaryVi: createSummary(context, indicators),
  };
  const thesis = buildTechnicalThesis(analysisWithoutThesis, candles);

  return {
    ...analysisWithoutThesis,
    thesis,
  };
}

function createContext(candles: OHLCV[]): AnalysisContext {
  return {
    candles,
    latest: candles[candles.length - 1],
    previous: candles[candles.length - 2],
    closes: candles.map((candle) => candle.close),
    highs: candles.map((candle) => candle.high),
    lows: candles.map((candle) => candle.low),
    volumes: candles.map((candle) => candle.volume),
  };
}

function createSummary(context: AnalysisContext, indicators: TechnicalIndicators): string {
  const trendText =
    indicators.sma20 && indicators.sma50 && context.latest.close > indicators.sma20 && indicators.sma20 > indicators.sma50
      ? "đang duy trì xu hướng tăng ngắn hạn"
      : indicators.sma20 && context.latest.close < indicators.sma20
        ? "đang yếu đi khi giá nằm dưới MA20"
        : "đang đi ngang trong vùng cân bằng";
  const rsiText =
    indicators.rsi14 === null
      ? "RSI chưa đủ dữ liệu"
      : indicators.rsi14 > 70
        ? "RSI ở vùng quá mua"
        : indicators.rsi14 < 30
          ? "RSI ở vùng quá bán"
          : "RSI ở vùng trung tính";
  const volumeText =
    indicators.volumeSpikeRatio !== null && indicators.volumeSpikeRatio >= 1.2
      ? `khối lượng cao hơn trung bình 20 phiên (${indicators.volumeSpikeRatio}x)`
      : "khối lượng quanh mức trung bình";

  return `Mã này ${trendText}. ${rsiText}, ${volumeText}.`;
}

export type {
  Signal,
  SignalCategory,
  SignalSentiment,
  CandlestickPatterns,
  CandlestickPatternSignal,
  MethodSummary,
  PatternConfidence,
  PriceBehaviorAnalysis,
  SupportResistance,
  TechnicalSetupType,
  TechnicalThesis,
  WyckoffLiteAnalysis,
  WyckoffPhaseGuess,
  TechnicalAnalysisResult,
  TechnicalIndicators,
} from "@/lib/technical-analysis/types";
