-- Soft delete for service records so history stays visible in reports.
-- Run this after supabase/dashboard_core.sql.

alter table public.service_records
  add column if not exists deleted_at timestamptz;

create index if not exists service_records_deleted_at_idx
  on public.service_records(deleted_at);
