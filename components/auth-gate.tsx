"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [ready, setReady] = useState(!hasSupabaseBrowserConfig());
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
      setBusy(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signInWithMicrosoft() {
    setError(null);

    if (!supabase) {
      setError("Supabase Auth no está configurado en producción.");
      return;
    }

    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (signInError) {
      setBusy(false);
      setError(signInError.message);
    }
  }

  if (!ready) {
    return (
      <main className="loginScreen authPage">
        <div className="loader" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="loginScreen authPage">
        <section className="loginCard authCard">
          <div className="authBrand">
            <img src="/icon.svg" className="loginLogo" alt="PSCV" />
            <div>
              <p className="eyebrow">PSCV Room 2.0</p>
              <strong>Acceso seguro</strong>
            </div>
          </div>

          <h1>Inicia sesión con Microsoft</h1>
          <p className="muted">
            Usa tu cuenta institucional o autorizada. Tu rol se asigna automáticamente desde Supabase.
          </p>

          <button className="microsoftButton" onClick={signInWithMicrosoft} type="button" disabled={!supabase || busy}>
            <span className="microsoftMark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            {busy ? "Redirigiendo..." : "Continuar con Microsoft"}
          </button>

          {!supabase ? (
            <p className="authError">
              Supabase Auth no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
            </p>
          ) : null}
          {error ? <p className="authError">{error}</p> : null}

          <div className="loginMeta">
            <span>Microsoft OAuth</span>
            <span>Supabase Auth</span>
            <span>Roles por correo</span>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
