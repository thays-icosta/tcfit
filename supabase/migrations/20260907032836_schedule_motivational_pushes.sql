select cron.schedule(
  'motivational-monday-kickoff',
  '0 10 * * 1',
  $$
  select net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-motivational-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'x-webhook-secret', 'a48df140afbbd636036ba7e60cb0a430dd09273ff3209f6a'
    ),
    body := jsonb_build_object('variant', 'monday_kickoff')
  );
  $$
);

select cron.schedule(
  'motivational-friday-cardio',
  '0 21 * * 5',
  $$
  select net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-motivational-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'x-webhook-secret', 'a48df140afbbd636036ba7e60cb0a430dd09273ff3209f6a'
    ),
    body := jsonb_build_object('variant', 'friday_cardio')
  );
  $$
);

select cron.schedule(
  'motivational-monthly-checkin',
  '0 11 1 * *',
  $$
  select net.http_post(
    url := 'https://hcsoaqeqqussszgjfhnb.supabase.co/functions/v1/send-motivational-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc29hcWVxcXVzc3N6Z2pmaG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Nzk0OTgsImV4cCI6MjEwMTU1NTQ5OH0.aG2DDeaSwgQXWRwtkC4OGqsebyaz5IrtCy2Wcx6lmc0',
      'x-webhook-secret', 'a48df140afbbd636036ba7e60cb0a430dd09273ff3209f6a'
    ),
    body := jsonb_build_object('variant', 'monthly_checkin')
  );
  $$
);
