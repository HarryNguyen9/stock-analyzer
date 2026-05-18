import vnstock from "vnstock-js";
import { FULL_MARKET_SYMBOLS } from "../../data/full-market-symbols";
import type { SymbolMetadataSourceItem } from "../../data/full-symbols-metadata";
import type { StockExchange } from "../../types/stock";

type VnstockListedSymbol = {
  symbol?: string;
  exchange?: string;
  companyName?: string;
  companyShortName?: string;
};

type VnstockIndustryInfo = {
  symbol?: string;
  companyName?: string;
  industry?: string;
  sector?: string;
};

export type LoadedSymbolMetadata = {
  providerName: string;
  source: "provider" | "fallback_static";
  items: SymbolMetadataSourceItem[];
  fallbackUsed: boolean;
  staticFallbackUsed: boolean;
};

export async function loadLatestSymbolMetadata(): Promise<LoadedSymbolMetadata> {
  try {
    const items = await fetchVnstockSymbolMetadata();

    if (items.length === 0) {
      throw new Error("Provider returned zero symbol metadata rows.");
    }

    return {
      providerName: "vnstock-js",
      source: "provider",
      items,
      fallbackUsed: false,
      staticFallbackUsed: false,
    };
  } catch (error) {
    console.warn("sync-symbol-metadata fallback_static: provider metadata fetch failed", {
      providerName: "vnstock-js",
      source: "fallback_static",
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      providerName: "vnstock-js",
      source: "fallback_static",
      items: FULL_MARKET_SYMBOLS,
      fallbackUsed: true,
      staticFallbackUsed: true,
    };
  }
}

async function fetchVnstockSymbolMetadata(): Promise<SymbolMetadataSourceItem[]> {
  const [listedSymbols, industryRows] = await Promise.all([
    vnstock.stock.listing.symbolsByExchange() as Promise<VnstockListedSymbol[]>,
    vnstock.stock.listing.symbolsByIndustries() as Promise<VnstockIndustryInfo[]>,
  ]);
  const industryBySymbol = new Map(
    industryRows
      .map((row) => [normalizeSymbol(row.symbol), row] as const)
      .filter((entry): entry is readonly [string, VnstockIndustryInfo] => entry[0] !== null),
  );

  return listedSymbols
    .map((row) => toSourceItem(row, industryBySymbol.get(normalizeSymbol(row.symbol) ?? "")))
    .filter((item): item is SymbolMetadataSourceItem => item !== null);
}

function toSourceItem(
  listed: VnstockListedSymbol,
  industry: VnstockIndustryInfo | undefined,
): SymbolMetadataSourceItem | null {
  const symbol = normalizeSymbol(listed.symbol);
  const exchange = normalizeExchange(listed.exchange);

  if (!symbol || !exchange) {
    return null;
  }

  return {
    symbol,
    name: cleanText(industry?.companyName) || cleanText(listed.companyName) || cleanText(listed.companyShortName) || symbol,
    exchange,
    sector: cleanText(industry?.industry) || cleanText(industry?.sector) || "Chưa phân ngành",
    isActive: true,
  };
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(symbol) ? symbol : null;
}

function normalizeExchange(value: unknown): StockExchange | null {
  if (typeof value !== "string") {
    return null;
  }

  const exchange = value.trim().toUpperCase();

  if (exchange === "HOSE" || exchange === "HSX") {
    return "HOSE";
  }

  if (exchange === "HNX") {
    return "HNX";
  }

  if (exchange === "UPCOM") {
    return "UPCOM";
  }

  return null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
