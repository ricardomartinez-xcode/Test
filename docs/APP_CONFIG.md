# Configuración operacional

## Modo demo

Sin `DATABASE_URL`, la app usa datos semilla y `localStorage`. Sirve para probar UI, flujo admin/lectura y diseño.

## Modo producción

La app usa Supabase para auth, datos y RLS. `DATABASE_URL` solo queda para rutas legacy o herramientas directas.

Endpoints incluidos:

```txt
GET  /api/health
GET  /api/tasks
POST /api/uploads/presign
GET  /api/notifications
GET  /api/reports/operations
GET  /api/admin/r2/status
```

## R2

El endpoint `/api/uploads/presign` devuelve una URL prefirmada para subir archivos directo al bucket. Requiere sesion y permiso `r2:manage`.

Flujo recomendado:

```txt
UI selecciona archivo
  ↓
POST /api/uploads/presign
  ↓
PUT directo a R2 con uploadUrl
  ↓
Guardar metadata en materials
```

## Seguridad en producción

Implementado en la fase operativa:

- autenticación,
- RLS en tablas publicas,
- permisos por perfil admin,
- protección de APIs admin,
- auditoría en `audit_log`,
- borrado lógico de tareas,
- notificaciones persistentes,
- reportes operativos.

Pendiente para una fase posterior si aumenta el uso:

- rate limiting por IP/usuario,
- limites estrictos de tamano/tipo de archivo por curso,
- backups automáticos documentados.
