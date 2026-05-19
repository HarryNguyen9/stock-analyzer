create table if not exists public.covered_warrants (
  symbol text primary key,
  underlying_symbol text not null,
  issuer text not null,
  type text not null default 'call',
  strike_price numeric not null,
  exercise_ratio numeric not null,
  maturity_date date not null,
  last_price numeric not null,
  bid numeric,
  ask numeric,
  volume numeric not null default 0,
  open_interest numeric,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists covered_warrants_underlying_idx
  on public.covered_warrants (underlying_symbol, is_active, maturity_date);