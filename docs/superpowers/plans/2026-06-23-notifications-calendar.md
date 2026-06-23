# Notifications And Microsoft Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar avisos administrativos y sincronizar las tareas visibles con el calendario Microsoft autorizado individualmente por cada alumno.

**Architecture:** La UI de avisos consume grupos preparados por la API sin modificar las filas por destinatario. La sincronización de calendario vive en servicios de servidor: el callback OAuth almacena tokens cifrados, las rutas administrativas sincronizan eventos y una API de preferencias permite consultar, sincronizar o desconectar.

**Tech Stack:** Next.js App Router, React, Supabase Auth/Postgres, Microsoft Graph, Web Crypto de Node, Zod, Node test runner.

---

### Task 1: Utilidades probadas

**Files:**
- Create: `lib/server/notification-groups.ts`
- Create: `lib/server/calendar-crypto.ts`
- Create: `lib/server/microsoft-calendar.ts`
- Create: `tests/notification-groups.test.ts`
- Create: `tests/calendar-crypto.test.ts`
- Create: `tests/microsoft-calendar.test.ts`
- Modify: `package.json`

- [ ] Escribir pruebas que esperan agrupación por contenido/fecha, round-trip de AES-GCM y un evento de 30 minutos.
- [ ] Ejecutar `npm test` y confirmar fallos por módulos inexistentes.
- [ ] Implementar las funciones mínimas.
- [ ] Ejecutar `npm test` y confirmar que pasan.

### Task 2: Persistencia y sincronización de calendario

**Files:**
- Create: `db/011_microsoft_calendar_sync.sql`
- Create: `lib/supabase/service.ts`
- Create: `lib/server/calendar-sync.ts`
- Modify: `app/auth/callback/route.ts`
- Modify: `components/auth-gate.tsx`

- [ ] Añadir tablas privadas de conexiones y enlaces tarea/evento.
- [ ] Añadir cliente service-role lazy.
- [ ] Solicitar `Calendars.ReadWrite offline_access` solo después de reconocer un perfil alumno.
- [ ] Guardar tokens cifrados y sincronizar tareas activas durante el callback.
- [ ] Verificar TypeScript con `npm run build`.

### Task 3: APIs y mutaciones de tareas

**Files:**
- Create: `app/api/calendar/route.ts`
- Create: `app/api/admin/tasks/route.ts`
- Modify: `app/api/admin/tasks/[id]/route.ts`
- Modify: `components/app-shell-v5.tsx`
- Modify: `components/admin-hub.tsx`

- [ ] Crear API de estado, sincronización y desconexión.
- [ ] Crear tareas mediante ruta administrativa.
- [ ] Sincronizar después de crear, editar, entregar, cancelar o archivar.
- [ ] Mantener el guardado exitoso aunque Graph falle y devolver resumen de sincronización.

### Task 4: UX de avisos y calendario

**Files:**
- Modify: `app/api/admin/notifications/route.ts`
- Modify: `components/admin-hub.tsx`
- Modify: `components/app-shell-v5.tsx`
- Modify: `app/evolution.css`

- [ ] Agrupar el historial administrativo.
- [ ] Renombrar y explicar recordatorios de tres días.
- [ ] Mostrar destinatarios/leídos/ocultos.
- [ ] Añadir estado y acciones de Outlook en Preferencias.

### Task 5: Operación y entrega

**Files:**
- Modify: `.env.example`
- Modify: `docs/OPERATIONS_RUNBOOK.md`

- [ ] Documentar variables Microsoft y cifrado.
- [ ] Aplicar `db/011_microsoft_calendar_sync.sql` en producción.
- [ ] Configurar secretos disponibles en Vercel.
- [ ] Ejecutar `npm test`, `npm run lint` y `npm run build`.
- [ ] Commit, push a `origin/main`, esperar Vercel `READY` y verificar endpoints públicos no autenticados.
