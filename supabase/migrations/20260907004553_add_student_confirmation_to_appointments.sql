alter table public.appointments
  add column if not exists student_confirmed_at timestamptz null;
