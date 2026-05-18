alter table public.symbols
  add column if not exists unsupported_at timestamptz,
  add column if not exists unsupported_reason text;

create index if not exists symbols_sync_status_idx on public.symbols(sync_status);
create index if not exists symbols_is_active_idx on public.symbols(is_active);
