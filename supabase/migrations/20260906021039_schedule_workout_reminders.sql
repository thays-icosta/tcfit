create extension if not exists pg_cron with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'send-scheduled-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'x-webhook-secret', 'a48df140afbbd636036ba7e60cb0a430dd09273ff3209f6a'
    ),
    body := '{}'::jsonb
  );
  $$
);
