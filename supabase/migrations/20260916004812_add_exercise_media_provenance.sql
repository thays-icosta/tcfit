alter table public.exercises
  add column media_source text,
  add column media_type text check (media_type in ('video', 'gif', 'image')),
  add column media_license text,
  add column media_license_author text,
  add column source_exercise_id text;

comment on column public.exercises.media_source is 'Where video_url/thumbnail_url came from, e.g. tcfit, wger, exercisedb, manual. Null = untagged legacy media.';
comment on column public.exercises.media_type is 'video | gif | image — what kind of file video_url/thumbnail_url actually points to.';
comment on column public.exercises.media_license is 'License short name for the imported media, e.g. CC-BY-SA-4.0, CC-BY-4.0, CC0-1.0.';
comment on column public.exercises.media_license_author is 'Attributed author/contributor for the imported media, as required by its license.';
comment on column public.exercises.source_exercise_id is 'The exercise id on the external source (e.g. wger''s numeric id), for re-syncing or re-attribution later.';
