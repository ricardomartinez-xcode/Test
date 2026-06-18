# PSCV Room Operations Runbook

Fecha: 2026-06-18

## Ambientes

- Produccion: `https://app.rlead.xyz`
- Vercel project: `relead/pscvroom`
- Rama de trabajo actual: `codex/task-entry-form`
- Preview estable de la fase: `https://pscvroom-git-codex-task-entry-form-relead.vercel.app`
- Supabase project ref: `luygjtmggthhxzxlfkbq`
- R2 bucket: `psicologia`
- R2 S3 API: `https://41ffa6a1a7c184fd4308f87780a62cc4.r2.cloudflarestorage.com/psicologia`
- R2 public dev URL: `https://pub-fb23330311304d9685253700280f0a85.r2.dev`
- R2 catalog URI: `https://catalog.cloudflarestorage.com/41ffa6a1a7c184fd4308f87780a62cc4/psicologia`

## Deploy

1. Hacer commit por bloque funcional.
2. Empujar la rama:

```bash
git push origin codex/task-entry-form
```

3. Confirmar que Vercel termina en `Ready`:

```bash
vercel ls --yes
vercel inspect <deployment-url> --logs
```

4. Validar produccion con smoke cuando el cambio toque rutas, R2 o auth:

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

La seccion `Preferencias` guarda preferencias por usuario en `app_profiles.preferences`; el admin no controla la vista global de todos. La lista de grupo usa:

- `group_columns`
- `group_column_values`

## Pruebas Minimas

Antes de empujar cambios grandes:

```bash
npm run build
npm run typecheck
```

Para revisar endpoints desplegados:

```bash
$env:SMOKE_BASE_URL="https://app.rlead.xyz"; npm run smoke
```

El smoke valida render inicial, health, tareas, destinos R2 y forma de URLs de materiales.

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
