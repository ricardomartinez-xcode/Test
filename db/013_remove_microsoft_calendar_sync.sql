-- Remove delegated Microsoft calendar data and stored OAuth tokens.

drop table if exists public.task_calendar_events;
drop table if exists public.microsoft_calendar_connections;
