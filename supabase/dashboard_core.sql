-- Core dashboard schema for cars, services, documents, and expenses.
-- Run this after supabase/registration_only.sql.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  make text not null,
  model text not null,
  year integer,
  license_plate text,
  vin text,
  mileage integer,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  service_date date not null,
  service_type text not null,
  provider text,
  cost numeric(10, 2) not null default 0,
  mileage integer,
  notes text,
  next_service_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  document_type text not null,
  issuer text,
  reference_number text,
  issued_on date,
  expires_on date,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  expense_date date not null,
  category text not null,
  amount numeric(10, 2) not null,
  vendor text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cars_owner_id_idx on public.cars(owner_id);
create index if not exists cars_license_plate_idx on public.cars(license_plate);

create index if not exists service_records_owner_id_idx on public.service_records(owner_id);
create index if not exists service_records_car_id_idx on public.service_records(car_id);
create index if not exists service_records_service_date_idx on public.service_records(service_date desc);

create index if not exists documents_owner_id_idx on public.documents(owner_id);
create index if not exists documents_car_id_idx on public.documents(car_id);
create index if not exists documents_expires_on_idx on public.documents(expires_on);

create index if not exists expenses_owner_id_idx on public.expenses(owner_id);
create index if not exists expenses_car_id_idx on public.expenses(car_id);
create index if not exists expenses_expense_date_idx on public.expenses(expense_date desc);

drop trigger if exists trg_cars_updated_at on public.cars;
create trigger trg_cars_updated_at
before update on public.cars
for each row execute function public.set_updated_at();

drop trigger if exists trg_service_records_updated_at on public.service_records;
create trigger trg_service_records_updated_at
before update on public.service_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.cars enable row level security;
alter table public.service_records enable row level security;
alter table public.documents enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "cars_select_own" on public.cars;
create policy "cars_select_own"
on public.cars
for select
using (auth.uid() = owner_id);

drop policy if exists "cars_insert_own" on public.cars;
create policy "cars_insert_own"
on public.cars
for insert
with check (auth.uid() = owner_id);

drop policy if exists "cars_update_own" on public.cars;
create policy "cars_update_own"
on public.cars
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "cars_delete_own" on public.cars;
create policy "cars_delete_own"
on public.cars
for delete
using (auth.uid() = owner_id);

drop policy if exists "service_records_select_own" on public.service_records;
create policy "service_records_select_own"
on public.service_records
for select
using (auth.uid() = owner_id);

drop policy if exists "service_records_insert_own" on public.service_records;
create policy "service_records_insert_own"
on public.service_records
for insert
with check (auth.uid() = owner_id);

drop policy if exists "service_records_update_own" on public.service_records;
create policy "service_records_update_own"
on public.service_records
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "service_records_delete_own" on public.service_records;
create policy "service_records_delete_own"
on public.service_records
for delete
using (auth.uid() = owner_id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
on public.documents
for select
using (auth.uid() = owner_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
on public.documents
for insert
with check (auth.uid() = owner_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
on public.documents
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
on public.documents
for delete
using (auth.uid() = owner_id);

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own"
on public.expenses
for select
using (auth.uid() = owner_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own"
on public.expenses
for insert
with check (auth.uid() = owner_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own"
on public.expenses
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own"
on public.expenses
for delete
using (auth.uid() = owner_id);
