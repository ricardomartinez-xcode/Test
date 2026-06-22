# Entrega de avisos: correo y navegador

PSCV Room conserva el centro de avisos existente y añade dos canales opcionales por usuario.

## Activar como usuario

Después de iniciar sesión aparece el botón flotante **Avisos**.

- **Navegador:** pide el permiso nativo del navegador. Cuando PSCV Room permanece abierto, los avisos nuevos muestran una notificación nativa si la pestaña está en segundo plano.
- **Sonido:** reproduce un tono breve para avisos nuevos después de que el usuario haya interactuado con el control de Avisos.
- **Correo:** activa el correo para anuncios. La opción se guarda en `notification_preferences.email_enabled`.

La entrega nativa de este cambio funciona mientras la aplicación está abierta. Entrega con el navegador totalmente cerrado requeriría una segunda fase de Web Push (service worker, VAPID y suscripciones).

## Correo de anuncios

Al publicar un anuncio desde Administración > Avisos, PSCV Room guarda primero las notificaciones en Supabase y después intenta enviar correo únicamente a usuarios activos que hayan activado el canal de correo y no hayan deshabilitado esa categoría.

Configura estas variables solo en el servidor (por ejemplo, Vercel):

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="PSCV Room <avisos@tu-dominio.mx>"
```

También se necesita `SUPABASE_SERVICE_ROLE_KEY`, ya utilizada para operaciones seguras de administración. No expongas ninguna de estas variables con el prefijo `NEXT_PUBLIC_`.

En Resend, verifica el dominio usado por `EMAIL_FROM` antes de enviar a estudiantes. La respuesta del endpoint de avisos incluye un resumen técnico de correos enviados, omitidos o con error para diagnóstico.
