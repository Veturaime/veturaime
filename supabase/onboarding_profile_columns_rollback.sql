-- Rollback onboarding fields from profiles table
-- Run only if you want to remove onboarding data.

alter table if exists public.profiles
  drop column if exists onboarding_completed_at,
  drop column if exists electric_future_preference,
  drop column if exists fuel_consumption_priority,
  drop column if exists car_style_preference,
  drop column if exists car_body_preference,
  drop column if exists transmission_preference;
