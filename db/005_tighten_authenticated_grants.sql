-- Tighten Data API grants after adding explicit production operation tables.

revoke all on all tables in schema public from authenticated;

grant select on
  public.app_profiles,
  public.app_settings,
  public.courses,
  public.task_types,
  public.tasks,
  public.material_sections,
  public.materials,
  public.task_materials,
  public.user_course_preferences,
  public.group_columns,
  public.group_column_values,
  public.audit_log,
  public.notification_preferences,
  public.notifications,
  public.report_task_summary,
  public.report_material_summary,
  public.report_student_followup
to authenticated;

grant insert, update, delete on
  public.app_profiles,
  public.app_settings,
  public.courses,
  public.task_types,
  public.tasks,
  public.material_sections,
  public.materials,
  public.task_materials,
  public.user_course_preferences,
  public.group_columns,
  public.group_column_values,
  public.audit_log,
  public.notification_preferences,
  public.notifications
to authenticated;

revoke all on all tables in schema public from anon;
