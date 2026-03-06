-- VeturaIme - Quick check queries for saved data
-- Ndrysho USER_UUID dhe (opsionale) CAR_UUID para ekzekutimit.

-- =====================================
-- SETTINGS PREVIEW
-- =====================================
with settings as (
  select
    coalesce(
      nullif('REPLACE_WITH_USER_UUID', 'REPLACE_WITH_USER_UUID'),
      (
        select owner_id::text
        from public.service_records
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.documents
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.expenses
        order by created_at desc
        limit 1
      )
    ) as user_uuid,
    null::text as car_uuid
)
select * from settings;

-- =====================================
-- A) SERVISIMET E SOTME (CURRENT_DATE)
-- =====================================
with settings as (
  select
    coalesce(
      nullif('REPLACE_WITH_USER_UUID', 'REPLACE_WITH_USER_UUID'),
      (
        select owner_id::text
        from public.service_records
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.documents
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.expenses
        order by created_at desc
        limit 1
      )
    ) as user_uuid,
    null::text as car_uuid
)
select
  s.id,
  s.service_date,
  s.service_type,
  s.provider,
  s.cost,
  s.mileage,
  s.notes,
  s.created_at,
  c.make,
  c.model,
  c.license_plate
from public.service_records s
join public.cars c on c.id = s.car_id
join settings st on st.user_uuid = s.owner_id::text
where (st.car_uuid is null or s.car_id::text = st.car_uuid)
  and s.service_date = current_date
order by s.created_at desc;

-- =====================================
-- B) DOKUMENTI I REGJISTRIMIT (issued_on / expires_on)
-- =====================================
-- Verifiko që expires_on = issued_on + 1 year.
with settings as (
  select
    coalesce(
      nullif('REPLACE_WITH_USER_UUID', 'REPLACE_WITH_USER_UUID'),
      (
        select owner_id::text
        from public.service_records
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.documents
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.expenses
        order by created_at desc
        limit 1
      )
    ) as user_uuid,
    null::text as car_uuid
)
select
  d.id,
  d.document_type,
  d.reference_number as titulli,
  d.issued_on as data_regjistrimit,
  d.expires_on as data_skadimit,
  (d.issued_on + interval '1 year')::date as skadim_pritur,
  case
    when d.expires_on = (d.issued_on + interval '1 year')::date then 'OK'
    else 'JO'
  end as validim_1_vit,
  d.created_at
from public.documents d
join settings st on st.user_uuid = d.owner_id::text
where d.document_type = 'registration'
  and (st.car_uuid is null or d.car_id::text = st.car_uuid)
order by d.created_at desc;

-- =====================================
-- C) HISTORIA E RAPORTIT (shpejt)
-- =====================================
with settings as (
  select
    coalesce(
      nullif('REPLACE_WITH_USER_UUID', 'REPLACE_WITH_USER_UUID'),
      (
        select owner_id::text
        from public.service_records
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.documents
        order by created_at desc
        limit 1
      ),
      (
        select owner_id::text
        from public.expenses
        order by created_at desc
        limit 1
      )
    ) as user_uuid,
    null::text as car_uuid
)
select
  h.activity_date,
  h.activity_type,
  h.category,
  h.label,
  h.created_at
from public.vehicle_activity_history h
join settings st on st.user_uuid = h.owner_id::text
where (st.car_uuid is null or h.car_id::text = st.car_uuid)
order by h.created_at desc
limit 100;
