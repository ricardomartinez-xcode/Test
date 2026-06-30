# Arquitectura propuesta

## Decisión

Para PSCV Room 2.0 la mejor base no es seguir usando Google Sheets como backend principal. La app debe quedar así:

```txt
Next.js UI
  ↓
API Routes / Server Actions
  ↓
Cloudflare D1
  ↓
Cloudflare R2 para archivos
```

Google Sheets queda como fuente legacy para migrar, respaldar o generar reportes simples.

## Por qué no Sheets como backend principal

Sheets es excelente para prototipos y edición manual, pero se vuelve frágil cuando hay:

- permisos por rol,
- muchas escrituras,
- auditoría,
- archivos grandes,
- automatizaciones de calendario,
- datos derivados,
- historial de cambios,
- y apps públicas/admin separadas.

En el sistema actual, la app depende de fórmulas como `Días restantes` y `Visible lectura`. Eso funciona, pero si una fórmula se rompe o una columna cambia, la UI también se rompe.

## Cloudflare D1

Cloudflare D1 guarda datos estructurados:

- usuarios,
- materias,
- tareas,
- estados,
- materiales como metadata,
- horarios,
- auditoría,
- sincronización de calendario.

Esto permite filtros reales, constraints, indices, vistas, historial y consultas confiables dentro del mismo despliegue de Cloudflare.

## R2

Cloudflare R2 debe guardar archivos:

- PDFs,
- presentaciones,
- imágenes,
- manuales,
- recursos multimedia,
- previews o versiones descargables.

La base solo guarda metadata y `storage_key`.

## Modelo de autorización recomendado

```txt
reader:
  puede ver tareas activas y materiales públicos

admin:
  puede crear, editar, entregar, cancelar y borrar lógicamente

owner:
  puede administrar usuarios, catálogos y configuración
```

La identidad se valida con Cloudflare Access y Microsoft Entra ID. La autorizacion de la app vive en `app_profiles` dentro de D1.

## Regla de visibilidad 2.0

En vez de depender de una hoja espejo:

```sql
status not in ('Entregado', 'Cancelado')
and due_date >= current_date
and archived_at is null
```

La vista SQL `active_reader_tasks` ya implementa ese patrón.
