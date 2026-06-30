# PSCV Room User Guide

Fecha: 2026-06-29

## Alumno

1. Entra con tu cuenta autorizada.
2. Usa `Calendario` para ver tareas por dia, semana o mes.
3. Abre una tarea para ver materia, entrega, hora, estado, dias restantes, notas, plataforma y materiales.
4. Usa `Tareas` para revisar pendientes. Las tareas entregadas ya no quedan mezcladas con pendientes.
5. Usa `Materiales` para buscar documentos; `Previsualizar` abre el documento desde R2.
6. Usa la campana para ver avisos persistentes.
7. Usa `Preferencias` para cambiar solo tu vista: densidad, calendario y tamano de previews.

## Admin

1. Entra a `Admin`.
2. `Tareas`: actualiza estado, prioridad y visibilidad.
3. `Materias` y `Secciones`: ajusta colores, iconos y previews sin cambiar codigo.
4. `Materiales`: sube archivos a R2 si tu perfil tiene permiso `R2`.
5. `Usuarios`: administra rol y permisos por perfil. Evita dar `Owner` salvo cuentas principales.
6. `Avisos`: crea notificaciones para alumnos, admins o todos. Usa `Generar recordatorios` para tareas proximas.
7. `Reportes`: revisa resumen de tareas, materiales, seguimiento de alumnos y auditoria reciente.
8. `Diagnostico`: valida health, D1, R2, destinos, biblioteca e importador.

## Operacion R2

1. Abre `Admin > Diagnostico`.
2. Confirma que `R2` este activo.
3. Revisa bucket, endpoint, URL publica, variables, carpetas y objetos de muestra.
4. Usa `Simular` para ver cuantos objetos se importarian.
5. Usa `Sincronizar R2` solo cuando la simulacion sea correcta.

## Notificaciones

- La campana muestra avisos no descartados.
- `Marcar leidas` conserva el historial.
- `Descartar` oculta el aviso para el usuario.
- Los cambios de tareas visibles generan avisos persistentes para alumnos activos.

## Reportes

- `Tareas`: avance por materia, tipo, estado y prioridad.
- `Materiales`: conteo y volumen por seccion/proveedor.
- `Alumnos`: seguimiento por perfil activo.
- `Auditoria`: ultimos cambios en tablas operativas.
