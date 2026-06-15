# Supabase Auth + Microsoft OAuth

La app usa Supabase Auth con proveedor Azure/Microsoft.

## Variables en Vercel

```env
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
NEXT_PUBLIC_APP_URL="https://test-relead.vercel.app"
NEXT_PUBLIC_ADMIN_EMAILS="martinez_28699@univdep.edu.mx,..."
```

## Configuración en Microsoft Entra ID

1. Entrar a Azure Portal.
2. Ir a Microsoft Entra ID.
3. App registrations.
4. New registration.
5. Agregar redirect URI web:

```txt
https://<project-ref>.supabase.co/auth/v1/callback
```

6. Crear Client Secret.
7. Copiar Application Client ID y Secret Value.

## Configuración en Supabase

1. Supabase Dashboard.
2. Authentication.
3. Providers.
4. Azure.
5. Activar proveedor.
6. Pegar Client ID y Client Secret.
7. Revisar Site URL:

```txt
https://test-relead.vercel.app
```

8. Agregar Redirect URLs permitidas:

```txt
https://test-relead.vercel.app/**
http://localhost:3000/**
```

## Rol temporal

Actualmente el rol admin se calcula en UI por `NEXT_PUBLIC_ADMIN_EMAILS`. Esto solo sirve para prototipo visual.

En producción el rol debe venir de una tabla `app_users` y proteger datos con RLS.

## Provider usado en código

```ts
supabase.auth.signInWithOAuth({
  provider: "azure",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: "openid email profile",
  },
});
```
