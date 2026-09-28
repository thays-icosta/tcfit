create policy template_ex_select_via_project on public.workout_template_exercises
  for select using (
    exists (
      select 1
      from project_activities pa
      join student_projects sp on sp.project_template_id = pa.project_template_id
      where pa.ref_template_id = workout_template_exercises.template_id
        and sp.student_id = auth.uid()
    )
  );
