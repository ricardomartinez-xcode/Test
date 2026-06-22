# Gestión de materias y alumnos

La ruta administrativa es `/gestion-academica`. Solo la puede operar un perfil `owner` o un administrador con los permisos correspondientes.

## Crear una materia

1. Abre `https://TU-DOMINIO/gestion-academica` con una cuenta administradora.
2. Completa nombre, nombre corto opcional, color, icono y tamaño de tarjeta.
3. Pulsa **Crear materia**.
4. Para conservar el historial de tareas, una materia se desactiva y reactiva; no se elimina físicamente.

Las materias se guardan en `public.courses` y se pueden usar inmediatamente al crear tareas.

## Invitar un alumno

1. Completa nombre, correo y número de control opcional.
2. Pulsa **Invitar alumno**.
3. La aplicación crea o actualiza su fila en `public.app_profiles` y usa Supabase Auth para enviar la invitación.
4. El alumno completa su acceso desde el correo recibido.

## Configuración de despliegue

Antes de usar la invitación de alumnos:

1. Ejecuta `db/009_academic_management.sql` en la base de datos de Supabase.
2. En Vercel o el entorno de producción configura `SUPABASE_SERVICE_ROLE_KEY`. Es una variable solo de servidor: nunca debe llevar el prefijo `NEXT_PUBLIC_` ni exponerse en el navegador.
3. Configura `NEXT_PUBLIC_APP_URL` con el dominio final de la aplicación.
4. En Supabase Auth agrega `https://TU-DOMINIO/auth/callback` a las Redirect URLs y verifica que el proveedor de correo de invitaciones esté configurado.

El panel principal existente de **Usuarios** se mantiene para cambiar roles, permisos o activar/desactivar perfiles ya creados.
