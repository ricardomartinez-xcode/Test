-- Academic management: secure course catalog visibility for administrators
-- and improve student-directory / course-management queries.
-- Run after 001 through 008 in the Supabase SQL editor or migration pipeline.

create index if not exists idx_app_profiles_student_directory
  on public.app_profiles(active, full_name)
  where role = 'student';

create index if not exists idx_courses_admin_sort
  on public.courses(active, sort_order, name);

-- Students only see active subjects. Owners and authorized administrators also
-- need to see inactive records so they can reactivate them from the admin screen.
drop policy if exists "courses read authenticated" on public.courses;
drop policy if exists "courses read active or admin" on public.courses;

create policy "courses read active or admin"
on public.courses
for select
to authenticated
using (
  active = true
  or public.has_admin_permission('settings:manage')
);
