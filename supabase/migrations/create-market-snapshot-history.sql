create table if not exists public.market_snapshot_history (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists market_snapshot_history_type_created_idx
  on public.market_snapshot_history (snapshot_type, created_at desc);
