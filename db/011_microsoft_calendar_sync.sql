-- Delegated Microsoft calendar connections and per-task event mappings.

create table if not exists public.microsoft_calendar_connections (
  profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz not null,
  scopes text not null default '',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

create table if not exists public.task_calendar_events (
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  provider_event_id text not null,
  web_link text,
  last_synced_at timestamptz not null default now(),
  last_error text,
  primary key (profile_id, task_id)
);

create index if not exists idx_task_calendar_events_task
  on public.task_calendar_events(task_id);

alter table public.microsoft_calendar_connections enable row level security;
alter table public.task_calendar_events enable row level security;

revoke all on public.microsoft_calendar_connections from anon, authenticated;
revoke all on public.task_calendar_events from anon, authenticated;
grant all on public.microsoft_calendar_connections to service_role;
grant all on public.task_calendar_events to service_role;

