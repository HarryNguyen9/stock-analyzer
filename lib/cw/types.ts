export type CoveredWarrantType = "call" | "put";
export type CoveredWarrantRaw = Record<string, unknown>;

export type CoveredWarrantRecord = {
  symbol: string;
  underlyingSymbol: string;
  issuer: string | null;
  type: CoveredWarrantType | string | null;
  strikePrice: number | null;
  exerciseRatio: number | null;
  issueDate: string | null;
  maturityDate: string | null;
  lastPrice: number | null;
  changePercent: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  sxValue: number | null;
  breakEvenPrice: number | null;
  daysToMaturity: number | null;
  isActive: boolean;
  updatedAt: string;
  underlyingPrice: number | null;
  source: string | null;
  raw: CoveredWarrantRaw | null;
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

export type CoveredWarrantProviderDiagnostics = {
  providerName: string;
  fetchedCount: number;
  normalizedCount: number;
  skippedCount: number;
  fetchedHtml?: boolean;
  htmlLength?: number;
  foundSymbolCount?: number;
  sampleRows?: CoveredWarrantRaw[];
  skippedReasons?: string[];
};

export type CoveredWarrantProviderResult = {
  warrants: CoveredWarrantRecord[];
  diagnostics: CoveredWarrantProviderDiagnostics;
};

export type CoveredWarrantProvider = {
  fetchCoveredWarrants: () => Promise<CoveredWarrantProviderResult>;
  fetchCoveredWarrantsByUnderlying: (underlying: string) => Promise<CoveredWarrantProviderResult>;
};
