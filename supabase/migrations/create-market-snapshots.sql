create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null unique,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_snapshots_snapshot_type_idx
  on public.market_snapshots (snapshot_type);
