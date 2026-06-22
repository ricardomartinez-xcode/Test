-- Only owners can grant/revoke operational permissions or change user roles.
-- Administrators with users:manage can still maintain student directory data.

create or replace function app_private.enforce_owner_only_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role public.app_role;
begin
  select role
  into actor_role
  from public.app_profiles
  where id = public.current_profile_id();

  if TG_OP = 'INSERT' then
    if (
      new.role is distinct from 'student'
      or new.can_edit_tasks
      or new.can_delete_tasks
      or new.can_manage_materials
      or new.can_manage_users
      or new.can_manage_settings
      or new.can_manage_group
      or new.can_manage_notifications
      or new.can_view_reports
      or new.can_manage_r2
    ) and actor_role is distinct from 'owner' then
      raise exception 'Solo el owner puede asignar roles o permisos.';
    end if;

    return new;
  end if;

  if (
    old.role is distinct from new.role
    or old.can_edit_tasks is distinct from new.can_edit_tasks
    or old.can_delete_tasks is distinct from new.can_delete_tasks
    or old.can_manage_materials is distinct from new.can_manage_materials
    or old.can_manage_users is distinct from new.can_manage_users
    or old.can_manage_settings is distinct from new.can_manage_settings
    or old.can_manage_group is distinct from new.can_manage_group
    or old.can_manage_notifications is distinct from new.can_manage_notifications
    or old.can_view_reports is distinct from new.can_view_reports
    or old.can_manage_r2 is distinct from new.can_manage_r2
  ) and actor_role is distinct from 'owner' then
    raise exception 'Solo el owner puede asignar roles o permisos.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_owner_only_profile_permissions on public.app_profiles;
create trigger trg_owner_only_profile_permissions
before insert or update on public.app_profiles
for each row
execute function app_private.enforce_owner_only_profile_permissions();
