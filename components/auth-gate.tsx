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
      setError("No se pudo iniciar sesión. Revisa la configuración de autenticación.");
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
        <section className="loginCard authCard authCardSimple">
          <img src="/icon.svg" className="authLogoMain" alt="PSCV Room" />

          <h1 className="authTitle">PSCV Room</h1>

          <button className="microsoftButton" onClick={signInWithMicrosoft} type="button" disabled={!supabase || busy}>
            <span className="microsoftMark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            {busy ? "Redirigiendo..." : "Continuar con Microsoft"}
          </button>

          {error ? <p className="authError">{error}</p> : null}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
