
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

create policy "partner-logos public read"
on storage.objects for select
using (bucket_id = 'partner-logos');

create policy "partner-logos auth insert"
on storage.objects for insert
with check (bucket_id = 'partner-logos' and auth.uid() is not null);

create policy "partner-logos auth update"
on storage.objects for update
using (bucket_id = 'partner-logos' and auth.uid() is not null);

create policy "partner-logos auth delete"
on storage.objects for delete
using (bucket_id = 'partner-logos' and auth.uid() is not null);
