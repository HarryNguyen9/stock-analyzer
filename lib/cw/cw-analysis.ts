import type { CoveredWarrantWithMetrics } from "@/lib/cw/types";

export type CwBucket = "low" | "medium" | "high" | "unknown";
export type CwRiskLevel = "low" | "medium" | "high";

export type UnderlyingStockData = {
  technicalScore?: number | null;
  trendLabel?: string | null;
};

export type CoveredWarrantRiskCard = {
  title: string;
  description: string;
  level: CwRiskLevel;
};

export type CoveredWarrantAnalysis = {
  distanceToBreakEvenPercent: number | null;
  premiumRankWithinUnderlying: number | null;
  breakEvenRankWithinUnderlying: number | null;
  liquidityRankWithinUnderlying: number | null;
  leverageRankWithinUnderlying: number | null;
  spreadRankWithinUnderlying: number | null;
  daysToMaturityBucket: CwBucket;
  liquidityBucket: CwBucket;
  valuationBucket: CwBucket;
  riskLevel: CwRiskLevel;
  cwScore: number;
  summaryVi: string;
  scoreLabelVi: string;
  riskCards: CoveredWarrantRiskCard[];
};

export function analyzeCoveredWarrant(
  cw: CoveredWarrantWithMetrics,
  peerCws: CoveredWarrantWithMetrics[],
  underlyingStockData?: UnderlyingStockData | null,
): CoveredWarrantAnalysis {
  const peers = peerCws.length > 0 ? peerCws : [cw];
  const distanceToBreakEvenPercent = getDistanceToBreakEvenPercent(cw);
  const premiumRankWithinUnderlying = rankAscending(peers, cw.symbol, (item) => item.metrics.premiumPercent);
  const breakEvenRankWithinUnderlying = rankAscending(peers, cw.symbol, (item) => item.metrics.breakEvenPrice);
  const liquidityRankWithinUnderlying = rankDescending(peers, cw.symbol, (item) => item.volume);
  const leverageRankWithinUnderlying = rankDescending(peers, cw.symbol, (item) => item.metrics.gearing);
  const spreadRankWithinUnderlying = rankAscending(peers, cw.symbol, (item) => item.metrics.spreadPercent);
  const daysToMaturityBucket = getDaysBucket(cw.metrics.daysToMaturity);
  const liquidityBucket = getLiquidityBucket(cw.volume);
  const valuationBucket = getValuationBucket(cw.metrics.premiumPercent, distanceToBreakEvenPercent);
  const riskCards = buildRiskCards(cw, underlyingStockData, distanceToBreakEvenPercent);
  const riskLevel = getRiskLevel(riskCards);
  const cwScore = calculateCwScore(cw, {
    distanceToBreakEvenPercent,
    riskLevel,
    underlyingScore: underlyingStockData?.technicalScore ?? null,
  });

  return {
    distanceToBreakEvenPercent,
    premiumRankWithinUnderlying,
    breakEvenRankWithinUnderlying,
    liquidityRankWithinUnderlying,
    leverageRankWithinUnderlying,
    spreadRankWithinUnderlying,
    daysToMaturityBucket,
    liquidityBucket,
    valuationBucket,
    riskLevel,
    cwScore,
    scoreLabelVi: getScoreLabel(cwScore, riskLevel),
    summaryVi: buildSummary(cw, cwScore, riskLevel, valuationBucket, liquidityBucket, distanceToBreakEvenPercent),
    riskCards,
  };
}

function calculateCwScore(
  cw: CoveredWarrantWithMetrics,
  context: {
    distanceToBreakEvenPercent: number | null;
    riskLevel: CwRiskLevel;
    underlyingScore: number | null;
  },
): number {
  const underlyingComponent = clamp(context.underlyingScore ?? 55, 0, 100);
  const valuationComponent = averageDefined(
    [
      scoreLowerIsBetter(cw.metrics.premiumPercent, 5, 35),
      scoreLowerIsBetter(context.distanceToBreakEvenPercent, 5, 30),
    ],
    50,
  );
  const liquidityComponent = averageDefined(
    [
      scoreHigherIsBetter(cw.volume, 10_000, 500_000),
      scoreLowerIsBetter(cw.metrics.spreadPercent, 2, 18),
    ],
    45,
  );
  const timeComponent = scoreDaysToMaturity(cw.metrics.daysToMaturity);
  const riskPenalty = context.riskLevel === "high" ? 34 : context.riskLevel === "medium" ? 16 : 4;

  return clampInteger(
    underlyingComponent * 0.3 +
      valuationComponent * 0.25 +
      liquidityComponent * 0.2 +
      timeComponent * 0.15 +
      (100 - riskPenalty) * 0.1,
    0,
    100,
  );
}

