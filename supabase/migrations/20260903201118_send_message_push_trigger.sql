
create extension if not exists pg_net;

create or replace function notify_new_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '63ed39d298b780ed2c4b64bc8b08193ee4456625219807a5'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists on_message_insert_notify on messages;
create trigger on_message_insert_notify
  after insert on messages
  for each row
  execute function notify_new_message_push();
