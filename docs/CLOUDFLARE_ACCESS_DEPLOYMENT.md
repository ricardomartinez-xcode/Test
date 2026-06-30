# PSCV Room: despliegue canónico con Cloudflare Access

## Topología de producción

La URL canónica es `https://app.rlead.xyz` y debe ejecutarse en el Worker `pscv-room`.

PSCV Room usa bindings nativos de Cloudflare para D1 y R2, además del encabezado `cf-access-jwt-assertion` emitido por Cloudflare Access. Por ello, Vercel puede usarse sólo para previews o pruebas visuales; no es un origen de producción compatible con la autenticación y persistencia de PSCV Room.

## Requisitos antes de publicar

1. El Worker debe estar asociado a `app.rlead.xyz` mediante el bloque `routes` de `wrangler.jsonc`.
2. Cloudflare Access debe tener una aplicación Self-hosted para `https://app.rlead.xyz`.
3. La aplicación Access debe permitir el proveedor de identidad institucional elegido y una política de acceso explícita.
4. Configura los valores del Worker fuera de Git:

   ```bash
   wrangler secret put ACCESS_TEAM_DOMAIN
   wrangler secret put ACCESS_AUD
   ```

   `ACCESS_TEAM_DOMAIN` es el dominio del equipo de Access, sin protocolo. `ACCESS_AUD` es el Audience (AUD) de la aplicación Access.
5. Aplica las migraciones y comprueba que cada persona autorizada tenga un registro activo en `app_profiles`:

   ```bash
   wrangler d1 migrations apply pscv-room --remote
   ```
6. Publica el Worker:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run cf:deploy
   ```

## Diagnóstico del acceso

- `401 Sesión de Cloudflare Access no encontrada`: el hostname no está protegido por Access, la sesión venció o el navegador no alcanzó el Worker por el dominio canónico.
- `403 Perfil no encontrado o no autorizado`: Access autenticó a la persona, pero falta su perfil o está inactivo en D1.
- `500 Cloudflare Access no está configurado`: faltan `ACCESS_TEAM_DOMAIN` o `ACCESS_AUD` en el Worker.
- `500 D1 binding DB no configurado`: el origen no es el Worker `pscv-room` o se publicó sin sus bindings.

## Regla de operación

No mezcles el host de producción entre Vercel y Cloudflare Workers. Si se conserva el proyecto Vercel, retira `app.rlead.xyz` de sus aliases de producción y usa sus dominios `*.vercel.app` exclusivamente para previews no protegidos.
