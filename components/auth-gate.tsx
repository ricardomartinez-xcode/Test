"use client";

import { useEffect, useState } from "react";

type AuthGateProps = {
  children: React.ReactNode;
};

type SessionState = "loading" | "authenticated" | "unauthenticated" | "development";

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<SessionState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.ok) {
          setState("authenticated");
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "No se pudo validar tu sesión.");
        setState("unauthenticated");
      } catch {
        if (cancelled) return;

        // La UI sigue siendo etil con la base local en desarrollo,
        // pero nunca en producción: Access protege el Worker antes de llegar que aqu.
        if (process.env.NODE_ENV !== "production") {
          setState("development");
          return;
        }

        setError("No se pudo validar la sesión de Cloudflare Access.");
        setState("unauthenticated");
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="loginScreen authPage">
        <div className="loader" />
      </main>
    );
  }

  if (state === "authenticated" || state === "development") {
    return <>{children}</>;
  }

  return (
    <main className="loginScreen authPage">
      <section className="loginCard authCard authCardSimple">
        <img src="/icon.svg" className="authLogoMain" alt="PSCV Room" />
        <h1 className="authTitle">PSCV Room</h1>
        <p>Inicia sesión con tu cuenta institucional.</p>
        <button
          className="microsoftButton"
          onClick={() => window.location.reload()}
          type="button"
        >
          <span className="microsoftMark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          Continuar con Microsoft
        </button>
        {error ? <p className="authError">{error}</p> : null}
      </section>
    </main>
  );
}
