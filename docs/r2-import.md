# Importación de materiales desde Cloudflare R2

Este flujo convierte a Cloudflare R2 en la fuente de verdad del catálogo de materiales.

## Objetivo

- R2 contiene los archivos reales.
- Supabase guarda solo el índice consultable por la app.
- Vercel/Next.js muestra previews y enlaces usando las keys importadas desde R2.

Esto evita cruzar rutas heredadas de Drive o rutas manuales con objetos reales de R2.

## Variables requeridas en Vercel

```env
CLOUDFLARE_R2_ENDPOINT=https://TU_ACCOUNT_ID.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET=TU_BUCKET
CLOUDFLARE_R2_ACCESS_KEY_ID=TU_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY=TU_SECRET_ACCESS_KEY
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://assets.rlead.xyz
```

## Dry run

Primero valida qué leerá el importador sin modificar la base de datos:

```bash
curl -X GET "https://app.rlead.xyz/api/admin/r2/import-materials?root=psicologia&maxItems=10000" \
  -H "Cookie: <cookie-de-sesion-admin>"
```

También se puede abrir la URL desde el navegador con una sesión admin activa.

## Importación sin borrar registros existentes

```bash
curl -X POST "https://app.rlead.xyz/api/admin/r2/import-materials" \
  -H "Content-Type: application/json" \
  -H "Cookie: <cookie-de-sesion-admin>" \
  -d '{"dryRun":false,"root":"psicologia","maxItems":10000}'
```

## Reimportación limpia

Para borrar materiales existentes antes de importar, se requiere confirmación explícita.

Solo borra materiales R2 existentes:

```json
{
  "dryRun": false,
  "root": "psicologia",
  "reset": true,
  "resetScope": "r2",
  "confirm": "REIMPORTAR_R2"
}
```

Borra todos los materiales del catálogo, incluyendo registros heredados de Drive/external, y luego importa desde R2:

```json
{
  "dryRun": false,
  "root": "psicologia",
  "reset": true,
  "resetScope": "all",
  "confirm": "REIMPORTAR_R2"
}
```

No borra usuarios, tareas, materias, preferencias ni configuración general. Solo elimina relaciones `task_materials` de los materiales borrados y registros de `materials`.

## Resultado

Cada objeto de R2 se importa como un material con:

- `provider = 'r2'`
- `r2_bucket`
- `r2_key`
- `source_url`
- `preview_url`
- `section_id` calculado desde la carpeta del objeto
- `content_type` inferido por extensión
- `size_bytes` desde R2
