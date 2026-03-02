-- Persistent in-app reminders/notifications for documents and services.
-- Run this after supabase/dashboard_core.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid references public.cars(id) on delete cascade,
  source_type text not null check (source_type in ('document', 'service')),
  source_id uuid not null,
  trigger_kind text not null check (trigger_kind in ('due_30', 'due_7', 'due_today_or_overdue')),
  due_at date,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_owner_id_idx on public.notifications(owner_id);
create index if not exists notifications_car_id_idx on public.notifications(car_id);
create index if not exists notifications_read_at_idx on public.notifications(read_at);
create index if not exists notifications_due_at_idx on public.notifications(due_at);

create unique index if not exists notifications_dedupe_idx
  on public.notifications(owner_id, source_type, source_id, trigger_kind);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = owner_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
on public.notifications
for insert
with check (auth.uid() = owner_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete
using (auth.uid() = owner_id);
