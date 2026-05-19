import type {
  CoveredWarrantProvider,
  CoveredWarrantProviderResult,
  CoveredWarrantRaw,
  CoveredWarrantRecord,
} from "@/lib/cw/types";

const coveredWarrantUrl = "https://24hmoney.vn/covered-warrant";
const symbolPattern = /^C[A-Z]{2,8}\d{2,}$/;

type ParsedRow = {
  cells: string[];
  rawHtml: string;
};

type ParseResult = {
  warrants: CoveredWarrantRecord[];
  htmlLength: number;
  foundSymbolCount: number;
  skippedReasons: string[];
};

export const twentyFourHMoneyCoveredWarrantProvider: CoveredWarrantProvider = {
  async fetchCoveredWarrants() {
    return fetchTwentyFourHMoneyCoveredWarrants();
  },
  async fetchCoveredWarrantsByUnderlying(underlying: string) {
    const result = await fetchTwentyFourHMoneyCoveredWarrants();
    const normalizedUnderlying = normalizeSymbol(underlying);
    const warrants = result.warrants.filter((warrant) => warrant.underlyingSymbol === normalizedUnderlying);

    return {
      warrants,
      diagnostics: {
        ...result.diagnostics,
        normalizedCount: warrants.length,
      },
    };
  },
};

export async function fetchTwentyFourHMoneyCoveredWarrants(): Promise<CoveredWarrantProviderResult> {
  const response = await fetch(coveredWarrantUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 stock-analyzer covered-warrant-sync",
    },
    cache: "no-store",
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`24HMoney CW fetch failed: ${response.status} - ${html.slice(0, 240)}`);
  }

  const parsed = parseTwentyFourHMoneyCoveredWarrants(html);

  if (parsed.warrants.length === 0) {
    throw new TwentyFourHMoneyParseError("Unable to parse 24HMoney CW table", parsed.htmlLength, parsed.foundSymbolCount);
  }

  return {
    warrants: parsed.warrants,
    diagnostics: {
      providerName: "24hmoney",
      fetchedCount: parsed.foundSymbolCount,
      normalizedCount: parsed.warrants.length,
      skippedCount: parsed.skippedReasons.length,
      fetchedHtml: true,
      htmlLength: parsed.htmlLength,
      foundSymbolCount: parsed.foundSymbolCount,
      sampleRows: parsed.warrants.slice(0, 3).map((warrant) => warrant.raw).filter(Boolean) as CoveredWarrantRaw[],
      skippedReasons: parsed.skippedReasons.slice(0, 20),
    },
  };
}

export function parseTwentyFourHMoneyCoveredWarrants(html: string): ParseResult {
  const rows = extractRows(html);
  const warrants: CoveredWarrantRecord[] = [];
  const skippedReasons: string[] = [];
  let foundSymbolCount = 0;

  for (const row of rows) {
    const symbol = extractCoveredWarrantSymbol(row.cells[0] ?? row.rawHtml);
    if (!symbolPattern.test(symbol)) continue;

    foundSymbolCount += 1;
    const underlyingSymbol = inferUnderlyingSymbol(symbol);

    if (!underlyingSymbol) {
      skippedReasons.push(`${symbol}: unable to infer underlying`);
      continue;
    }

    if (row.cells.length < 9) {
      skippedReasons.push(`${symbol}: expected 9 columns, got ${row.cells.length}`);
      continue;
    }

    warrants.push({
      symbol,
      underlyingSymbol,
      issuer: normalizeIssuer(row.cells[7]),
      type: "call",
      strikePrice: null,
      exerciseRatio: null,
      maturityDate: null,
      lastPrice: parseNumber(row.cells[1]),
      changePercent: parseNumber(row.cells[2]),
      bid: null,
      ask: null,
      volume: parseNumber(row.cells[3]),
      openInterest: null,
      underlyingPrice: parseNumber(row.cells[4]),
      sxValue: parseNumber(row.cells[5]),
      breakEvenPrice: parseNumber(row.cells[6]),
      daysToMaturity: parseNumber(row.cells[8]),
      isActive: true,
      updatedAt: new Date().toISOString(),
      source: "24hmoney",
      raw: {
        cells: row.cells,
        rawHtml: row.rawHtml.slice(0, 2_000),
      },
    });
  }

  return {
    warrants,
    htmlLength: html.length,
    foundSymbolCount,
    skippedReasons,
  };
}

export class TwentyFourHMoneyParseError extends Error {
  constructor(message: string, readonly htmlLength: number, readonly foundSymbolCount: number) {
    super(message);
  }
}

function extractRows(html: string): ParsedRow[] {
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => {
      const rawHtml = match[0];
      const cells = [...rawHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => cleanCell(cell[1]))
        .filter(Boolean);

      return { cells, rawHtml };
    })
    .filter((row) => row.cells.length > 0);

  if (rows.length > 0) return rows;

  return extractTextRows(html);
}

function extractTextRows(html: string): ParsedRow[] {
  const text = cleanCell(html).replace(/\s+/g, " ");
  const matches = [...text.matchAll(/\bC[A-Z]{2,8}\d{2,}\b/g)];
  const rows: ParsedRow[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? Math.min(text.length, start + 500);
    const chunk = text.slice(start, end).trim();
    const cells = buildCellsFromTextRow(chunk);

    if (cells.length > 0) {
      rows.push({ cells, rawHtml: chunk });
    }
  }

  return rows;
}

function buildCellsFromTextRow(chunk: string): string[] {
  const symbol = extractCoveredWarrantSymbol(chunk);
  if (!symbol) return [];

  const tokens = chunk.replace(symbol, ` ${symbol} `).split(/\s+/).map(cleanCell).filter(Boolean);
  const symbolIndex = tokens.findIndex((token) => extractCoveredWarrantSymbol(token) === symbol);
  const rowTokens = symbolIndex >= 0 ? tokens.slice(symbolIndex) : tokens;

  if (rowTokens.length < 8) return [symbol];

  const daysToMaturity = rowTokens[rowTokens.length - 1] ?? "";
  const issuer = rowTokens.slice(7, -1).join(" ");

  return [
    symbol,
    rowTokens[1] ?? "",
    rowTokens[2] ?? "",
    rowTokens[3] ?? "",
    rowTokens[4] ?? "",
    rowTokens[5] ?? "",
    rowTokens[6] ?? "",
    issuer,
    daysToMaturity,
  ];
}

function extractCoveredWarrantSymbol(value: string): string {
  return normalizeSymbol(value).match(/C[A-Z]{2,8}\d{2,}/)?.[0] ?? "";
}

function inferUnderlyingSymbol(symbol: string): string | null {
  const match = symbol.match(/^C([A-Z]+)\d+$/);
  return match?.[1] ?? null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/--|—|-/g, (match) => (match === "-" && /-\d/.test(value) ? "-" : ""))
    .replace(/%/g, "")
    .replace(/,/g, "")
    .trim();

  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIssuer(value: string | undefined): string | null {
  const normalized = cleanCell(value ?? "");
  return normalized || null;
}

function cleanCell(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}
