-- VeturaIme - Service/Document/Expense + Reporting enhancement
-- Date: 2026-03-01
--
-- Run this migration in Supabase SQL editor after dashboard_core.sql.
-- It is idempotent (safe to run multiple times).

begin;

-- =====================================================
-- 1) DOCUMENTS: title + consistent status/type defaults
-- =====================================================

alter table public.documents
  add column if not exists title text;

alter table public.documents
  alter column status set default 'active';

-- Optional supporting index for dashboard/report filters.
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_document_type_idx on public.documents(document_type);

-- =====================================================
-- 2) SERVICE RECORDS: structured fields for dynamic forms
-- =====================================================

alter table public.service_records
  add column if not exists service_kind text,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists battery_replaced boolean,
  add column if not exists antifreeze_winter_level text;

-- Helpful indexes for reporting/history.
create index if not exists service_records_service_kind_idx on public.service_records(service_kind);
create index if not exists service_records_next_due_idx on public.service_records(next_service_due_at);

-- =====================================================
-- 3) EXPENSES: subcategory + mileage + receipt link
-- =====================================================

alter table public.expenses
  add column if not exists subcategory text,
  add column if not exists mileage integer,
  add column if not exists receipt_file_url text;

create index if not exists expenses_category_idx on public.expenses(category);
create index if not exists expenses_subcategory_idx on public.expenses(subcategory);
create index if not exists expenses_mileage_idx on public.expenses(mileage);

-- =====================================================
-- 4) REPORTING VIEW: unified history (documents/services/expenses)
-- =====================================================

create or replace view public.vehicle_activity_history as
select
  d.id as record_id,
  d.owner_id,
  d.car_id,
  coalesce(d.expires_on, d.issued_on, d.created_at::date) as activity_date,
  'document'::text as activity_type,
  d.document_type as category,
  coalesce(d.title, d.reference_number, d.document_type) as label,
  null::numeric as amount,
  d.status,
  d.notes,
  d.created_at
from public.documents d

union all

select
  s.id as record_id,
  s.owner_id,
  s.car_id,
  s.service_date as activity_date,
  'service'::text as activity_type,
  coalesce(s.service_kind, s.service_type) as category,
  s.service_type as label,
  s.cost as amount,
  null::text as status,
  s.notes,
  s.created_at
from public.service_records s

union all

select
  e.id as record_id,
  e.owner_id,
  e.car_id,
  e.expense_date as activity_date,
  'expense'::text as activity_type,
  e.category,
  coalesce(e.subcategory, e.category) as label,
  e.amount,
  null::text as status,
  e.notes,
  e.created_at
from public.expenses e;

-- Restrict view access by owner_id.
alter view public.vehicle_activity_history set (security_invoker = true);

-- =====================================================
-- 5) STORAGE: bucket + RLS policies for document/receipt upload
-- =====================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'vehicle-files',
  'vehicle-files',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
where not exists (
  select 1 from storage.buckets where id = 'vehicle-files'
);

-- Users can read files in this bucket.
drop policy if exists "vehicle-files read" on storage.objects;
create policy "vehicle-files read"
on storage.objects
for select
to authenticated
using (bucket_id = 'vehicle-files');

-- Users can upload only under their own folder: {auth.uid()}/...
drop policy if exists "vehicle-files insert own folder" on storage.objects;
create policy "vehicle-files insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Users can update only files under their own folder.
drop policy if exists "vehicle-files update own folder" on storage.objects;
create policy "vehicle-files update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-files'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Users can delete only files under their own folder.
drop policy if exists "vehicle-files delete own folder" on storage.objects;
create policy "vehicle-files delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
