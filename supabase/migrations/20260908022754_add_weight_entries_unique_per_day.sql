alter table public.weight_entries add constraint weight_entries_student_date_unique unique (student_id, entry_date);
