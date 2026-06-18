-- Keep unauthenticated health/smoke material routes returning 2xx while RLS still protects rows.

grant select on
  public.material_sections,
  public.materials
to anon;
