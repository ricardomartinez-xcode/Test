-- PSCV Room 2.0 / Evolution schema
-- Designed for Supabase Auth + Microsoft OAuth, configurable UI, materials catalog and R2-backed uploads.
-- Safe to run on an empty public schema.

create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'admin', 'owner');
create type public.storage_provider as enum ('drive', 'r2', 'external');
create type public.material_visibility as enum ('visible', 'hidden', 'archived');

create table if not exists public.app_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  control_number text unique,
  email text unique not null,
  full_name text not null,
  role public.app_role not null default 'student',
  active boolean not null default true,
  can_edit_tasks boolean not null default false,
  can_delete_tasks boolean not null default false,
  preferences jsonb not null default '{
    "calendarView": "month",
    "taskDensity": "comfortable",
    "materialPreviewSize": "medium",
    "showCompleted": false,
    "theme": "system"
  }',
  legacy_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  label text not null,
  value jsonb not null,
  editable_by_admin boolean not null default true,
  updated_by uuid references public.app_profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  legacy_name text unique,
  name text not null unique,
  short_name text,
  color text not null default '#4285dc',
  icon text not null default 'book',
  card_size text not null default 'medium' check (card_size in ('compact', 'medium', 'large')),
  calendar_lane integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#4285dc',
  icon text not null default 'task',
  card_size text not null default 'medium' check (card_size in ('compact', 'medium', 'large')),
  sort_order integer not null default 0,
  active boolean not null default true,
  config jsonb not null default '{}'
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  course_id uuid references public.courses(id),
  task_type_id uuid references public.task_types(id),
  title text not null,
  description text,
  material_needed text,
  material_url text,
  platform_url text,
  notes text,
  due_date date not null,
  due_time time not null default '23:59',
  status text not null default 'Pendiente',
  priority text not null default 'Media',
  visible_to_students boolean not null default true,
  calendar_event_id text,
  last_sync_at timestamptz,
  created_by uuid references public.app_profiles(id),
  updated_by uuid references public.app_profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_due on public.tasks(due_date, due_time);
create index if not exists idx_tasks_course on public.tasks(course_id);
create index if not exists idx_tasks_type on public.tasks(task_type_id);
create index if not exists idx_tasks_visible on public.tasks(visible_to_students) where archived_at is null;

create table if not exists public.material_sections (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.material_sections(id) on delete cascade,
  name text not null,
  slug text not null,
  path text not null,
  color text not null default '#4285dc',
  icon text not null default 'folder',
  card_size text not null default 'medium' check (card_size in ('compact', 'medium', 'large')),
  preview_style text not null default 'thumbnail' check (preview_style in ('none', 'icon', 'thumbnail', 'embedded')),
  sort_order integer not null default 0,
  active boolean not null default true,
  config jsonb not null default '{}',
  unique(path)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  section_id uuid references public.material_sections(id),
  title text not null,
  material_type text not null default 'PDF',
  visibility public.material_visibility not null default 'visible',
  provider public.storage_provider not null default 'drive',
  source_url text,
  preview_url text,
  thumbnail_url text,
  r2_bucket text,
  r2_key text,
  file_id text,
  file_name text,
  content_type text,
  size_bytes bigint,
  observations text,
  search_text tsvector generated always as (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(file_name, '') || ' ' || coalesce(observations, ''))) stored,
  uploaded_by uuid references public.app_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materials_section on public.materials(section_id);
create index if not exists idx_materials_search on public.materials using gin(search_text);

