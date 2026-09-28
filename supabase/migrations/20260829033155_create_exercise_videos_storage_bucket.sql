insert into storage.buckets (id, name, public, file_size_limit)
values ('exercise-videos', 'exercise-videos', true, 31457280)
on conflict (id) do nothing;

create policy "exercise_videos_public_read"
on storage.objects for select
using (bucket_id = 'exercise-videos');

create policy "exercise_videos_upload_authenticated"
on storage.objects for insert
with check (bucket_id = 'exercise-videos' and auth.uid() is not null);

create policy "exercise_videos_update_authenticated"
on storage.objects for update
using (bucket_id = 'exercise-videos' and auth.uid() is not null);
