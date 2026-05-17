alter table public.symbols
  add column if not exists is_active boolean not null default true,
  add column if not exists metadata_updated_at timestamptz;

create index if not exists symbols_is_active_idx
  on public.symbols (is_active);
