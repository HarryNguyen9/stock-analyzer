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
    const warrants = await enrichWarrantsWithDetails(
      result.warrants.filter((warrant) => warrant.underlyingSymbol === normalizedUnderlying),
    );

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

    const lastPrice = parseNumber(row.cells[1]);
    const underlyingPrice = parseNumber(row.cells[4]);
    const sxValue = parseNumber(row.cells[5]);
    const breakEvenPrice = parseNumber(row.cells[6]);
    const strikePrice = deriveCallStrikePrice(underlyingPrice, sxValue);
    const exerciseRatio = deriveCallExerciseRatio(lastPrice, breakEvenPrice, strikePrice);

    warrants.push({
      symbol,
      underlyingSymbol,
      issuer: normalizeIssuer(row.cells[7]),
      type: "call",
      strikePrice,
      exerciseRatio,
      issueDate: null,
      maturityDate: null,
      lastPrice,
      changePercent: parseNumber(row.cells[2]),
      bid: null,
      ask: null,
      volume: parseNumber(row.cells[3]),
      openInterest: null,
      underlyingPrice,
      sxValue,
      breakEvenPrice,
      daysToMaturity: parseNumber(row.cells[8]),
      isActive: true,
      updatedAt: new Date().toISOString(),
      source: "24hmoney",
      raw: {
        cells: row.cells,
        rawHtml: row.rawHtml.slice(0, 2_000),
        sourcePage: coveredWarrantUrl,
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

type DetailFields = Partial<Pick<CoveredWarrantRecord, "issueDate" | "maturityDate" | "strikePrice" | "exerciseRatio">> & {
  rawDetail?: CoveredWarrantRaw;
};

async function enrichWarrantsWithDetails(warrants: CoveredWarrantRecord[]): Promise<CoveredWarrantRecord[]> {
  const enriched: CoveredWarrantRecord[] = [];

  for (const warrant of warrants) {
    try {
      const details = await fetchTwentyFourHMoneyWarrantDetail(warrant.symbol);
      enriched.push(mergeWarrantDetails(warrant, details));
    } catch (error) {
      console.warn("Khong doc duoc chi tiet CW tu 24HMoney:", {
        symbol: warrant.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      enriched.push(warrant);
    }
  }

  return enriched;
}

async function fetchTwentyFourHMoneyWarrantDetail(symbol: string): Promise<DetailFields> {
  const detailUrl = `${coveredWarrantUrl}/${encodeURIComponent(symbol)}`;
  const response = await fetch(detailUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 stock-analyzer covered-warrant-detail",
    },
    cache: "no-store",
  });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`24HMoney CW detail fetch failed: ${response.status} - ${html.slice(0, 180)}`);
  }

  return parseTwentyFourHMoneyWarrantDetail(html, detailUrl);
}

function parseTwentyFourHMoneyWarrantDetail(html: string, detailUrl: string): DetailFields {
  const text = cleanCell(html).replace(/\s+/g, " ");
  const exerciseRatioText = readLabelValue(text, "Tỷ lệ chuyển đổi");

  return {
    issueDate: normalizeDate(readLabelValue(text, "Ngày phát hành")),
    maturityDate: normalizeDate(readLabelValue(text, "Ngày đáo hạn")),
    strikePrice: parseNumber(readLabelValue(text, "Giá thực hiện") ?? undefined),
    exerciseRatio: parseExerciseRatio(exerciseRatioText),
    rawDetail: {
      sourcePage: detailUrl,
      issueDateText: readLabelValue(text, "Ngày phát hành"),
      maturityDateText: readLabelValue(text, "Ngày đáo hạn"),
      exerciseRatioText,
      strikePriceText: readLabelValue(text, "Giá thực hiện"),
    },
  };
}

function mergeWarrantDetails(warrant: CoveredWarrantRecord, details: DetailFields): CoveredWarrantRecord {
  return {
    ...warrant,
    issueDate: details.issueDate ?? warrant.issueDate,
    maturityDate: details.maturityDate ?? warrant.maturityDate,
    strikePrice: details.strikePrice ?? warrant.strikePrice,
    exerciseRatio: details.exerciseRatio ?? warrant.exerciseRatio,
    raw: {
      ...(warrant.raw ?? {}),
      detail: details.rawDetail ?? null,
    },
  };
}

function readLabelValue(text: string, label: string): string | null {
  const labels = [
    "CK cơ sở",
    "Tổ chức phát hành CKCS",
    "Tổ chức phát hành CW",
    "Loại chứng quyền",
    "Kiểu thực hiện",
    "Phương thức thực hiện quyền",
    "Thời hạn",
    "Ngày phát hành",
    "Ngày niêm yết",
    "Ngày giao dịch đầu tiên",
    "Ngày giao dịch cuối cùng",
    "Ngày đáo hạn",
    "Tỷ lệ chuyển đổi",
    "Giá phát hành",
    "Giá thực hiện",
    "Khối lượng Niêm yết",
    "Khối lượng lưu hành",
    "Giá CK cơ sở",
    "KLCPLH",
    "Số ngày đến hạn",
    "Hòa vốn",
    "S-X",
  ];
  const start = text.indexOf(label);
  if (start < 0) return null;

  const valueStart = start + label.length;
  const nextIndex = labels
    .filter((item) => item !== label)
    .map((item) => text.indexOf(item, valueStart))
    .filter((index) => index > valueStart)
    .sort((a, b) => a - b)[0] ?? text.length;
  const value = text.slice(valueStart, nextIndex).trim();

  return value || null;
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseExerciseRatio(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return parseNumber(value);
  const numerator = Number(match[1].replace(",", "."));
  const denominator = Number(match[2].replace(",", "."));
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return roundMetric(numerator / denominator);
}

function deriveCallStrikePrice(underlyingPrice: number | null, sxValue: number | null): number | null {
  if (underlyingPrice === null || sxValue === null) return null;
  const strikePrice = underlyingPrice - sxValue;
  return Number.isFinite(strikePrice) && strikePrice > 0 ? roundMetric(strikePrice) : null;
}

function deriveCallExerciseRatio(
  lastPrice: number | null,
  breakEvenPrice: number | null,
  strikePrice: number | null,
): number | null {
  if (lastPrice === null || lastPrice <= 0 || breakEvenPrice === null || strikePrice === null) return null;
  const ratio = (breakEvenPrice - strikePrice) / lastPrice;
  return Number.isFinite(ratio) && ratio > 0 ? roundMetric(ratio) : null;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
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
