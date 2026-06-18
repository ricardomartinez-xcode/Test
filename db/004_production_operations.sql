-- Production operations hardening: permissions, audit, notifications and reports.

alter table public.app_profiles
  add column if not exists can_manage_materials boolean not null default false,
  add column if not exists can_manage_users boolean not null default false,
  add column if not exists can_manage_settings boolean not null default false,
  add column if not exists can_manage_group boolean not null default false,
  add column if not exists can_manage_notifications boolean not null default false,
  add column if not exists can_view_reports boolean not null default false,
  add column if not exists can_manage_r2 boolean not null default false;

update public.app_profiles
set
  can_manage_materials = true,
  can_manage_users = true,
  can_manage_settings = true,
  can_manage_group = true,
  can_manage_notifications = true,
  can_view_reports = true,
  can_manage_r2 = true,
  can_edit_tasks = true,
  can_delete_tasks = true,
  updated_at = now()
where role in ('admin', 'owner');

create or replace function public.has_admin_permission(permission_name text)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.app_profiles
    where auth_user_id = auth.uid()
      and active = true
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

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  due_soon_hours integer not null default 48 check (due_soon_hours between 1 and 336),
  categories jsonb not null default '{"task_due":true,"task_created":true,"task_updated":true,"material_added":true,"system":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.app_profiles(id) on delete cascade,
  kind text not null default 'system' check (kind in ('task_due','task_created','task_updated','material_added','system','reminder')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  title text not null,
  body text not null default '',
  entity text,
  entity_id text,
  action_url text,
  scheduled_for timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_by uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_profile_status
  on public.notifications(profile_id, dismissed_at, read_at, scheduled_for desc);

create index if not exists idx_notifications_broadcast
  on public.notifications(dismissed_at, scheduled_for desc)
  where profile_id is null;

create unique index if not exists idx_notifications_task_due_once
  on public.notifications(profile_id, kind, entity, entity_id)
  where kind = 'task_due' and profile_id is not null and entity is not null and entity_id is not null;

create unique index if not exists idx_materials_r2_key_unique
  on public.materials(r2_key)
  where r2_key is not null;

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "notification prefs own read" on public.notification_preferences;
drop policy if exists "notification prefs own update" on public.notification_preferences;
drop policy if exists "notifications read own or broadcast" on public.notifications;
drop policy if exists "notifications own status update" on public.notifications;
drop policy if exists "notifications admin write" on public.notifications;
drop policy if exists "notifications admin delete" on public.notifications;

create policy "notification prefs own read"
on public.notification_preferences
for select
to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_permission('users:manage'));

create policy "notification prefs own update"
on public.notification_preferences
for all
to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_permission('users:manage'))
with check (profile_id = public.current_profile_id() or public.has_admin_permission('users:manage'));

create policy "notifications read own or broadcast"
on public.notifications
for select
to authenticated
using (profile_id is null or profile_id = public.current_profile_id() or public.has_admin_permission('notifications:manage'));

create policy "notifications own status update"
on public.notifications
for update
to authenticated
using (profile_id = public.current_profile_id() or public.has_admin_permission('notifications:manage'))
with check (profile_id = public.current_profile_id() or public.has_admin_permission('notifications:manage'));

create policy "notifications admin write"
on public.notifications
for insert
to authenticated
with check (public.has_admin_permission('notifications:manage'));

create policy "notifications admin delete"
on public.notifications
for delete
to authenticated
using (public.has_admin_permission('notifications:manage'));

create or replace function public.enforce_notification_status_update_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.has_admin_permission('notifications:manage') then
    return new;
  end if;

  if (to_jsonb(new) - 'read_at' - 'dismissed_at') <> (to_jsonb(old) - 'read_at' - 'dismissed_at') then
    raise exception 'Solo puedes actualizar estado de lectura de tus avisos.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_status_update_only on public.notifications;
create trigger trg_notifications_status_update_only
before update on public.notifications
for each row
execute function public.enforce_notification_status_update_only();

