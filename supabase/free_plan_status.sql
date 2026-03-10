alter table if exists public.profiles
  add column if not exists plan_status text not null default 'Free';

update public.profiles
set plan_status = 'Free'
where plan_status is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, plan_status)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'plan_status', 'Free')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;