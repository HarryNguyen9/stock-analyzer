import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fallbackProvider } from "../lib/data-source/fallback-provider";
import type { PriceFetchError } from "../lib/data-source/types";
import { vnstockProvider } from "../lib/data-source/vnstock-provider";
import type { OHLCV, StockSymbol } from "../types/stock";

const SYMBOLS: StockSymbol[] = [
  "FPT",
  "HPG",
  "MWG",
  "VCB",
  "TCB",
  "MBB",
  "ACB",
  "SSI",
  "VND",
  "VNM",
  "GAS",
  "MSN",
  "VIC",
  "VHM",
  "VRE",
  "PVS",
  "SHS",
  "HUT",
  "BSR",
  "ACV",
];

const CANDLE_LIMIT = 200;
const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 3_000;

export async function fetchPricesToLocalJson(symbols: string[] = SYMBOLS) {
  const outputDir = path.join(process.cwd(), "data", "prices");
  const errorsPath = path.join(outputDir, "_errors.json");
  const errors: PriceFetchError[] = [];

  await mkdir(outputDir, { recursive: true });

  for (const symbol of symbols) {
    const outputPath = path.join(outputDir, `${symbol}.json`);

    try {
      const prices = await vnstockProvider.getDailyPrices(symbol, CANDLE_LIMIT);
      assertValidPrices(prices, symbol);
      await writePrices(outputPath, prices);
      console.log(`${symbol}: đã tải ${prices.length} nến từ ${vnstockProvider.name}`);
    } catch (error) {
      const keptExistingFile = await fileExists(outputPath);
      const message = error instanceof Error ? error.message : String(error);
      const reason: PriceFetchError["reason"] = "request-error";
      const shortMessage = getShortMessage(message);

      if (!keptExistingFile) {
        const fallbackPrices = await fallbackProvider.getDailyPrices(symbol, CANDLE_LIMIT);
        assertValidPrices(fallbackPrices, symbol);
        await writePrices(outputPath, fallbackPrices);
        console.log(`${symbol}: Fetch fail (${shortMessage}), đã tạo dữ liệu fallback`);
      } else {
        console.log(`${symbol}: Fetch fail (${shortMessage}), đang dùng dữ liệu local hiện có`);
      }

      errors.push({
        symbol,
        provider: vnstockProvider.name,
        reason,
        message: shortMessage,
        at: new Date().toISOString(),
        usedFallback: !keptExistingFile,
        keptExistingFile,
      });
    }

    await delay(randomDelayMs());
  }

  await writeFile(errorsPath, `${JSON.stringify(errors, null, 2)}\n`, "utf-8");
  console.log(`Hoàn tất. ${errors.length} mã được ghi nhận trong data/prices/_errors.json.`);
}

async function writePrices(filePath: string, prices: OHLCV[]) {
  await writeFile(filePath, `${JSON.stringify(prices.slice(-CANDLE_LIMIT), null, 2)}\n`, "utf-8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertValidPrices(prices: OHLCV[], symbol: string) {
  if (prices.length < 2) {
    throw new Error(`${symbol}: dữ liệu không đủ nến`);
  }

  const invalid = prices.find(
    (item) =>
      typeof item.date !== "string" ||
      typeof item.open !== "number" ||
      typeof item.high !== "number" ||
      typeof item.low !== "number" ||
      typeof item.close !== "number" ||
      typeof item.volume !== "number",
  );

  if (invalid) {
    throw new Error(`${symbol}: dữ liệu không đúng schema OHLCV`);
  }
}

function getShortMessage(message: string): string {
  return message.split("\n")[0].slice(0, 140);
}

function randomDelayMs(): number {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  fetchPricesToLocalJson().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
