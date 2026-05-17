import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

const AUTO_SYNC_STALE_MS = 30 * 60 * 1000;
const ON_DEMAND_STALE_MS = 24 * 60 * 60 * 1000;

type SymbolSyncRow = Pick<
  Database["public"]["Tables"]["symbols"]["Row"],
  "symbol" | "auto_sync" | "last_synced_at" | "sync_status"
>;

export type SymbolFreshnessReason =
  | "fresh"
  | "auto-sync-stale"
  | "on-demand-stale"
  | "never-synced"
  | "unknown-symbol"
  | "supabase-error";

export type SymbolFreshness = {
  stale: boolean;
  reason: SymbolFreshnessReason;
  lastUpdated: string | null;
  autoSync: boolean;
  syncStatus: string | null;
};

export function isSymbolDataStale(input: {
  autoSync: boolean;
  lastUpdated: string | null;
  now?: number;
}): Pick<SymbolFreshness, "stale" | "reason" | "lastUpdated"> {
  if (!input.lastUpdated) {
    return {
      stale: true,
      reason: "never-synced",
      lastUpdated: null,
    };
  }

  const updatedAt = new Date(input.lastUpdated).getTime();

  if (!Number.isFinite(updatedAt)) {
    return {
      stale: true,
      reason: "never-synced",
      lastUpdated: input.lastUpdated,
    };
  }

  const ageMs = (input.now ?? Date.now()) - updatedAt;
  const maxAgeMs = input.autoSync ? AUTO_SYNC_STALE_MS : ON_DEMAND_STALE_MS;

  if (ageMs > maxAgeMs) {
    return {
      stale: true,
      reason: input.autoSync ? "auto-sync-stale" : "on-demand-stale",
      lastUpdated: input.lastUpdated,
    };
  }

  return {
    stale: false,
    reason: "fresh",
    lastUpdated: input.lastUpdated,
  };
}

export async function getSymbolFreshness(symbol: string): Promise<SymbolFreshness> {
  try {
    const supabase = createSupabaseAdminClient();
    const normalizedSymbol = symbol.toUpperCase();
    const { data: symbolData, error: symbolError } = await supabase
      .from("symbols")
      .select("symbol,auto_sync,last_synced_at,sync_status")
      .eq("symbol", normalizedSymbol)
      .maybeSingle();

    if (symbolError) {
      throw symbolError;
    }

    if (!symbolData) {
      return {
        stale: true,
        reason: "unknown-symbol",
        lastUpdated: null,
        autoSync: false,
        syncStatus: null,
      };
    }

    const row = symbolData as SymbolSyncRow;
    const lastUpdated = row.last_synced_at;
    const freshness = isSymbolDataStale({
      autoSync: row.auto_sync,
      lastUpdated,
    });

    return {
      ...freshness,
      autoSync: row.auto_sync,
      syncStatus: row.sync_status,
    };
  } catch {
    return {
      stale: false,
      reason: "supabase-error",
      lastUpdated: null,
      autoSync: false,
      syncStatus: null,
    };
  }
}
