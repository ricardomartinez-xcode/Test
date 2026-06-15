# PSCV Room evolution plan

## Objetivo

Evolucionar de AppSheet copiado a producto configurable:

- Supabase como base de datos, auth y RLS.
- Microsoft OAuth para identidad.
- R2 para archivos nuevos y pesados.
- Sheets solo como fuente legacy/importación.
- UI configurable sin tocar código.

## Configurable por alumno

- Vista inicial: calendario, tareas o materiales.
- Vista calendario: mes, semana, día.
- Densidad de tarjetas: compacta, cómoda, grande.
- Mostrar/ocultar materias.
- Color personalizado por materia solo para su cuenta.
- Tamaño de previews de materiales.
- Mostrar entregadas o solo pendientes.
- Orden de materias.

## Configurable por admin

- Materias: nombre, color, icono, tamaño de tarjeta, orden, activo/inactivo.
- Tipos de entrega: Tarea, Proyecto, Examen, Práctica, etc.
- Estados y reglas de visibilidad.
- Secciones/carpetas de materiales: nombre, color, icono, tamaño, preview style.
- Configuración global de calendario.
- Configuración global de listas.
- Branding: nombre, color principal, modo de logo.
- Roles y permisos.
- Subida de materiales a R2.
- Asociación de materiales a tareas.

## Materiales 2.0

La biblioteca debe tener estructura jerárquica:

```txt
Psicología Clínica
  Abuso Sexual
    PDF 1
    PDF 2
Test, cuestionarios, etc
  Cuestionario de adaptación para adolescentes
    Manual
    Cuadernillo
    Hoja de respuesta y Plantilla
```

Cada sección puede tener:

- color,
- icono,
- tamaño de tarjeta,
- estilo de preview,
- orden,
- visibilidad.

Cada material puede tener:

- proveedor: Drive, R2 o link externo,
- URL original,
- preview embebido,
- thumbnail,
- content type,
- tamaño,
- uploader,
- sección,
- observaciones.

## Migración desde Sheets

Hojas fuente detectadas:

- `Tareas`: 22 registros.
- `Materiales`: biblioteca amplia con Drive links, preview links, carpetas y rutas.
- `Usuarios`: 26 usuarios, varios admins.
- `Catalogos`: materias, estados, tipos, roles, ámbitos.

Orden de migración recomendado:

1. Crear esquema `db/001_pscvroom_evolution.sql`.
2. Insertar usuarios desde `Usuarios` en `app_profiles`.
3. Insertar materias y tipos desde `Catalogos`.
4. Insertar tareas desde `Tareas`.
5. Construir árbol de `material_sections` desde `Materiales.Ruta`.
6. Insertar materiales manteniendo links Drive como provider `drive`.
7. Activar uploads nuevos a R2.
8. Migrar archivos Drive a R2 por lotes, no todo de golpe.

## R2 Upload Flow

```txt
Admin selecciona archivo
  ↓
POST /api/uploads/presign
  ↓
PUT directo a R2
  ↓
Guardar metadata en materials
  ↓
Mostrar preview/thumbnail en vista alumno
```

## UI siguiente fase

Agregar panel Admin real con tabs:

- General
- Materias
- Tipos
- Materiales
- Secciones
- Usuarios
- Apariencia
- Importación

Agregar panel Alumno:

- Preferencias
- Mis materias
- Densidad
- Material previews
- Vista inicial
