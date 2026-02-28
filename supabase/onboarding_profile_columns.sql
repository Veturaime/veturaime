-- Add onboarding fields to profiles table (idempotent)
-- Run this in Supabase SQL Editor.

alter table if exists public.profiles
  add column if not exists transmission_preference text,
  add column if not exists car_body_preference text,
  add column if not exists car_style_preference text,
  add column if not exists fuel_consumption_priority text,
  add column if not exists electric_future_preference text,
  add column if not exists onboarding_completed_at timestamptz;
