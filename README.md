# PSCV Room 2.0

App web moderna para reemplazar y mejorar el flujo actual de AppSheet + Google Sheets.

## Objetivo

Convertir el sistema actual de tareas, materiales, calendario y seguimiento en una app propia con:

- Panel de lectura para alumnos.
- Panel admin para crear, editar, entregar y cancelar tareas.
- Modelo preparado para Postgres.
- Subida/descarga de archivos preparada para Cloudflare R2.
- Migración gradual desde Google Sheets.
- Auditoría, permisos y columnas internas separadas de la UI.

## Decisión de arquitectura

La recomendación para producción es:

```txt
Next.js / Vercel
  ↓
Postgres: tareas, usuarios, materias, estados, auditoría
  ↓
Cloudflare R2: archivos pesados, PDFs, presentaciones, materiales
  ↓
Google Sheets: solo importación inicial, respaldo o reportes simples
```

Sheets funcionó bien para prototipo, pero no debe ser la fuente principal cuando necesitas permisos reales, auditoría, estados consistentes, carga de archivos y escalabilidad.

## Stack

- Next.js App Router
- React + TypeScript
- CSS nativo minimalista
- API routes listas para Postgres y R2
- Modo demo con datos semilla si no hay base de datos
- Supabase Auth/RLS para permisos reales
- Notificaciones persistentes y reportes operativos

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre:

```txt
http://localhost:3000
```

## Variables de entorno

Copia `.env.example` a `.env.local`.

```bash
cp .env.example .env.local
```

Para demo no necesitas variables.

Para producción:

```env
DATABASE_URL="postgres://..."
CLOUDFLARE_R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET="psicologia"
CLOUDFLARE_R2_PUBLIC_BASE_URL="https://pub-fb23330311304d9685253700280f0a85.r2.dev"
```

## Scripts

```bash
npm run dev
npm run build
npm run smoke
npm run start
npm run typecheck
```

## Operacion

El runbook de deploy, variables Vercel, R2, Supabase y recuperacion esta en:

```txt
docs/OPERATIONS_RUNBOOK.md
```

Guias de cierre:

```txt
docs/QA_CHECKLIST.md
docs/USER_GUIDE.md
```

## Carpetas importantes

```txt
app/                  UI y API routes
components/           Componentes de interfaz
lib/                  Tipos, seed y utilidades
db/schema.sql         Esquema SQL recomendado
docs/                 Arquitectura y migración
```

## Estado actual

- Datos operativos en Supabase.
- Archivos en Cloudflare R2.
- Permisos por perfil admin.
- Auditoria y reportes disponibles en Admin.
- Smoke automatizado para contratos principales.
