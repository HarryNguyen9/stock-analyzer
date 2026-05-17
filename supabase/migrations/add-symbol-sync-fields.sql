alter table public.symbols
  add column if not exists tier text not null default 'C' check (tier in ('A', 'B', 'C')),
  add column if not exists auto_sync boolean not null default false,
  add column if not exists liquidity_rank integer,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_status text;

create index if not exists symbols_auto_sync_tier_liquidity_idx
  on public.symbols(auto_sync, tier, liquidity_rank)
  where auto_sync = true;
