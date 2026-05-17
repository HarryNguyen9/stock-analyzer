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

create index if not exists sync_jobs_started_at_idx
  on public.sync_jobs(started_at desc);

create index if not exists sync_jobs_job_type_started_at_idx
  on public.sync_jobs(job_type, started_at desc);

alter table public.sync_jobs enable row level security;