function buildRiskCards(
  cw: CoveredWarrantWithMetrics,
  underlyingStockData: UnderlyingStockData | null | undefined,
  distanceToBreakEvenPercent: number | null,
): CoveredWarrantRiskCard[] {
  const risks: CoveredWarrantRiskCard[] = [];
  const premium = cw.metrics.premiumPercent;
  const volume = cw.volume ?? 0;
  const days = cw.metrics.daysToMaturity;
  const spread = cw.metrics.spreadPercent;
  const underlyingScore = underlyingStockData?.technicalScore ?? null;

  risks.push({
    title: premium !== null && premium >= 30 ? "Premium cao" : "Premium",
    description:
      premium === null
        ? "Nguồn hiện tại chưa đủ dữ liệu để đánh giá premium."
        : `Premium hiện khoảng ${formatPercent(premium)}, nên so cùng nhóm mã cơ sở trước khi đánh giá.`,
    level: premium === null ? "medium" : premium >= 30 ? "high" : premium >= 18 ? "medium" : "low",
  });

  risks.push({
    title: volume < 10_000 ? "Thanh khoản thấp" : "Thanh khoản",
    description:
      volume <= 0
        ? "Chưa thấy khối lượng giao dịch trong dữ liệu hiện tại."
        : `Khối lượng hiện khoảng ${formatVolume(volume)}, ảnh hưởng trực tiếp tới khả năng vào/ra vị thế.`,
    level: volume <= 0 || volume < 10_000 ? "high" : volume < 100_000 ? "medium" : "low",
  });

  risks.push({
    title: days <= 30 && days > 0 ? "Gần đáo hạn" : "Thời gian còn lại",
    description:
      days > 0
        ? `Còn ${days} ngày đến hạn, thời gian càng ngắn thì rủi ro hao mòn càng nhạy.`
        : "Chưa có dữ liệu ngày đến hạn rõ ràng.",
    level: days <= 0 ? "medium" : days <= 30 ? "high" : days <= 90 ? "medium" : "low",
  });

  risks.push({
    title: spread !== null && spread >= 10 ? "Spread rộng" : "Spread",
    description:
      spread === null ? "Nguồn hiện tại chưa có bid/ask để đo spread." : `Spread ước tính khoảng ${formatPercent(spread)}.`,
    level: spread === null ? "medium" : spread >= 10 ? "high" : spread >= 5 ? "medium" : "low",
  });

  risks.push({
    title: "Mã cơ sở",
    description:
      underlyingScore === null
        ? "Chưa gắn được điểm kỹ thuật mã cơ sở vào phân tích CW này."
        : `Điểm kỹ thuật mã cơ sở khoảng ${Math.round(underlyingScore)}/100, dùng như bối cảnh xu hướng.`,
    level: underlyingScore === null ? "medium" : underlyingScore < 45 ? "high" : underlyingScore < 65 ? "medium" : "low",
  });

  risks.push({
    title: "Khoảng cách hòa vốn",
    description:
      distanceToBreakEvenPercent === null
        ? "Chưa đủ dữ liệu để tính khoảng cách tới hòa vốn."
        : `Mã cơ sở cần thay đổi khoảng ${formatPercent(distanceToBreakEvenPercent)} để chạm vùng hòa vốn.`,
    level:
      distanceToBreakEvenPercent === null
        ? "medium"
        : distanceToBreakEvenPercent >= 25
          ? "high"
          : distanceToBreakEvenPercent >= 12
            ? "medium"
            : "low",
  });

  return risks;
}

