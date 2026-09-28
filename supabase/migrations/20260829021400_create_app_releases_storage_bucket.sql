insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', true)
on conflict (id) do nothing;

create policy "app_releases_public_read"
on storage.objects for select
using (bucket_id = 'app-releases');

create policy "app_releases_upload_authenticated"
on storage.objects for insert
with check (bucket_id = 'app-releases' and auth.uid() is not null);

create policy "app_releases_update_authenticated"
on storage.objects for update
using (bucket_id = 'app-releases' and auth.uid() is not null);
