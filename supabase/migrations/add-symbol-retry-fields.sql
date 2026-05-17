alter table public.symbols
  add column if not exists retry_count int not null default 0,
  add column if not exists last_error text,
  add column if not exists next_retry_at timestamptz;

create index if not exists symbols_retry_due_idx
  on public.symbols (sync_status, next_retry_at)
  where sync_status = 'failed';
