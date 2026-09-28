create policy workout_session_sets_select_personal on workout_session_sets
for select
using (
  exists (
    select 1
    from workout_sessions s
    join users u on u.id = s.student_id
    where s.id = workout_session_sets.session_id
      and u.personal_id = auth.uid()
  )
);
