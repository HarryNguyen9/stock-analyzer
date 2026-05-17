import type { Signal } from "@/lib/technical-analysis/types";

export type StockSymbol =
  | "FPT"
  | "HPG"
  | "MWG"
  | "VCB"
  | "TCB"
  | "MBB"
  | "ACB"
  | "SSI"
  | "VND"
  | "VNM"
  | "GAS"
  | "MSN"
  | "VIC"
  | "VHM"
  | "VRE"
  | "PVS"
  | "SHS"
  | "HUT"
  | "BSR"
  | "ACV";

export type StockExchange = "HOSE" | "HNX" | "UPCOM";

export type StockMetadata = {
  symbol: string;
  name: string;
  exchange: StockExchange;
  sector: string;
  tier?: "A" | "B" | "C";
  liquidityRank?: number | null;
};

export type OHLCV = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorSnapshot = {
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  volumeAverage20: number | null;
};

export type SignalTone = "positive" | "neutral" | "warning" | "negative";

export type SignalCardData = {
  title: "Xu hướng" | "Động lượng" | "Khối lượng" | "Rủi ro";
  label: string;
  detail: string;
  tone: SignalTone;
};

export type TechnicalAnalysis = {
  score: number;
  indicators: IndicatorSnapshot;
  signals: SignalCardData[];
  advancedSignals?: Signal[];
  summaryVi?: string;
};

export type StockSummary = {
  symbol: string;
  name: string;
  exchange: StockExchange;
  sector: string;
  tier?: "A" | "B" | "C";
  liquidityRank?: number | null;
  lastClose: number;
  dayChangePercent: number;
  latestDate: string;
  latestVolume: number;
  score: number;
  previousScore?: number;
  status: "Tích cực" | "Trung tính" | "Tiêu cực";
  signal: string;
  topSignals?: Signal[];
  scannerSignals?: Signal[];
  dataStatus: "ready" | "error";
  dataError?: string;
};
