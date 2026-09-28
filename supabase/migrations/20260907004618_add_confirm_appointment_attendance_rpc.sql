create or replace function public.confirm_appointment_attendance(appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointments
  set student_confirmed_at = now()
  where id = appointment_id
    and student_id = auth.uid()
    and student_confirmed_at is null;
end;
$$;

grant execute on function public.confirm_appointment_attendance(uuid) to authenticated;
