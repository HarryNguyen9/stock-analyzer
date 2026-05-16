import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateMockOHLCV } from "../lib/data-source/mock-generator";
import type { StockSymbol } from "../types/stock";

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

async function main() {
  const outputDir = path.join(process.cwd(), "data", "prices");
  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const prices = generateMockOHLCV(symbol, 200);
      const filePath = path.join(outputDir, `${symbol}.json`);
      await writeFile(filePath, `${JSON.stringify(prices, null, 2)}\n`, "utf-8");
    }),
  );

  console.log(`Generated ${SYMBOLS.length} local price files in data/prices.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
