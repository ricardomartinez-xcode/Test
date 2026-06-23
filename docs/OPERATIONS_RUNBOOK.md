# PSCV Room Operations Runbook

Fecha: 2026-06-23

## Ambientes

- Produccion: `https://app.rlead.xyz`
- Vercel project: `relead/pscvroom`
- Rama de producción: `main`
- Supabase project ref: `luygjtmggthhxzxlfkbq`
- R2 bucket: `psicologia`
- R2 S3 API: `https://41ffa6a1a7c184fd4308f87780a62cc4.r2.cloudflarestorage.com/psicologia`
- R2 public dev URL: `https://pub-fb23330311304d9685253700280f0a85.r2.dev`
- R2 catalog URI: `https://catalog.cloudflarestorage.com/41ffa6a1a7c184fd4308f87780a62cc4/psicologia`

## Deploy

1. Hacer commit por bloque funcional.
2. Empujar la rama:

```bash
git push origin main
```

3. Confirmar que Vercel termina en `Ready`:

```bash
vercel ls --yes
vercel inspect <deployment-url> --logs
```

4. Validar produccion con smoke cuando el cambio toque rutas, R2 o auth. Los previews pueden responder `401` si Vercel Deployment Protection esta activo; en ese caso basta confirmar `Ready` y correr smoke al promover a produccion:

```bash
$env:SMOKE_BASE_URL="https://app.rlead.xyz"; npm run smoke
```

## Variables Vercel

Estado observado con `vercel env ls` el 2026-06-18.

Variables presentes en Preview y Production:

- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

Variables presentes solo en Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
Si se quiere probar login, datos reales y diagnostico Supabase en previews de rama, copiar las variables `NEXT_PUBLIC_SUPABASE_*` y las variables Supabase necesarias tambien a Preview. `DATABASE_URL` no esta listado; las rutas principales usan Supabase, pero la ruta legacy `/api/tasks` lo requiere si se usa Postgres directo.

## R2

Configuracion recomendada:

```env
CLOUDFLARE_R2_ENDPOINT="https://41ffa6a1a7c184fd4308f87780a62cc4.r2.cloudflarestorage.com/psicologia"
CLOUDFLARE_R2_BUCKET="psicologia"
CLOUDFLARE_R2_PUBLIC_BASE_URL="https://pub-fb23330311304d9685253700280f0a85.r2.dev"
```

La app normaliza el endpoint y usa rutas internas firmadas para preview/descarga:

- Preview: `/api/materials/<id>/file?mode=preview`
- Descarga: `/api/materials/<id>/file?mode=download`

Para diagnosticar R2 desde la UI:

1. Entrar como admin.
2. Abrir `Admin > Diagnostico`.
3. Revisar `R2`, `Destinos totales`, `Materiales visibles`.
4. Usar `Simular` antes de `Sincronizar R2`.

## Supabase

Migraciones aplicadas o requeridas por esta fase:

- `db/001_pscvroom_evolution.sql`
- `db/002_group_columns.sql`
- `db/003_material_sections_timestamps.sql`
- `db/004_production_operations.sql`
- `db/005_tighten_authenticated_grants.sql`
- `db/006_restore_public_material_read_grants.sql`
- `db/007_task_change_notifications.sql`
- `db/008_fix_permission_email_fallback.sql`
- `db/009_academic_management.sql`
- `db/010_owner_only_profile_permissions.sql`
- `db/011_microsoft_calendar_sync.sql`
- `db/012_normalize_material_sections.sql`
- `db/013_remove_microsoft_calendar_sync.sql`

La seccion `Preferencias` guarda preferencias por usuario en `app_profiles.preferences`; el admin no controla la vista global de todos. La lista de grupo usa:

- `group_columns`
- `group_column_values`

La operacion actual tambien usa:

- `notification_preferences`
- `notifications`
- `audit_log`
- vistas `report_task_summary`, `report_material_summary`, `report_student_followup`

Permisos admin por perfil:

- `can_edit_tasks`, `can_delete_tasks`
- `can_manage_materials`, `can_manage_r2`
- `can_manage_users`, `can_manage_settings`, `can_manage_group`
- `can_manage_notifications`, `can_view_reports`

## Pruebas Minimas

Antes de empujar cambios grandes:

```bash
npm test
npm run lint
npm run build
npm run typecheck
```

Para revisar endpoints desplegados:

```bash
$env:SMOKE_BASE_URL="https://app.rlead.xyz"; npm run smoke
```

El smoke valida render inicial, health, tareas, destinos R2, forma de URLs de materiales y proteccion de rutas operativas.

## Cierre por Fases

- Fase 1 QA funcional: usar `npm run typecheck`, `npm run build` y `npm run smoke`.
- Fase 2 datos: revisar `Admin > Diagnostico`, conteos Supabase y vistas de reportes.
- Fase 3 R2: revisar `Admin > Diagnostico`, variables, carpetas y usar `Simular` antes de sincronizar.
- Fase 4 roles: gestionar permisos en `Admin > Usuarios`.
- Fase 5 auditoria: consultar `Admin > Reportes > Auditoria reciente`.
- Fase 6 notificaciones: crear avisos desde `Admin > Avisos`; la campana muestra avisos persistentes por usuario.
- Fase 7 reportes: abrir `Admin > Reportes`.
- Fase 8 UX: validar desktop y movil con datos reales.
- Fase 9 hardening: smoke debe confirmar rutas protegidas.
- Fase 10 usuarios: seguir `docs/USER_GUIDE.md`.

## Recuperacion

Checkpoint estable:

```bash
git fetch --tags
git checkout v1.0-r2-workflows
```

Para trabajar desde ese corte:

```bash
git switch -c codex/nuevo-arreglo v1.0-r2-workflows
```

## Checklist de Cierre

- `npm run build` pasa localmente.
- El commit esta empujado a `origin`.
- El deployment correspondiente en Vercel esta `Ready`.
- Si toca R2/Supabase, smoke pasa contra `https://app.rlead.xyz` o contra el preview con variables completas.
