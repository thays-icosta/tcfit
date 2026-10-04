-- A. personal_public_info: run with the caller's own permissions (RLS on users decides
-- which personal each user can see), and no longer readable/writable by anon.
alter view public.personal_public_info set (security_invoker = true);
revoke all on public.personal_public_info from public, anon, authenticated;
grant select on public.personal_public_info to authenticated;

-- public_personal_contact: unused by the app, exposed phone/pix/payment link to anon.
drop view if exists public.public_personal_contact;

-- B. Trigger functions are never meant to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_referral_reward() from public, anon, authenticated;
revoke execute on function public.notify_new_message_push() from public, anon, authenticated;

-- RPCs used by signed-in users only.
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
revoke execute on function public.confirm_appointment_attendance(uuid) from public, anon;
grant execute on function public.confirm_appointment_attendance(uuid) to authenticated;

-- Pin search_path on the two functions flagged as mutable.
alter function public.set_updated_at() set search_path = public;
alter function public.generate_referral_code() set search_path = public;
