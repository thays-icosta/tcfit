alter table public.anamnese_responses
  add column if not exists experience_level text null,
  add column if not exists days_per_week integer null,
  add column if not exists session_duration_min integer null,
  add column if not exists activity_level text null,
  add column if not exists sleep_quality text null;
