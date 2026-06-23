-- Keep material sections aligned with canonical Cloudflare R2 folders.

begin;

update public.materials as material
set
  section_id = canonical.id,
  updated_at = now()
from public.material_sections as legacy
join public.material_sections as canonical
  on canonical.path = regexp_replace(
    legacy.path,
    '^Psicologia/Compendio Psicología',
    'Compendio de Psicología'
  )
where material.section_id = legacy.id
  and legacy.path like 'Psicologia/Compendio Psicología/%';

update public.materials as material
set
  section_id = year_section.parent_id,
  updated_at = now()
from public.material_sections as year_section
where material.section_id = year_section.id
  and year_section.parent_id is not null
  and year_section.name ~ '^(19|20)[0-9]{2}$';

delete from public.material_sections
where path like 'Psicologia/Compendio Psicología/%';

delete from public.material_sections
where parent_id is not null
  and name ~ '^(19|20)[0-9]{2}$'
  and not exists (
    select 1
    from public.material_sections as child
    where child.parent_id = material_sections.id
  );

commit;

