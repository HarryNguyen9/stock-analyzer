import { FULL_SYMBOLS_METADATA, type SymbolMetadataSourceItem } from "@/data/full-symbols-metadata";
import { SYMBOL_METADATA_OVERRIDES } from "@/data/symbol-overrides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SymbolRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  sector: string | null;
  metadata_updated_at: string | null;
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
  | "source_exchange_mismatch";

export type SuspiciousSymbol = {
  symbol: string;
  issues: MetadataIssueCode[];
  current: {
    exchange: string | null;
    name: string | null;
    sector: string | null;
    metadataUpdatedAt: string | null;
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
  suspiciousSymbols: SuspiciousSymbol[];
};

const VALID_EXCHANGES = new Set(["HOSE", "HNX", "UPCOM"]);
const METADATA_STALE_DAYS = 30;

export async function auditSymbolMetadata(): Promise<SymbolMetadataAuditResult> {
  const supabase = createSupabaseAdminClient();
  const [symbols, priceRows] = await Promise.all([readSymbols(supabase), readPriceRows(supabase)]);
  const sourceBySymbol = buildSourceMetadataMap();
  const pricesBySymbol = summarizePriceRows(priceRows);
  const suspiciousSymbols: SuspiciousSymbol[] = [];

  for (const symbolRow of symbols) {
    const symbol = symbolRow.symbol.toUpperCase();
    const issues: MetadataIssueCode[] = [];
    const source = sourceBySymbol.get(symbol);
    const priceData = pricesBySymbol.get(symbol);

    if (!symbolRow.exchange || !VALID_EXCHANGES.has(symbolRow.exchange)) {
      issues.push("invalid_exchange");
    }

    if (!symbolRow.name?.trim()) {
      issues.push("missing_name");
    }

    if (!symbolRow.sector?.trim()) {
      issues.push("missing_sector");
    }

    if (!symbolRow.metadata_updated_at) {
      issues.push("missing_metadata_updated_at");
    }

    if (priceData?.latestUpdatedAt && isMetadataStale(symbolRow.metadata_updated_at)) {
      issues.push("metadata_older_than_price_data");
    }

    if (source && source.exchange !== symbolRow.exchange) {
      issues.push("source_exchange_mismatch");
    }

    if (issues.length === 0) {
      continue;
    }

    suspiciousSymbols.push({
      symbol,
      issues,
      current: {
        exchange: symbolRow.exchange,
        name: symbolRow.name,
        sector: symbolRow.sector,
        metadataUpdatedAt: symbolRow.metadata_updated_at,
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
    });
  }

  return {
    total: symbols.length,
    suspiciousCount: suspiciousSymbols.length,
    suspiciousSymbols,
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
    .select("symbol,name,exchange,sector,metadata_updated_at")
    .order("symbol", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SymbolRow[]).map((row) => ({
    ...row,
    symbol: row.symbol.toUpperCase(),
  }));
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
  const sourceBySymbol = new Map<string, SymbolMetadataSourceItem>();

  for (const item of FULL_SYMBOLS_METADATA) {
    const symbol = item.symbol.toUpperCase();
    const override = SYMBOL_METADATA_OVERRIDES[symbol];
    const sourceItem: SymbolMetadataSourceItem = {
      ...item,
      symbol,
      ...(override?.name !== undefined ? { name: override.name } : {}),
      ...(override?.exchange !== undefined ? { exchange: override.exchange } : {}),
      ...(override?.sector !== undefined ? { sector: override.sector } : {}),
      ...(override?.is_active !== undefined ? { isActive: override.is_active } : {}),
    };

    sourceBySymbol.set(symbol, sourceItem);
  }

  return sourceBySymbol;
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