create table if not exists public.task_materials (
  task_id uuid not null references public.tasks(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (task_id, material_id)
);

create table if not exists public.user_course_preferences (
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  visible boolean not null default true,
  custom_color text,
  sort_order integer,
  primary key(profile_id, course_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.app_profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.app_profiles where auth_user_id = auth.uid() and active = true limit 1
$$;

create or replace function public.update_my_preferences(preferences_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  merged_preferences jsonb;
begin
  update public.app_profiles
  set
    preferences = coalesce(preferences, '{}'::jsonb) || coalesce(preferences_input, '{}'::jsonb),
    updated_at = now()
  where auth_user_id = auth.uid()
    and active = true
  returning preferences into merged_preferences;

  if merged_preferences is null then
    raise exception 'Perfil activo no encontrado para el usuario actual.';
  end if;

  return merged_preferences;
end;
$$;

revoke all on function public.update_my_preferences(jsonb) from public;
grant execute on function public.update_my_preferences(jsonb) to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.app_profiles
    where auth_user_id = auth.uid()
      and active = true
      and role in ('admin', 'owner')
  )
$$;

create or replace function public.enforce_profile_self_preferences_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - 'preferences' - 'updated_at') <> (to_jsonb(old) - 'preferences' - 'updated_at') then
    raise exception 'Solo puedes actualizar tus preferencias.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profile_self_preferences_only on public.app_profiles;
create trigger trg_profile_self_preferences_only
before update on public.app_profiles
for each row
execute function public.enforce_profile_self_preferences_only();

create or replace view public.active_student_tasks as
select
  t.*,
  c.name as course_name,
  c.color as course_color,
  c.icon as course_icon,
  c.card_size as course_card_size,
  tt.name as task_type_name,
  tt.color as task_type_color,
  tt.icon as task_type_icon,
  (t.due_date - current_date) as days_remaining
from public.tasks t
left join public.courses c on c.id = t.course_id
left join public.task_types tt on tt.id = t.task_type_id
where t.archived_at is null
  and t.visible_to_students = true
  and t.status not in ('Entregado', 'Cancelado');

alter table public.app_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.courses enable row level security;
alter table public.task_types enable row level security;
alter table public.tasks enable row level security;
alter table public.material_sections enable row level security;
alter table public.materials enable row level security;
alter table public.task_materials enable row level security;
alter table public.user_course_preferences enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles read own or admin" on public.app_profiles for select using (auth_user_id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.app_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "profiles own preferences update" on public.app_profiles for update using (auth_user_id = auth.uid() and active = true) with check (auth_user_id = auth.uid() and active = true);

create policy "settings read authenticated" on public.app_settings for select using (auth.role() = 'authenticated');
create policy "settings admin write" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "courses read authenticated" on public.courses for select using (auth.role() = 'authenticated' and active = true);
create policy "courses admin write" on public.courses for all using (public.is_admin()) with check (public.is_admin());

create policy "task types read authenticated" on public.task_types for select using (auth.role() = 'authenticated' and active = true);
create policy "task types admin write" on public.task_types for all using (public.is_admin()) with check (public.is_admin());

create policy "tasks read visible" on public.tasks for select using (auth.role() = 'authenticated' and (visible_to_students = true or public.is_admin()));
create policy "tasks admin write" on public.tasks for all using (public.is_admin()) with check (public.is_admin());

create policy "sections read authenticated" on public.material_sections for select using (auth.role() = 'authenticated' and active = true);
create policy "sections admin write" on public.material_sections for all using (public.is_admin()) with check (public.is_admin());

create policy "materials read visible" on public.materials for select using (auth.role() = 'authenticated' and (visibility = 'visible' or public.is_admin()));
create policy "materials admin write" on public.materials for all using (public.is_admin()) with check (public.is_admin());

create policy "task materials read authenticated" on public.task_materials for select using (auth.role() = 'authenticated');
create policy "task materials admin write" on public.task_materials for all using (public.is_admin()) with check (public.is_admin());

create policy "user prefs own read" on public.user_course_preferences for select using (profile_id = public.current_profile_id() or public.is_admin());
create policy "user prefs own write" on public.user_course_preferences for all using (profile_id = public.current_profile_id() or public.is_admin()) with check (profile_id = public.current_profile_id() or public.is_admin());

create policy "audit admin read" on public.audit_log for select using (public.is_admin());
create policy "audit admin insert" on public.audit_log for insert with check (public.is_admin());

insert into public.app_settings(key, label, value) values
  ('calendar', 'Calendario', '{"defaultView":"month","showWeekends":true,"eventDensity":"comfortable","showPastDue":true}'),
  ('tasks', 'Tareas', '{"groupBy":"type","defaultDensity":"comfortable","showDaysRemaining":true,"allowStudentCompletedToggle":false}'),
  ('materials', 'Materiales', '{"groupBy":"section","previewSize":"medium","showEmbeddedPreview":true,"allowDownloads":true,"defaultProvider":"r2"}'),
  ('branding', 'Marca', '{"appName":"PSCV Room","primaryColor":"#4285dc","logoMode":"compact"}')
on conflict (key) do nothing;
