export type CoveredWarrantType = "call" | "put";

export type CoveredWarrantRecord = {
  symbol: string;
  underlyingSymbol: string;
  issuer: string;
  type: CoveredWarrantType | string;
  strikePrice: number;
  exerciseRatio: number;
  maturityDate: string;
  lastPrice: number;
  bid: number | null;
  ask: number | null;
  volume: number;
  openInterest: number | null;
  isActive: boolean;
  updatedAt: string;
  underlyingPrice: number | null;
};

export type CoveredWarrantMetrics = {
  daysToMaturity: number;
  breakEvenPrice: number | null;
  intrinsicValue: number | null;
  timeValue: number | null;
  premiumPercent: number | null;
  gearing: number | null;
  effectiveLeverage: number | null;
  spreadPercent: number | null;
};

export type CoveredWarrantWithMetrics = CoveredWarrantRecord & {
  metrics: CoveredWarrantMetrics;
};

