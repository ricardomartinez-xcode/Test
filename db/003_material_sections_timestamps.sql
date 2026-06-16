-- Add timestamps expected by the admin UI when updating material sections.
alter table public.material_sections
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_material_sections_updated_at on public.material_sections;
create trigger trg_material_sections_updated_at
before update on public.material_sections
for each row
execute function public.set_updated_at();
