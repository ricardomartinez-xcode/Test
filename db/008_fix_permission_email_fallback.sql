-- Allow permission checks to match profiles by auth_user_id or authenticated email.

create or replace function public.has_admin_permission(permission_name text)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.app_profiles
    where active = true
      and (
        auth_user_id = auth.uid()
        or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        role = 'owner'
        or (
          role = 'admin'
          and case permission_name
            when 'tasks:edit' then can_edit_tasks
            when 'tasks:delete' then can_delete_tasks
            when 'materials:manage' then can_manage_materials
            when 'users:manage' then can_manage_users
            when 'settings:manage' then can_manage_settings
            when 'group:manage' then can_manage_group
            when 'notifications:manage' then can_manage_notifications
            when 'reports:view' then can_view_reports
            when 'r2:manage' then can_manage_r2
            else false
          end
        )
      )
  )
$$;

revoke all on function public.has_admin_permission(text) from public;
grant execute on function public.has_admin_permission(text) to authenticated;
