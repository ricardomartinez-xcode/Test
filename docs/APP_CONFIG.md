# Configuración operacional

## Modo demo

Sin `DATABASE_URL`, la app usa datos semilla y `localStorage`. Sirve para probar UI, flujo admin/lectura y diseño.

## Modo producción

Con `DATABASE_URL`, las rutas API pueden leer/escribir en Postgres.

Endpoints incluidos:

```txt
GET  /api/health
GET  /api/tasks
POST /api/tasks
POST /api/uploads/presign
```

## R2

El endpoint `/api/uploads/presign` devuelve una URL prefirmada para subir archivos directo al bucket.

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

## Seguridad pendiente para producción

Antes de compartir admin en producción, agregar:

- autenticación,
- middleware de sesión,
- protección de rutas `/admin`,
- auditoría en `audit_log`,
- validación de tamaño/tipo de archivo,
- rate limiting básico,
- borrado lógico en vez de delete físico.
