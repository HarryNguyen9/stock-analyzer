import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export type SnapshotHistoryPair = {
  latest: Json | null;
  previous: Json | null;
};

const SNAPSHOT_RETENTION_DAYS = 14;
const SNAPSHOT_HISTORY_LIMIT_PER_TYPE = 120;

export async function recordSnapshotHistory(snapshotType: string, data: Json): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("market_snapshot_history").insert({
      snapshot_type: snapshotType,
      data,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    await pruneSnapshotHistory(snapshotType);
  } catch (error) {
    console.warn("Khong ghi duoc market snapshot history:", { snapshotType, error });
  }
}

export async function readSnapshotHistoryPair(snapshotType: string): Promise<SnapshotHistoryPair> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("market_snapshot_history")
      .select("data,created_at")
      .eq("snapshot_type", snapshotType)
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) {
      throw error;
    }

    return {
      latest: data?.[0]?.data ?? null,
      previous: data?.[1]?.data ?? null,
    };
  } catch (error) {
    console.warn("Khong doc duoc market snapshot history:", { snapshotType, error });
    return { latest: null, previous: null };
  }
}

async function pruneSnapshotHistory(snapshotType: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("market_snapshot_history")
    .delete()
    .eq("snapshot_type", snapshotType)
    .lt("created_at", cutoff);

  const { data } = await supabase
    .from("market_snapshot_history")
    .select("id")
    .eq("snapshot_type", snapshotType)
    .order("created_at", { ascending: false })
    .range(SNAPSHOT_HISTORY_LIMIT_PER_TYPE, SNAPSHOT_HISTORY_LIMIT_PER_TYPE + 200);

  const staleIds = data?.map((row) => row.id) ?? [];

  if (staleIds.length > 0) {
    await supabase.from("market_snapshot_history").delete().in("id", staleIds);
  }
}
