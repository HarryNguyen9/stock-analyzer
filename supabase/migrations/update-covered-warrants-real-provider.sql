alter table public.covered_warrants
  alter column issuer drop not null,
  alter column type drop not null,
  alter column strike_price drop not null,
  alter column exercise_ratio drop not null,
  alter column maturity_date drop not null,
  alter column last_price drop not null,
  alter column volume drop not null;

alter table public.covered_warrants
  add column if not exists source text,
  add column if not exists raw jsonb,
  add column if not exists change_percent numeric,
  add column if not exists underlying_price numeric,
  add column if not exists sx_value numeric,
  add column if not exists break_even_price numeric,
  add column if not exists days_to_maturity int;

create index if not exists covered_warrants_underlying_only_idx
  on public.covered_warrants (underlying_symbol);

create index if not exists covered_warrants_active_only_idx
  on public.covered_warrants (is_active);

create index if not exists covered_warrants_maturity_only_idx
  on public.covered_warrants (maturity_date);
