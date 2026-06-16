-- Persistent group checklist columns and boolean values.
-- Admin-only RLS: the group list is an operational admin surface.

create table if not exists public.group_columns (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  label text not null,
  value_type text not null default 'boolean' check (value_type in ('boolean')),
  fixed boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_columns_active_order
  on public.group_columns(active, sort_order, label);

create table if not exists public.group_column_values (
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  column_id uuid not null references public.group_columns(id) on delete cascade,
  value boolean not null default false,
  updated_by uuid references public.app_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, column_id)
);

create index if not exists idx_group_column_values_column
  on public.group_column_values(column_id);

alter table public.group_columns enable row level security;
alter table public.group_column_values enable row level security;

drop policy if exists "group columns admin read" on public.group_columns;
drop policy if exists "group columns admin write" on public.group_columns;
drop policy if exists "group values admin read" on public.group_column_values;
drop policy if exists "group values admin write" on public.group_column_values;

create policy "group columns admin read"
on public.group_columns
for select
to authenticated
using ((select public.is_admin()));

create policy "group columns admin write"
on public.group_columns
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "group values admin read"
on public.group_column_values
for select
to authenticated
using ((select public.is_admin()));

create policy "group values admin write"
on public.group_column_values
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, insert, update, delete on public.group_columns to authenticated;
grant select, insert, update, delete on public.group_column_values to authenticated;

insert into public.group_columns(source_key, label, fixed, sort_order)
values
  ('attended', 'Asistencia', true, 10),
  ('licenseIssue', 'Licencia', true, 20),
  ('authIssue', 'Acceso', true, 30)
on conflict (source_key) do update
set
  label = excluded.label,
  fixed = excluded.fixed,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
