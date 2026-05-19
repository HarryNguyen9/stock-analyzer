import type {
  CoveredWarrantProvider,
  CoveredWarrantProviderResult,
  CoveredWarrantRaw,
  CoveredWarrantRecord,
} from "@/lib/cw/types";

const defaultEndpoint = "/covered-warrants";

export const dnseCoveredWarrantProvider: CoveredWarrantProvider = {
  async fetchCoveredWarrants() {
    return fetchDnseCoveredWarrants();
  },
  async fetchCoveredWarrantsByUnderlying(underlying: string) {
    const result = await fetchDnseCoveredWarrants();
    const normalizedUnderlying = normalizeText(underlying);

    return {
      warrants: result.warrants.filter((warrant) => warrant.underlyingSymbol === normalizedUnderlying),
      diagnostics: {
        ...result.diagnostics,
        normalizedCount: result.warrants.filter((warrant) => warrant.underlyingSymbol === normalizedUnderlying).length,
      },
    };
  },
};

export function getCoveredWarrantProvider(): CoveredWarrantProvider {
  const provider = process.env.CW_PROVIDER?.trim().toLowerCase() || "dnse";

  if (provider !== "dnse") {
    throw new Error(`Unsupported CW_PROVIDER: ${provider}`);
  }

  return dnseCoveredWarrantProvider;
}

export async function fetchDnseCoveredWarrants(): Promise<CoveredWarrantProviderResult> {
  const baseUrl = process.env.DNSE_API_BASE_URL?.trim();
  const token = process.env.DNSE_API_TOKEN?.trim();
  const endpoint = process.env.DNSE_CW_ENDPOINT?.trim() || defaultEndpoint;

  if (!baseUrl || !token) {
    throw new Error("DNSE CW provider is not configured");
  }

  const url = new URL(endpoint, ensureTrailingSlash(baseUrl));
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DNSE CW provider failed: ${response.status}${body ? ` - ${body.slice(0, 240)}` : ""}`);
  }

  const payload = await response.json() as unknown;
  const rawItems = extractArrayPayload(payload);
  const warrants: CoveredWarrantRecord[] = [];

  for (const item of rawItems) {
    const normalized = normalizeDnseCoveredWarrant(item);
    if (normalized) warrants.push(normalized);
  }

  return {
    warrants,
    diagnostics: {
      providerName: "dnse",
      fetchedCount: rawItems.length,
      normalizedCount: warrants.length,
      skippedCount: rawItems.length - warrants.length,
    },
  };
}

export function normalizeDnseCoveredWarrant(raw: unknown): CoveredWarrantRecord | null {
  if (!isRecord(raw)) return null;

  const symbol = normalizeText(readString(raw, ["symbol", "code", "ticker"]));
  const underlyingSymbol = normalizeText(readString(raw, ["underlyingSymbol", "underlying", "underlying_symbol", "underlyingCode"]));

  if (!symbol || !underlyingSymbol) return null;

  return {
    symbol,
    underlyingSymbol,
    issuer: readString(raw, ["issuer", "issuerName", "issuer_name"]),
    type: normalizeWarrantType(readString(raw, ["type", "warrantType", "warrant_type"])),
    strikePrice: readNumber(raw, ["strikePrice", "exercisePrice", "strike_price", "exercise_price"]),
    exerciseRatio: readNumber(raw, ["exerciseRatio", "ratio", "exercise_ratio"]),
    maturityDate: normalizeDate(readString(raw, ["maturityDate", "expiryDate", "maturity_date", "expiry_date"])),
    lastPrice: readNumber(raw, ["lastPrice", "price", "close", "last_price"]),
    bid: readNumber(raw, ["bid", "bestBid", "best_bid"]),
    ask: readNumber(raw, ["ask", "bestAsk", "best_ask"]),
    volume: readNumber(raw, ["volume", "totalVolume", "total_volume"]),
    openInterest: readNumber(raw, ["openInterest", "open_interest"]),
    isActive: readBoolean(raw, ["isActive", "is_active", "active"]) ?? true,
    updatedAt: new Date().toISOString(),
    underlyingPrice: null,
    source: "dnse",
    raw: raw as CoveredWarrantRaw,
  };
}

function extractArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of ["data", "items", "results", "warrants", "coveredWarrants", "covered_warrants"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      for (const nestedKey of ["items", "data", "results"]) {
        const nestedValue = value[nestedKey];
        if (Array.isArray(nestedValue)) return nestedValue;
      }
    }
  }

  return [];
}

function readString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return null;
}

function readNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function readBoolean(raw: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "active", "listed"].includes(normalized)) return true;
      if (["false", "0", "inactive", "delisted"].includes(normalized)) return false;
    }
  }

  return null;
}

function normalizeText(value: string | null): string {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

function normalizeWarrantType(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["c", "call", "mua"].includes(normalized)) return "call";
  if (["p", "put", "ban", "bán"].includes(normalized)) return "put";
  return value.trim();
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

