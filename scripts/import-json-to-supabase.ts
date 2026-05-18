import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { STOCKS } from "../data/symbols";
import { analyzeTechnical } from "../lib/analysis";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { Database, Json } from "../lib/supabase/types";
import type { OHLCV } from "../types/stock";

type SymbolInsert = Database["public"]["Tables"]["symbols"]["Insert"];
type StockPriceInsert = Database["public"]["Tables"]["stock_prices"]["Insert"];
type IndicatorInsert = Database["public"]["Tables"]["technical_indicators"]["Insert"];

const BATCH_SIZE = 500;

type PriceSet = {
  symbol: string;
  prices: OHLCV[];
};

export async function importJsonToSupabase(symbols?: string[]): Promise<{ importedSymbols: number }> {
  loadEnvConfig(process.cwd());

  const symbolFilter = symbols ? new Set(symbols.map((symbol) => symbol.toUpperCase())) : null;
  const pricesDir = path.join(process.cwd(), "data", "prices");
  const files = (await readdir(pricesDir))
    .filter((file) => file.endsWith(".json") && file !== "_errors.json")
    .filter((file) => !symbolFilter || symbolFilter.has(file.replace(".json", "").toUpperCase()))
    .sort();

  const priceSets: PriceSet[] = [];

  for (const file of files) {
    const symbol = file.replace(".json", "");
    const filePath = path.join(pricesDir, file);
    const prices = parsePrices(await readFile(filePath, "utf-8"));

    priceSets.push({ symbol, prices });
  }

  return upsertPriceSetsToSupabase(priceSets);
}

export async function upsertPriceSetsToSupabase(
  priceSets: PriceSet[],
  options: { upsertSymbols?: boolean } = {},
): Promise<{ importedSymbols: number }> {
  const supabase = createSupabaseAdminClient();
  const shouldUpsertSymbols = options.upsertSymbols ?? true;

  if (shouldUpsertSymbols) {
    const { data: existingSymbols, error: existingSymbolsError } = await supabase.from("symbols").select("symbol");

    if (existingSymbolsError) {
      throw existingSymbolsError;
    }

    const existing = new Set((existingSymbols ?? []).map((row) => row.symbol));
    const symbolRows: SymbolInsert[] = STOCKS.filter((stock) => !existing.has(stock.symbol)).map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sector: stock.sector,
    }));

    if (symbolRows.length > 0) {
      const { error: symbolsError } = await supabase.from("symbols").insert(symbolRows);

      if (symbolsError) {
        throw symbolsError;
      }
    }

    console.log(`Insert missing symbols only: ${symbolRows.length}`);
  }
  let importedSymbols = 0;

  for (const { symbol, prices } of priceSets) {
    if (prices.length === 0) {
      console.log(`${symbol}: bo qua vi file rong hoac sai format`);
      continue;
    }

    const priceRows: StockPriceInsert[] = prices.map((price) => ({
      symbol,
      date: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
    }));

    for (let index = 0; index < priceRows.length; index += BATCH_SIZE) {
      const batch = priceRows.slice(index, index + BATCH_SIZE);
      const { error } = await supabase.from("stock_prices").upsert(batch, {
        onConflict: "symbol,date",
      });

      if (error) {
        throw error;
      }
    }

    const latest = prices[prices.length - 1];
    const analysis = analyzeTechnical(prices);
    const indicatorRow: IndicatorInsert = {
      symbol,
      date: latest.date,
      sma20: analysis.indicators.sma20,
      sma50: analysis.indicators.sma50,
      rsi14: analysis.indicators.rsi14,
      volume_average20: analysis.indicators.volumeAverage20,
      technical_score: analysis.score,
      signals: (analysis.advancedSignals ?? analysis.signals) as unknown as Json,
    };

    const { error: indicatorError } = await supabase
      .from("technical_indicators")
      .upsert(indicatorRow, { onConflict: "symbol,date" });

    if (indicatorError) {
      throw indicatorError;
    }

    console.log(`${symbol}: import ${priceRows.length} dong gia, cap nhat chi bao ${latest.date}`);
    importedSymbols += 1;
  }

  return { importedSymbols };
}

function parsePrices(content: string): OHLCV[] {
  const parsed: unknown = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isOHLCV);
}

function isOHLCV(value: unknown): value is OHLCV {
  return (
    typeof value === "object" &&
    value !== null &&
    "date" in value &&
    "open" in value &&
    "high" in value &&
    "low" in value &&
    "close" in value &&
    "volume" in value &&
    typeof value.date === "string" &&
    typeof value.open === "number" &&
    typeof value.high === "number" &&
    typeof value.low === "number" &&
    typeof value.close === "number" &&
    typeof value.volume === "number"
  );
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  importJsonToSupabase().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
