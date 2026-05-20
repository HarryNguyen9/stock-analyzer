alter table public.stock_prices
  add column if not exists is_intraday boolean not null default false,
  add column if not exists finalized boolean not null default true,
  add column if not exists source text;

update public.stock_prices
set finalized = true,
    is_intraday = false
where finalized is distinct from true
   or is_intraday is distinct from false;

create index if not exists stock_prices_intraday_idx
  on public.stock_prices(symbol, date, is_intraday, finalized);
