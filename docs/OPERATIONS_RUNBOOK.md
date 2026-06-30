# PSCV Room Operations Runbook

Fecha: 2026-06-29

## Ambientes

- Produccion: Cloudflare Worker `pscv-room`
- Base de datos: Cloudflare D1 `pscv-room`
- Bucket de materiales: Cloudflare R2 `psicologia`
- Identidad: Cloudflare Access con Microsoft Entra ID

## Desarrollo contra la misma base remota

Para probar localmente con los bindings reales de Cloudflare:

```bash
npm run cf:dev:remote
```

Ese comando compila con OpenNext y levanta `wrangler dev --remote`, por lo que las rutas usan la D1 remota configurada en `wrangler.jsonc`.

Para una sesion local sin Access, carga variables de desarrollo y usa:

```bash
AUTH_MODE=development
ALLOW_DEV_AUTH=1
DEV_AUTH_EMAIL=<email-existente-en-app_profiles>
```

`ALLOW_DEV_AUTH=1` es solo para desarrollo.

## D1

El esquema vive en `migrations/`:

- `0001_pscv_room.sql`: esquema base operativo.
- `0002_seed_defaults.sql`: catalogos iniciales de materias, tipos, secciones y columnas de grupo.

Aplicar migraciones remotas:

```bash
npx wrangler d1 migrations apply pscv-room --remote
```

Verificar datos base:

```bash
npx wrangler d1 execute pscv-room --remote --command "SELECT COUNT(*) AS total FROM material_sections;"
```

Tablas principales:

- `app_profiles`
- `courses`
- `task_types`
- `tasks`
- `material_sections`
- `materials`
- `task_materials`
- `group_columns`
- `group_column_values`
- `notification_preferences`
- `notifications`
- `audit_log`

Vistas de reportes:

- `report_task_summary`
- `report_material_summary`
- `report_student_followup`

## R2

El Worker usa el binding `MATERIALS_BUCKET` para listar, subir, importar y servir archivos desde el bucket `psicologia`. No se requieren claves S3 para el flujo normal.

Variable opcional para generar URLs públicas directas:

```env
R2_PUBLIC_BASE_URL="https://<public-r2-base-url>"
```

Si no se configura, la app sirve preview/descarga mediante `/api/materials/<id>/file` usando el binding R2.

Rutas internas:

- Preview: `/api/materials/<id>/file?mode=preview`
- Descarga: `/api/materials/<id>/file?mode=download`
- Upload directo por Worker: `POST /api/uploads/direct`

## Deploy

1. Verificar localmente:

```bash
npm run typecheck
npm test
npm run lint
npm run cf:build
npx wrangler deploy --dry-run --outdir dist
```

2. Aplicar migraciones pendientes:

```bash
npx wrangler d1 migrations apply pscv-room --remote
```

3. Desplegar:

```bash
npx wrangler deploy
```

4. Validar produccion:

```bash
SMOKE_BASE_URL="https://<worker-url-o-dominio>" npm run smoke
```

## Diagnostico

Endpoints utiles:

```txt
GET /api/health
GET /api/auth/session
GET /api/tasks
GET /api/materials/library
GET /api/uploads/destinations
GET /api/admin/r2/status
GET /api/reports/operations
```

`/api/health` debe reportar:

```json
{
  "ok": true,
  "mode": "database",
  "integrations": {
    "d1": true,
    "r2": true
  }
}
```

## Checklist de cierre

- `npm run typecheck` pasa.
- `npm test` pasa.
- `npm run lint` no tiene errores.
- `npm run cf:build` pasa.
- `npx wrangler deploy --dry-run --outdir dist` muestra bindings `DB` y `MATERIALS_BUCKET`.
- D1 remota tiene migraciones aplicadas.
- El perfil owner inicial existe en `app_profiles`.
- Smoke pasa contra el dominio desplegado cuando se haga deploy real.