create or replace function public.generate_due_task_notifications(window_days integer default 3)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.has_admin_permission('notifications:manage') then
    raise exception 'No autorizado para generar avisos.';
  end if;

  insert into public.notifications(profile_id, kind, priority, title, body, entity, entity_id, action_url, created_by)
  select
    p.id,
    'task_due',
    case when t.due_date <= current_date + 1 then 'high' else 'normal' end,
    'Entrega próxima: ' || t.title,
    coalesce(c.name, 'Sin materia') || ' · ' || to_char(t.due_date, 'DD/MM/YYYY') || ' ' || coalesce(to_char(t.due_time, 'HH24:MI'), '23:59'),
    'tasks',
    t.id::text,
    '/?task=' || t.id::text,
    public.current_profile_id()
  from public.app_profiles p
  cross join public.tasks t
  left join public.courses c on c.id = t.course_id
  left join public.notification_preferences np on np.profile_id = p.id
  where p.active = true
    and p.role = 'student'
    and coalesce(np.in_app_enabled, true) = true
    and coalesce((np.categories ->> 'task_due')::boolean, true) = true
    and t.archived_at is null
    and t.visible_to_students = true
    and t.status not in ('Entregado', 'Cancelado')
    and t.due_date between current_date and current_date + greatest(1, least(coalesce(window_days, 3), 14))
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_due_task_notifications(integer) from public;
grant execute on function public.generate_due_task_notifications(integer) to authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public;

create or replace function app_private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  actor uuid;
  action_name text;
  entity_name text;
  entity_identifier text;
