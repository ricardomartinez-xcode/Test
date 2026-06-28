# PSCV Room: plan de migración a Cloudflare

## Objetivo

Trasladar la aplicación Next.js actual desde Vercel + Supabase a Cloudflare sin rediseñar la interfaz ni romper los contratos de la UI. La plataforma destino queda compuesta por:

| Capacidad actual | Destino Cloudflare | Decisión |
| --- | --- | --- |
| Vercel / Next.js | Workers + OpenNext | Conserva App Router, Route Handlers y SSR. |
| Supabase Postgres | D1 | Esquema SQLite, migraciones versionadas e importación verificable. |
| Supabase Auth Azure | Cloudflare Access + Microsoft Entra ID | SSO corporativo delante del Worker; identidad verificada en servidor. |
| Supabase RLS | Capa de autorización de aplicación | Todas las escrituras pasan por `requirePermission`. |
| R2 vía API S3 | Binding `MATERIALS_BUCKET` | Lectura/escritura nativa desde el Worker; no se exponen claves S3. |
| Variables Vercel | Variables y secretos de Workers | Valores públicos mínimos y secretos solo en Cloudflare. |
| Datos demo | D1 local / staging | El modo demo no se habilita en producción. |

## Inventario confirmado

- 14 tablas operativas en Supabase: perfiles, configuración, cursos, tipos de tarea, tareas, secciones/materiales, relaciones, grupos, preferencias, notificaciones y auditoría.
- 849 registros en total, incluidos 155 materiales, 27 tareas, 27 perfiles, 224 notificaciones y 372 eventos de auditoría.
- El repositorio conserva Next.js App Router, APIs internas y CSS nativo. La UI (`AppShellV5`, `AdminHub`, `MaterialLibrary`, gestión académica y estilos) se mantiene.

## Arquitectura objetivo

```text
Usuario
  -> Cloudflare Access (Microsoft Entra ID)
  -> Cloudflare Worker / OpenNext
       -> D1: datos relacionales y auditoría
       -> R2: archivos de materiales
       -> Resend: avisos por correo (opcional)
```

### Seguridad

1. Access protege rutas públicas y previsualizaciones.
2. El Worker valida el JWT `Cf-Access-Jwt-Assertion`, emisor y audiencia.
3. El email validado se resuelve en `app_profiles`; sus flags sustituyen las políticas RLS.
4. Las operaciones de escritura verifican permiso y registran auditoría.
5. R2 se sirve mediante rutas autenticadas o dominio público separado, según visibilidad del material.

## Fases de implementación

### Fase 1 — Base de plataforma

- [x] Rama de migración creada.
- [x] Configuración de Wrangler/OpenNext añadida.
- [ ] Crear D1 `pscv-room` y R2 `pscv-room-materials` en staging.
- [ ] Registrar variables/secretos de Access y correo.
- [ ] Conectar GitHub con Workers Builds o configurar GitHub Actions.

### Fase 2 — Datos

- [ ] Aplicar `migrations/0001_pscv_room.sql` a D1 local y staging.
- [ ] Exportar datos de Supabase en orden de dependencias.
- [ ] Cargar datos a D1 conservando UUIDs y marcas de tiempo.
- [ ] Comparar conteos, claves foráneas y checksums de materiales.
- [ ] Mantener Supabase en solo lectura durante la validación.

Orden de importación:

1. `app_profiles`, `app_settings`, `courses`, `task_types`, `material_sections`, `group_columns`.
2. `tasks`, `materials`, `notification_preferences`.
3. `task_materials`, `group_column_values`, `user_course_preferences`.
4. `notifications`, `audit_log`.

### Fase 3 — Backend

- [ ] Sustituir cliente `postgres` por adaptador D1.
- [ ] Sustituir SDK S3 por binding R2.
- [ ] Eliminar clientes y callbacks de Supabase.
- [ ] Introducir `getCurrentIdentity` y `requirePermission` en todas las mutaciones.
- [ ] Convertir sentencias específicas de Postgres a SQLite/D1.
- [ ] Mantener contratos JSON de `/api/*` para no modificar componentes.

### Fase 4 — Identidad y permisos

- [ ] Configurar Access Application para staging y producción.
- [ ] Conectar IdP Microsoft Entra ID.
- [ ] Validar JWT de Access en Worker.
- [ ] Sembrar/migrar perfiles por correo y revisar flags de permisos.
- [ ] Probar matriz estudiante/admin/owner, incluidas rutas de administración y archivos.

### Fase 5 — Paridad y corte

- [ ] Smoke tests: tareas, materiales, grupos, avisos, reportes y gestión académica.
- [ ] Prueba de subida/descarga R2 y validación de tipos/tamaño.
- [ ] Comparación de respuestas entre Vercel/Supabase y Worker/D1.
- [ ] Habilitar preview protegida por Access.
- [ ] Cambio DNS y monitorización.
- [ ] Conservar Vercel/Supabase durante la ventana de reversión.

## Criterios de aceptación

- Misma navegación, estilos y componentes visibles.
- Todas las rutas API conservan sus contratos documentados.
- Conteos D1 coinciden con Supabase antes del corte.
- Ningún secreto S3 o de Supabase está presente en el bundle o repositorio.
- Usuarios no autorizados reciben 401/403 en operaciones protegidas.
- Archivos R2 existentes se resuelven por clave y se pueden descargar según permiso.
- Rollback probado: DNS/deployment a Vercel sin pérdida de datos de la fuente.

## Riesgos y mitigación

| Riesgo | Mitigación |
| --- | --- |
| D1 no implementa RLS de Postgres | Autorización obligatoria en repositorios/API, pruebas de permisos y auditoría. |
| SQL Postgres no compatible | Migración consolidada SQLite y tests por endpoint. |
| Inconsistencia durante exportación | Congelación de escrituras o delta final auditado antes del corte. |
| Materiales privados expuestos | Rutas autenticadas, claves no predecibles y dominio R2 separado. |
| Fallo en SSO | Preview protegida, validación de JWT, plan de emergencia y rollback. |

## Operación local

```bash
npm install
cp .dev.vars.example .dev.vars
npm run cf:dev
```

## Operación de staging

```bash
npm run cf:build
npx wrangler d1 migrations apply pscv-room --env staging --remote
npm run cf:deploy:staging
```

> Los nombres e identificadores reales de D1/R2 y el AUD de Access se agregan únicamente después de aprobar la provisión.
