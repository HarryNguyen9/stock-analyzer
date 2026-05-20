create table if not exists public.symbols (
  symbol text primary key,
  name text not null,
  exchange text not null check (exchange in ('HOSE', 'HNX', 'UPCOM')),
  sector text not null,
  tier text not null default 'C' check (tier in ('A', 'B', 'C')),
  auto_sync boolean not null default false,
  liquidity_rank integer,
  last_synced_at timestamptz,
  sync_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_prices (
  id bigserial primary key,
  symbol text not null references public.symbols(symbol) on delete cascade,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null,
  is_intraday boolean not null default false,
  finalized boolean not null default true,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(symbol, date)
);

create table if not exists public.technical_indicators (
  id bigserial primary key,
  symbol text not null references public.symbols(symbol) on delete cascade,
  date date not null,
  sma20 numeric,
  sma50 numeric,
  rsi14 numeric,
  volume_average20 numeric,
  technical_score integer check (technical_score between 0 and 100),
  signals jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(symbol, date)
);

create extension if not exists pgcrypto;

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  selected_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  metadata jsonb
);

create index if not exists stock_prices_symbol_date_idx
  on public.stock_prices(symbol, date desc);

create index if not exists technical_indicators_symbol_date_idx
  on public.technical_indicators(symbol, date desc);

create index if not exists symbols_auto_sync_tier_liquidity_idx
  on public.symbols(auto_sync, tier, liquidity_rank)
  where auto_sync = true;

create index if not exists sync_jobs_started_at_idx
  on public.sync_jobs(started_at desc);

create index if not exists sync_jobs_job_type_started_at_idx
  on public.sync_jobs(job_type, started_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists symbols_set_updated_at on public.symbols;
create trigger symbols_set_updated_at
before update on public.symbols
for each row execute function public.set_updated_at();

drop trigger if exists stock_prices_set_updated_at on public.stock_prices;
create trigger stock_prices_set_updated_at
before update on public.stock_prices
for each row execute function public.set_updated_at();

drop trigger if exists technical_indicators_set_updated_at on public.technical_indicators;
create trigger technical_indicators_set_updated_at
before update on public.technical_indicators
for each row execute function public.set_updated_at();

alter table public.symbols enable row level security;
alter table public.stock_prices enable row level security;
alter table public.technical_indicators enable row level security;
alter table public.sync_jobs enable row level security;

drop policy if exists "Allow public read symbols" on public.symbols;
create policy "Allow public read symbols"
on public.symbols for select
using (true);

drop policy if exists "Allow public read stock prices" on public.stock_prices;
create policy "Allow public read stock prices"
on public.stock_prices for select
using (true);

drop policy if exists "Allow public read technical indicators" on public.technical_indicators;
create policy "Allow public read technical indicators"
on public.technical_indicators for select
using (true);