begin
  if TG_OP = 'INSERT' then
    row_data := to_jsonb(new);
  else
    row_data := to_jsonb(old);
  end if;

  select public.current_profile_id() into actor;
  entity_name := coalesce(nullif(TG_ARGV[0], ''), TG_TABLE_NAME);
  action_name := lower(entity_name) || '.' || lower(TG_OP);
  entity_identifier := coalesce(
    row_data ->> 'id',
    concat_ws(':', row_data ->> 'profile_id', row_data ->> 'column_id'),
    row_data ->> 'key'
  );

  insert into public.audit_log(actor_id, action, entity, entity_id, before_data, after_data)
  values (
    actor,
    action_name,
    entity_name,
    nullif(entity_identifier, ''),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_tasks on public.tasks;
create trigger trg_audit_tasks
after insert or update or delete on public.tasks
for each row execute function app_private.audit_row('tasks');

drop trigger if exists trg_audit_materials on public.materials;
create trigger trg_audit_materials
after insert or update or delete on public.materials
for each row execute function app_private.audit_row('materials');

drop trigger if exists trg_audit_task_materials on public.task_materials;
create trigger trg_audit_task_materials
after insert or update or delete on public.task_materials
for each row execute function app_private.audit_row('task_materials');

drop trigger if exists trg_audit_material_sections on public.material_sections;
create trigger trg_audit_material_sections
after insert or update or delete on public.material_sections
for each row execute function app_private.audit_row('material_sections');

drop trigger if exists trg_audit_courses on public.courses;
create trigger trg_audit_courses
after insert or update or delete on public.courses
for each row execute function app_private.audit_row('courses');

drop trigger if exists trg_audit_group_columns on public.group_columns;
create trigger trg_audit_group_columns
after insert or update or delete on public.group_columns
for each row execute function app_private.audit_row('group_columns');

drop trigger if exists trg_audit_group_column_values on public.group_column_values;
create trigger trg_audit_group_column_values
after insert or update or delete on public.group_column_values
for each row execute function app_private.audit_row('group_column_values');

drop policy if exists "profiles admin write" on public.app_profiles;
create policy "profiles admin write"
on public.app_profiles
for all
to authenticated
using (public.has_admin_permission('users:manage'))
with check (public.has_admin_permission('users:manage'));

drop policy if exists "settings admin write" on public.app_settings;
create policy "settings admin write"
on public.app_settings
for all
to authenticated
using (public.has_admin_permission('settings:manage'))
with check (public.has_admin_permission('settings:manage'));

drop policy if exists "courses admin write" on public.courses;
create policy "courses admin write"
on public.courses
for all
to authenticated
using (public.has_admin_permission('settings:manage'))
with check (public.has_admin_permission('settings:manage'));

drop policy if exists "task types admin write" on public.task_types;
create policy "task types admin write"
on public.task_types
for all
to authenticated
using (public.has_admin_permission('settings:manage'))
with check (public.has_admin_permission('settings:manage'));

drop policy if exists "tasks admin write" on public.tasks;
drop policy if exists "tasks admin insert" on public.tasks;
drop policy if exists "tasks admin update" on public.tasks;
drop policy if exists "tasks admin delete" on public.tasks;

create policy "tasks admin insert"
on public.tasks
for insert
to authenticated
with check (public.has_admin_permission('tasks:edit'));

create policy "tasks admin update"
on public.tasks
for update
to authenticated
using (public.has_admin_permission('tasks:edit'))
with check (public.has_admin_permission('tasks:edit'));

create policy "tasks admin delete"
on public.tasks
for delete
to authenticated
using (public.has_admin_permission('tasks:delete'));

drop policy if exists "sections admin write" on public.material_sections;
create policy "sections admin write"
on public.material_sections
for all
to authenticated
using (public.has_admin_permission('materials:manage'))
with check (public.has_admin_permission('materials:manage'));

drop policy if exists "materials admin write" on public.materials;
create policy "materials admin write"
on public.materials
for all
to authenticated
using (public.has_admin_permission('materials:manage'))
with check (public.has_admin_permission('materials:manage'));

drop policy if exists "task materials admin write" on public.task_materials;
create policy "task materials admin write"
on public.task_materials
for all
to authenticated
using (public.has_admin_permission('materials:manage') or public.has_admin_permission('tasks:edit'))
with check (public.has_admin_permission('materials:manage') or public.has_admin_permission('tasks:edit'));

drop policy if exists "group columns admin write" on public.group_columns;
create policy "group columns admin write"
on public.group_columns
for all
to authenticated
using (public.has_admin_permission('group:manage'))
with check (public.has_admin_permission('group:manage'));

drop policy if exists "group values admin write" on public.group_column_values;
create policy "group values admin write"
on public.group_column_values
for all
to authenticated
using (public.has_admin_permission('group:manage'))
with check (public.has_admin_permission('group:manage'));

drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read"
on public.audit_log
for select
to authenticated
using (public.has_admin_permission('reports:view'));

create or replace view public.report_task_summary
with (security_invoker = true)
as
select
  coalesce(c.name, 'Sin materia') as course,
  coalesce(tt.name, 'Tarea') as delivery_type,
  t.status,
  count(*)::integer as total,
  count(*) filter (where t.due_date < current_date and t.status not in ('Entregado', 'Cancelado'))::integer as overdue,
  min(t.due_date) as next_due_date
from public.tasks t
left join public.courses c on c.id = t.course_id
left join public.task_types tt on tt.id = t.task_type_id
where t.archived_at is null
group by coalesce(c.name, 'Sin materia'), coalesce(tt.name, 'Tarea'), t.status;

create or replace view public.report_material_summary
with (security_invoker = true)
as
select
  coalesce(ms.path, 'Sin sección') as section_path,
  coalesce(m.provider, 'r2') as provider,
  count(*)::integer as total,
  coalesce(sum(m.size_bytes), 0)::bigint as total_bytes,
  max(m.updated_at) as last_updated_at
from public.materials m
left join public.material_sections ms on ms.id = m.section_id
where m.visibility = 'visible'
group by coalesce(ms.path, 'Sin sección'), coalesce(m.provider, 'r2');

create or replace view public.report_student_followup
with (security_invoker = true)
as
select
  p.id as profile_id,
  p.control_number,
  p.full_name,
  p.email,
  count(gcv.column_id) filter (where gcv.value = true)::integer as active_flags,
  max(gcv.updated_at) as last_flag_update
from public.app_profiles p
left join public.group_column_values gcv on gcv.profile_id = p.id
where p.role = 'student' and p.active = true
group by p.id, p.control_number, p.full_name, p.email;

grant select on public.report_task_summary to authenticated;
grant select on public.report_material_summary to authenticated;
grant select on public.report_student_followup to authenticated;

revoke all on all tables in schema public from anon;
grant select on public.app_profiles, public.app_settings, public.courses, public.task_types, public.tasks, public.material_sections, public.materials, public.task_materials, public.user_course_preferences, public.group_columns, public.group_column_values, public.audit_log, public.notification_preferences, public.notifications, public.report_task_summary, public.report_material_summary, public.report_student_followup to authenticated;
grant insert, update, delete on public.app_profiles, public.app_settings, public.courses, public.task_types, public.tasks, public.material_sections, public.materials, public.task_materials, public.user_course_preferences, public.group_columns, public.group_column_values, public.audit_log, public.notification_preferences, public.notifications to authenticated;
