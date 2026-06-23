# Avisos y calendario Microsoft: diseño

## Objetivo

1. Evitar que el historial administrativo de avisos muestre una fila idéntica por alumno.
2. Explicar claramente qué hace la generación de recordatorios y por qué los avisos automáticos de tareas no aparecen en la campana del administrador.
3. Permitir que cada alumno autorice, con su propia cuenta Microsoft, la creación y actualización de eventos de tareas en su calendario.

## Avisos

`notifications` conserva una fila por destinatario porque el estado leído/oculto es individual. La API administrativa agrupará para presentación las filas con el mismo contenido, entidad y fecha de creación. Cada grupo mostrará destinatarios, leídos y ocultos. No se cambia el modelo ni la entrega a `/api/notifications`.

El botón se llamará `Crear recordatorios (3 días)` y explicará que crea un recordatorio por alumno y tarea visible, pendiente y con vencimiento dentro de los próximos tres días. Los avisos `task_created` y `task_updated` continúan dirigidos a alumnos; los avisos manuales respetan la audiencia seleccionada.

## Calendario

El login Azure solicitará `Calendars.ReadWrite` y `offline_access`, además de los alcances actuales. En el callback:

1. Supabase intercambia el código OAuth y establece la sesión.
2. Para perfiles `student`, el servidor cifra y guarda `provider_token` y `provider_refresh_token`.
3. Se sincronizan las tareas activas y visibles con `/me/events`.

Los tokens se cifran con AES-256-GCM usando `CALENDAR_TOKEN_ENCRYPTION_KEY`. Las tablas de conexión no conceden acceso a `anon` ni `authenticated`; solo las rutas de servidor con `SUPABASE_SERVICE_ROLE_KEY` las usan.

Cada pareja alumno/tarea conserva su `provider_event_id`. Crear una tarea crea el evento; editarla usa `PATCH`; ocultarla, entregarla, cancelarla o archivarla elimina el evento. Un `404` al actualizar se recupera creando un evento nuevo. Los fallos de un alumno no impiden guardar la tarea.

La renovación usa el refresh token de Microsoft y las variables `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` y `MICROSOFT_OAUTH_TENANT_ID`. Deben corresponder a la misma aplicación Azure configurada en Supabase.

## Interfaz

Preferencias mostrará:

- Estado conectado/no conectado.
- Última sincronización o error.
- Botón `Sincronizar ahora`.
- Botón `Reconectar Microsoft` cuando falte o expire el consentimiento.
- Botón `Desconectar`.

La interfaz no expone tokens.

## Verificación

- Pruebas unitarias para agrupación, cifrado y construcción de eventos.
- `npm run lint`.
- `npm run build`.
- Migración aplicada en producción.
- Push a `origin/main` y despliegue Vercel en estado `READY`.

