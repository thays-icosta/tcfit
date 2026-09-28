alter table public.users
  add column if not exists attendance_mode text not null default 'online';

alter table public.users
  add constraint users_attendance_mode_check check (attendance_mode = any (array['presencial'::text, 'online'::text]));
