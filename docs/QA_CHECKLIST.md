# PSCV Room QA Checklist

Fecha: 2026-06-18

## Validaciones Locales Minimas

```bash
npm run typecheck
$env:CI="1"; npm run build
npm run smoke
```

Si se usa `next start`, define `SMOKE_BASE_URL` contra el puerto temporal.

## Smoke Remoto

```bash
$env:SMOKE_BASE_URL="https://app.rlead.xyz"; npm run smoke
```

En preview de rama, si Vercel responde `401` en `/`, confirmar deployment `Ready` con:

```bash
vercel ls --yes
vercel inspect <deployment-url>
```

## Flujo Alumno

- Login con cuenta valida.
- Calendario abre detalle de tarea.
- Lista de tareas abre detalle de tarea.
- Tarea entregada no aparece como pendiente.
- Material R2 abre preview o descarga.
- Preferencias afectan solo al usuario actual.
- Campana muestra y descarta notificaciones.

## Flujo Admin

- `Admin > Usuarios` cambia permisos y roles.
- `Admin > Avisos` crea broadcast y genera recordatorios.
- `Admin > Reportes` carga tareas, materiales, alumnos y auditoria.
- `Admin > Diagnostico` muestra Supabase, R2, destinos y biblioteca.
- `Admin > Materiales` sube a R2 solo con permiso R2.
- Importador R2 corre primero en `Simular`.

## Seguridad

- Sin sesion, estas rutas deben devolver `401` o `403`:
  - `GET /api/notifications`
  - `GET /api/reports/operations`
  - `GET /api/admin/notifications`
  - `GET /api/admin/r2/status`
  - `POST /api/uploads/presign`
- `audit_log` solo debe ser visible para perfiles con `reports:view`.
- `app_profiles` solo debe modificarse con `users:manage`.

## Deploy

- Commit creado.
- Push a `origin`.
- Vercel deployment `Ready`.
- Smoke en produccion tras promover.
