-- Webhook shared secrets rotated and moved out of source control.
--
-- The old x-webhook-secret values were committed in earlier migrations (now
-- replaced by REDACTED_ROTATED) and are no longer valid. The new values:
--   * live in Supabase Vault (`message_webhook_secret`, `cron_webhook_secret`),
--     created directly in the database, never in this repo;
--   * are set as Edge Function secrets MESSAGE_WEBHOOK_SECRET (send-message-push)
--     and CRON_WEBHOOK_SECRET (send-scheduled-reminders, send-motivational-push),
--     which the functions read instead of a literal.
-- The Vault secrets were created with:
--   select vault.create_secret(encode(gen_random_bytes(32), 'hex'), '<name>', '<description>');

-- pg_cron jobs read the secret from Vault at call time.
do $$
declare r record;
begin
  for r in select jobid, command from cron.job where command ilike '%x-webhook-secret%' loop
    perform cron.alter_job(
      r.jobid,
      command := regexp_replace(
        r.command,
        '''x-webhook-secret'',\s*''[^'']+''',
        '''x-webhook-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_webhook_secret'')',
        'g'
      )
    );
  end loop;
end $$;

-- messages AFTER INSERT trigger function reads its secret from Vault, and a push
-- failure can never block sending a chat message.
create or replace function public.notify_new_message_push()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'message_webhook_secret';
  perform net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', s
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
exception when others then
  raise warning 'notify_new_message_push failed: %', sqlerrm;
  return new;
end;
$function$;
