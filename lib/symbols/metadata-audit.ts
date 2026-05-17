import { FULL_SYMBOLS_METADATA, type SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildFinalSymbolMetadataMap } from "@/lib/symbols/metadata-normalize";

type SymbolRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  sector: string | null;
  metadata_updated_at: string | null;
  is_active: boolean | null;
  auto_sync: boolean | null;
};
type PriceRow = {
  symbol: string;
  updated_at: string;
};

type MetadataIssueCode =
  | "invalid_exchange"
  | "missing_name"
  | "missing_sector"
  | "missing_metadata_updated_at"
  | "metadata_older_than_price_data"
  | "source_exchange_mismatch"
  | "inactive_auto_sync"
  | "inactive_with_price_data";

type MetadataIssueSeverity = "critical" | "warning" | "info";

export type SuspiciousSymbol = {
  symbol: string;
  issues: Array<{
    code: MetadataIssueCode;
    severity: MetadataIssueSeverity;
  }>;
  current: {
    exchange: string | null;
    name: string | null;
    sector: string | null;
    metadataUpdatedAt: string | null;
    isActive: boolean | null;
    autoSync: boolean | null;
  };
  source?: {
    exchange: string;
    name: string;
    sector: string;
  };
  priceData?: {
    rows: number;
    latestUpdatedAt: string | null;
  };
};

export type SymbolMetadataAuditResult = {
  total: number;
  suspiciousCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issueSummary: Record<MetadataIssueCode, number>;
  suspiciousSymbols: SuspiciousSymbol[];
  infoSymbols: SuspiciousSymbol[];
};

const VALID_EXCHANGES = new Set(["HOSE", "HNX", "UPCOM"]);
const METADATA_STALE_DAYS = 30;

export async function auditSymbolMetadata(): Promise<SymbolMetadataAuditResult> {
  const supabase = createSupabaseAdminClient();
  const [symbols, priceRows] = await Promise.all([readSymbols(supabase), readPriceRows(supabase)]);
  const sourceBySymbol = buildSourceMetadataMap();
  const pricesBySymbol = summarizePriceRows(priceRows);
  const suspiciousSymbols: SuspiciousSymbol[] = [];
  const infoSymbols: SuspiciousSymbol[] = [];
  const issueSummary = createEmptyIssueSummary();
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const symbolRow of symbols) {
    const symbol = symbolRow.symbol.toUpperCase();
    const issues: SuspiciousSymbol["issues"] = [];
    const source = sourceBySymbol.get(symbol);
    const priceData = pricesBySymbol.get(symbol);

    if (!symbolRow.exchange || !VALID_EXCHANGES.has(symbolRow.exchange)) {
      issues.push({ code: "invalid_exchange", severity: "critical" });
    }

    if (!symbolRow.name?.trim()) {
      issues.push({ code: "missing_name", severity: "critical" });
    }

    if (!symbolRow.sector?.trim()) {
      issues.push({ code: "missing_sector", severity: "warning" });
    }

    if (!symbolRow.metadata_updated_at) {
      issues.push({ code: "missing_metadata_updated_at", severity: "info" });
    }

    if (priceData?.latestUpdatedAt && isMetadataStale(symbolRow.metadata_updated_at)) {
      issues.push({ code: "metadata_older_than_price_data", severity: "info" });
    }

    if (source && source.exchange !== symbolRow.exchange) {
      issues.push({ code: "source_exchange_mismatch", severity: "warning" });
    }

    if (symbolRow.is_active === false && symbolRow.auto_sync === true) {
      issues.push({ code: "inactive_auto_sync", severity: "critical" });
    }

    if (symbolRow.is_active === false && priceData && priceData.rows > 0) {
      issues.push({ code: "inactive_with_price_data", severity: "warning" });
    }

    if (issues.length === 0) {
      continue;
    }

    for (const issue of issues) {
      issueSummary[issue.code] += 1;

      if (issue.severity === "critical") criticalCount += 1;
      if (issue.severity === "warning") warningCount += 1;
      if (issue.severity === "info") infoCount += 1;
    }

    const auditItem: SuspiciousSymbol = {
      symbol,
      issues,
      current: {
        exchange: symbolRow.exchange,
        name: symbolRow.name,
        sector: symbolRow.sector,
        metadataUpdatedAt: symbolRow.metadata_updated_at,
        isActive: symbolRow.is_active,
        autoSync: symbolRow.auto_sync,
      },
      ...(source
        ? {
            source: {
              exchange: source.exchange,
              name: source.name,
              sector: source.sector,
            },
          }
        : {}),
      ...(priceData
        ? {
            priceData: {
              rows: priceData.rows,
              latestUpdatedAt: priceData.latestUpdatedAt,
            },
          }
        : {}),
    };

    if (issues.some((issue) => issue.severity === "critical" || issue.severity === "warning")) {
      suspiciousSymbols.push(auditItem);
    } else if (infoSymbols.length < 20) {
      infoSymbols.push(auditItem);
    }
  }

  return {
    total: symbols.length,
    suspiciousCount: suspiciousSymbols.length,
    criticalCount,
    warningCount,
    infoCount,
    issueSummary,
    suspiciousSymbols,
    infoSymbols,
  };
}

function isMetadataStale(metadataUpdatedAt: string | null): boolean {
  if (!metadataUpdatedAt) {
    return false;
  }

  const updatedAtMs = new Date(metadataUpdatedAt).getTime();

  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }

  return Date.now() - updatedAtMs > METADATA_STALE_DAYS * 24 * 60 * 60 * 1000;
}

async function readSymbols(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<SymbolRow[]> {
  const { data, error } = await supabase
    .from("symbols")
    .select("symbol,name,exchange,sector,metadata_updated_at,is_active,auto_sync")
    .order("symbol", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SymbolRow[]).map((row) => ({
    ...row,
    symbol: row.symbol.toUpperCase(),
  }));
}

function createEmptyIssueSummary(): Record<MetadataIssueCode, number> {
  return {
    invalid_exchange: 0,
    missing_name: 0,
    missing_sector: 0,
    missing_metadata_updated_at: 0,
    metadata_older_than_price_data: 0,
    source_exchange_mismatch: 0,
    inactive_auto_sync: 0,
    inactive_with_price_data: 0,
  };
}

async function readPriceRows(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<PriceRow[]> {
  const { data, error } = await supabase.from("stock_prices").select("symbol,updated_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as PriceRow[]).map((row) => ({
    ...row,
    symbol: row.symbol.toUpperCase(),
  }));
}

function buildSourceMetadataMap(): Map<string, SymbolMetadataSourceItem> {
  return buildFinalSymbolMetadataMap(FULL_SYMBOLS_METADATA);
}

function summarizePriceRows(priceRows: PriceRow[]): Map<string, { rows: number; latestUpdatedAt: string | null }> {
  const pricesBySymbol = new Map<string, { rows: number; latestUpdatedAt: string | null }>();

  for (const row of priceRows) {
    const current = pricesBySymbol.get(row.symbol) ?? { rows: 0, latestUpdatedAt: null };
    const latestUpdatedAt =
      current.latestUpdatedAt && current.latestUpdatedAt > row.updated_at ? current.latestUpdatedAt : row.updated_at;

    pricesBySymbol.set(row.symbol, {
      rows: current.rows + 1,
      latestUpdatedAt,
    });
  }

  return pricesBySymbol;
}
