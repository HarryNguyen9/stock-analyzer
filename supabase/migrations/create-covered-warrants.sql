create table if not exists public.covered_warrants (
  symbol text primary key,
  underlying_symbol text not null,
  issuer text,
  type text,
  strike_price numeric,
  exercise_ratio numeric,
  maturity_date date,
  last_price numeric,
  change_percent numeric,
  bid numeric,
  ask numeric,
  volume numeric,
  open_interest numeric,
  underlying_price numeric,
  sx_value numeric,
  break_even_price numeric,
  days_to_maturity int,
  is_active boolean not null default true,
  source text,
  raw jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists covered_warrants_underlying_idx
  on public.covered_warrants (underlying_symbol);

create index if not exists covered_warrants_active_idx
  on public.covered_warrants (is_active);

create index if not exists covered_warrants_maturity_idx
  on public.covered_warrants (maturity_date);
