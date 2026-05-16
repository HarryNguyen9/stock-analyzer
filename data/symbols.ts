import { vi } from "../lib/i18n/vi";
import type { StockSymbol } from "../types/stock";

export const STOCKS: {
  symbol: StockSymbol;
  name: string;
  exchange: "HOSE" | "HNX" | "UPCOM";
  sector: string;
}[] = [
  { symbol: "FPT", name: vi.stockMeta.names.FPT, exchange: "HOSE", sector: vi.stockMeta.sectors.Technology },
  { symbol: "HPG", name: vi.stockMeta.names.HPG, exchange: "HOSE", sector: vi.stockMeta.sectors.Steel },
  { symbol: "MWG", name: vi.stockMeta.names.MWG, exchange: "HOSE", sector: vi.stockMeta.sectors.Retail },
  { symbol: "VCB", name: vi.stockMeta.names.VCB, exchange: "HOSE", sector: vi.stockMeta.sectors.Banking },
  { symbol: "TCB", name: vi.stockMeta.names.TCB, exchange: "HOSE", sector: vi.stockMeta.sectors.Banking },
  { symbol: "MBB", name: vi.stockMeta.names.MBB, exchange: "HOSE", sector: vi.stockMeta.sectors.Banking },
  { symbol: "ACB", name: vi.stockMeta.names.ACB, exchange: "HOSE", sector: vi.stockMeta.sectors.Banking },
  { symbol: "SSI", name: vi.stockMeta.names.SSI, exchange: "HOSE", sector: vi.stockMeta.sectors.Securities },
  { symbol: "VND", name: vi.stockMeta.names.VND, exchange: "HOSE", sector: vi.stockMeta.sectors.Securities },
  { symbol: "VNM", name: vi.stockMeta.names.VNM, exchange: "HOSE", sector: vi.stockMeta.sectors["Consumer Staples"] },
  { symbol: "GAS", name: vi.stockMeta.names.GAS, exchange: "HOSE", sector: vi.stockMeta.sectors.Energy },
  { symbol: "MSN", name: vi.stockMeta.names.MSN, exchange: "HOSE", sector: vi.stockMeta.sectors.Consumer },
  { symbol: "VIC", name: vi.stockMeta.names.VIC, exchange: "HOSE", sector: vi.stockMeta.sectors["Real Estate"] },
  { symbol: "VHM", name: vi.stockMeta.names.VHM, exchange: "HOSE", sector: vi.stockMeta.sectors["Real Estate"] },
  { symbol: "VRE", name: vi.stockMeta.names.VRE, exchange: "HOSE", sector: vi.stockMeta.sectors["Retail Real Estate"] },
  { symbol: "PVS", name: vi.stockMeta.names.PVS, exchange: "HNX", sector: vi.stockMeta.sectors["Energy Services"] },
  { symbol: "SHS", name: vi.stockMeta.names.SHS, exchange: "HNX", sector: vi.stockMeta.sectors.Securities },
  { symbol: "HUT", name: vi.stockMeta.names.HUT, exchange: "HNX", sector: vi.stockMeta.sectors.Infrastructure },
  { symbol: "BSR", name: vi.stockMeta.names.BSR, exchange: "UPCOM", sector: vi.stockMeta.sectors.Energy },
  { symbol: "ACV", name: vi.stockMeta.names.ACV, exchange: "UPCOM", sector: vi.stockMeta.sectors.Infrastructure },
];

export const STOCK_SYMBOLS = STOCKS.map((stock) => stock.symbol);
