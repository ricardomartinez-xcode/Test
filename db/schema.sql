-- PSCV Room 2.0 schema
-- Compatible con Postgres, Neon, Supabase, Render Postgres, Railway, etc.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  control_number text unique,
  email text unique not null,
  full_name text not null,
  role text not null default 'reader' check (role in ('reader', 'admin')),
  active boolean not null default true,
  can_edit_tasks boolean not null default false,
  can_delete_tasks boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  course text not null,
  due_date date not null,
  due_time time not null default '23:59',
  title text not null,
  material_needed text,
  material_url text,
  delivery_type text not null default 'Tarea',
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Se entrega hoy', 'En proceso', 'Entregado', 'Reprogramado', 'Cancelado')),
  notes text,
  platform_url text,
  calendar_event_id text,
  last_sync_at timestamptz,
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_due on tasks (due_date, due_time);
create index if not exists idx_tasks_status on tasks (status);
create index if not exists idx_tasks_course on tasks (course);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  scope text,
  name text not null,
  storage_provider text not null default 'r2' check (storage_provider in ('r2', 'drive', 'external')),
  storage_key text,
  file_id text,
  url text,
  preview_url text,
  content_type text,
  size_bytes bigint,
  notes text,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_materials (
  task_id uuid not null references tasks(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  primary key (task_id, material_id)
);

create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  day_name text not null,
  start_time time not null,
  end_time time not null,
  course text not null,
  room text,
  notes text,
  active boolean not null default true
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references app_users(id),
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace view active_reader_tasks as
select
  *,
  (due_date - current_date) as days_remaining,
  case
    when status in ('Entregado', 'Cancelado') then false
    when due_date < current_date then false
    else true
  end as visible_to_readers
from tasks
where archived_at is null;
