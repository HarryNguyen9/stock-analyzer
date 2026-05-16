import { pathToFileURL } from "node:url";
import { fetchPricesToLocalJson } from "./fetch-prices";
import { importJsonToSupabase } from "./import-json-to-supabase";

export async function syncPricesToSupabase(): Promise<{ synced: number }> {
  console.log("Sync buoc 1/2: fetch du lieu moi va cap nhat JSON local...");
  await fetchPricesToLocalJson();

  console.log("Sync buoc 2/2: upsert du lieu JSON vao Supabase...");
  const { importedSymbols } = await importJsonToSupabase();

  console.log(`Sync hoan tat. Da cap nhat ${importedSymbols} ma.`);
  return { synced: importedSymbols };
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  syncPricesToSupabase().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
