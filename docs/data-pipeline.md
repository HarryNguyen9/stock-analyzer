# Data pipeline

Muc tieu cua pipeline la tach ro route nao duoc phep ghi field nao, tranh overwrite metadata, timeout batch lon, snapshot stale va fallback hardcoded trong production.

## sync-symbol-metadata

- Route: `/api/cron/sync-symbol-metadata`
- Responsibility: cap nhat metadata symbol.
- Duoc update: `symbols.name`, `symbols.exchange`, `symbols.sector`, `symbols.is_active`, `symbols.metadata_updated_at`.
- Khong update: `stock_prices`, `technical_indicators`, `tier`, `auto_sync`, `liquidity_rank` cua symbol da ton tai.
- Source: metadata provider, sau do apply override layer cuoi cung truoc khi upsert.

## refresh-universe

- Route: `/api/cron/refresh-universe`
- Responsibility: tinh liquidity ranking/universe tu `stock_prices` hien co.
- Duoc update: `symbols.liquidity_rank`, `symbols.tier`, `symbols.auto_sync`.
- Khong fetch price, khong update metadata (`name`, `exchange`, `sector`, `is_active`), khong update `stock_prices`.
- Neu khong du price data hop le, job phai giu nguyen universe thay vi tat het `auto_sync`.

## backfill-missing-prices

- Route: `/api/cron/backfill-missing-prices`
- Responsibility: lap historical `stock_prices` cho symbol thieu data.
- Duoc update: `stock_prices`, `technical_indicators`, cac field sync status/error can thiet tren `symbols`.
- Khong update metadata, khong update universe ranking, khong generate snapshot.

## sync-prices

- Route: `/api/cron/sync-prices`
- Responsibility: cap nhat price/indicator/score cho `auto_sync` symbols theo batch nho.
- Duoc update: `stock_prices`, `technical_indicators`, `symbols.last_synced_at`, `symbols.sync_status`, retry/error fields.
- Khong update metadata, khong update `tier`, `auto_sync`, `liquidity_rank`.
- Snapshot chi rebuild khi `updateSnapshot=true` hoac batch `0` mac dinh.

## generate-snapshot

- Service: `lib/pipeline/snapshot.ts`
- Responsibility: doc du lieu tu Supabase de build dashboard/scanner snapshot.
- Duoc update: `market_snapshots`.
- Khong fetch external API, khong update symbol metadata, khong update prices.
- Snapshot phai doc metadata moi nhat tu Supabase `symbols`; fallback static chi dung khi Supabase unavailable/local dev.

## Fallback static

- Local/dev co the fallback ve data static/local JSON khi Supabase loi.
- Production phai log warning neu fallback static duoc dung de tranh stale metadata hoac danh sach symbol hardcoded.
