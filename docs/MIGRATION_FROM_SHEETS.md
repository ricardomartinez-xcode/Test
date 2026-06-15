# Migración desde Google Sheets

## Hojas detectadas del sistema actual

- `Tareas`: fuente principal editable.
- `Tareas_Lectura`: espejo filtrado para alumnos.
- `Materiales`: biblioteca de recursos.
- `Catalogos`: opciones de materia, estado, tipo de entrega.
- `Horario`: horario de clases.
- `Usuarios`: roles y permisos históricos.
- `_CalendarSync` y `_CalendarSyncLogs`: soporte de Apps Script.

## Plan de migración

### Fase 1: Congelar estructura

No cambiar nombres de columnas en Sheets mientras se migra.

### Fase 2: Exportar CSV

Exportar estas hojas como CSV:

```txt
Tareas.csv
Materiales.csv
Usuarios.csv
Catalogos.csv
Horario.csv
```

### Fase 3: Crear Postgres

Ejecutar:

```sql
\i db/schema.sql
```

### Fase 4: Importar datos

Mapeo recomendado:

| Sheets | Postgres |
|---|---|
| Tareas.ID | tasks.id legacy externo o columna opcional legacy_id |
| Tareas.Materia | tasks.course |
| Tareas.Fecha de entrega | tasks.due_date |
| Tareas.Hora | tasks.due_time |
| Tareas.Actividad / tarea | tasks.title |
| Tareas.Material necesario | tasks.material_needed |
| Tareas.Link al material | tasks.material_url |
| Tareas.Tipo de entrega | tasks.delivery_type |
| Tareas.Estado | tasks.status |
| Tareas.Observaciones | tasks.notes |
| Tareas.Plataforma de entrega | tasks.platform_url |
| Tareas.Calendar Event ID | tasks.calendar_event_id |

### Fase 5: Reemplazar Tareas_Lectura

Ya no hace falta una hoja espejo. Usar la vista SQL:

```sql
select * from active_reader_tasks;
```

### Fase 6: Migrar archivos

Para materiales existentes en Google Drive:

1. Mantener links Drive temporalmente.
2. Subir nuevos archivos a R2.
3. Migrar los más usados a R2.
4. Guardar `storage_key`, `content_type`, `size_bytes` y `preview_url`.

### Fase 7: Desactivar AppSheet Admin

Cuando la app nueva permita CRUD real:

- dejar AppSheet en solo lectura por transición,
- luego apagarlo,
- conservar Sheets como backup hasta validar datos.
