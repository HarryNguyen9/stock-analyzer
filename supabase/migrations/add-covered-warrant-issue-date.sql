alter table public.covered_warrants
  add column if not exists issue_date date;