function buildSummary(
  cw: CoveredWarrantWithMetrics,
  score: number,
  riskLevel: CwRiskLevel,
  valuationBucket: CwBucket,
  liquidityBucket: CwBucket,
  distanceToBreakEvenPercent: number | null,
): string {
  const parts = [
    `${cw.symbol} có độ hấp dẫn tương đối ${score}/100, thuộc nhóm ${getScoreLabel(score, riskLevel).toLowerCase()}.`,
    valuationBucket === "low"
      ? "Định giá tương đối dễ chịu hơn nhờ premium/khoảng cách hòa vốn thấp."
      : valuationBucket === "high"
        ? "Định giá cần theo dõi vì premium hoặc khoảng cách hòa vốn đang cao."
        : "Định giá ở vùng trung tính so với dữ liệu hiện có.",
    liquidityBucket === "high"
      ? "Thanh khoản đang hỗ trợ khả năng so sánh trong nhóm cùng mã cơ sở."
      : "Cần chú ý thanh khoản trước khi đánh giá sâu hơn.",
  ];

  if (distanceToBreakEvenPercent !== null) {
    parts.push(`Khoảng cách tới hòa vốn khoảng ${formatPercent(distanceToBreakEvenPercent)}.`);
  }

  return parts.slice(0, 3).join(" ");
}

function getDistanceToBreakEvenPercent(cw: CoveredWarrantWithMetrics): number | null {
  const breakEven = cw.metrics.breakEvenPrice;
  const underlying = cw.underlyingPrice;
  if (!breakEven || !underlying) return null;

  return Math.abs((breakEven - underlying) / underlying) * 100;
}

function getDaysBucket(days: number): CwBucket {
  if (!days) return "unknown";
  if (days <= 30) return "high";
  if (days <= 90) return "medium";
  return "low";
}

function getLiquidityBucket(volume: number | null): CwBucket {
  if (volume === null) return "unknown";
  if (volume >= 500_000) return "high";
  if (volume >= 50_000) return "medium";
  return "low";
}

function getValuationBucket(premium: number | null, distance: number | null): CwBucket {
  if (premium === null && distance === null) return "unknown";
  const score = averageDefined([premium, distance], 25);
  if (score <= 8) return "low";
  if (score >= 22) return "high";
  return "medium";
}

function getRiskLevel(risks: CoveredWarrantRiskCard[]): CwRiskLevel {
  const high = risks.filter((risk) => risk.level === "high").length;
  const medium = risks.filter((risk) => risk.level === "medium").length;
  if (high >= 2) return "high";
  if (high >= 1 || medium >= 3) return "medium";
  return "low";
}

function getScoreLabel(score: number, riskLevel: CwRiskLevel): string {
  if (riskLevel === "high") return "Rủi ro cao";
  if (score >= 75) return "Đáng chú ý";
  if (score >= 55) return "Cần theo dõi";
  return "Thận trọng";
}

function scoreDaysToMaturity(days: number): number {
  if (!days) return 45;
  if (days <= 20) return 20;
  if (days <= 45) return 48;
  if (days <= 180) return 88;
  if (days <= 360) return 78;
  return 60;
}

function scoreLowerIsBetter(value: number | null, good: number, poor: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= good) return 100;
  if (value >= poor) return 20;
  return 100 - ((value - good) / (poor - good)) * 80;
}

function scoreHigherIsBetter(value: number | null, poor: number, good: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value >= good) return 100;
  if (value <= poor) return 25;
  return 25 + ((value - poor) / (good - poor)) * 75;
}

function rankAscending(
  peers: CoveredWarrantWithMetrics[],
  symbol: string,
  selector: (item: CoveredWarrantWithMetrics) => number | null,
): number | null {
  return rank(peers, symbol, selector, "asc");
}

function rankDescending(
  peers: CoveredWarrantWithMetrics[],
  symbol: string,
  selector: (item: CoveredWarrantWithMetrics) => number | null,
): number | null {
  return rank(peers, symbol, selector, "desc");
}

function rank(
  peers: CoveredWarrantWithMetrics[],
  symbol: string,
  selector: (item: CoveredWarrantWithMetrics) => number | null,
  direction: "asc" | "desc",
): number | null {
  const sorted = peers
    .filter((item) => selector(item) !== null)
    .sort((a, b) => {
      const diff = (selector(a) ?? 0) - (selector(b) ?? 0);
      return direction === "asc" ? diff : -diff;
    });
  const index = sorted.findIndex((item) => item.symbol === symbol);
  return index >= 0 ? index + 1 : null;
}

function averageDefined(values: Array<number | null>, fallback: number): number {
  const defined = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (defined.length === 0) return fallback;
  return defined.reduce((total, value) => total + value, 0) / defined.length;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}
