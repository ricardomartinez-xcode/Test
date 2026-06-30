"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";

type AuthGateProps = {
  children: ReactNode;
};

type SessionState = "loading" | "authenticated" | "unauthenticated" | "development";

type SessionErrorPayload = {
  error?: string;
};

const SESSION_TIMEOUT_MS = 12_000;

function getSessionErrorMessage(status: number, payload: SessionErrorPayload) {
  if (payload.error) return payload.error;

  if (status === 401) {
    return "Cloudflare Access no entregó una sesión para esta aplicación. Vuelve a iniciar el acceso institucional.";
  }

  if (status === 403) {
    return "Tu cuenta inició sesión, pero no tiene un perfil activo autorizado en PSCV Room.";
  }

  if (status === 404) {
    return "No se encontró el endpoint de sesión. Verifica que el dominio se esté sirviendo desde el Worker pscv-room.";
  }

  return "No se pudo validar tu sesión institucional.";
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<SessionState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retrySessionCheck = useCallback(() => {
    setError(null);
    setState("loading");
    setAttempt((current) => current + 1);
  }, []);

  const restartAccess = useCallback(() => {
    window.location.assign(window.location.href);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (cancelled) return;

        if (response.ok) {
          setState("authenticated");
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as SessionErrorPayload;
        setError(getSessionErrorMessage(response.status, payload));
        setState("unauthenticated");
      } catch (reason) {
        if (cancelled) return;

        if (process.env.NODE_ENV !== "production") {
          setState("development");
          return;
        }

        const timedOut = reason instanceof DOMException && reason.name === "AbortError";
        setError(
          timedOut
            ? "La comprobación de Cloudflare Access tardó demasiado. Confirma que app.rlead.xyz apunta al Worker pscv-room."
            : "No se pudo conectar con la comprobación de sesión de Cloudflare Access.",
        );
        setState("unauthenticated");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  if (state === "loading") {
    return (
      <main className="loginScreen authPage" aria-busy="true" aria-live="polite">
        <section className="loginCard authCard authCardSimple authStatusCard">
          <img src="/icon.svg" className="authLogoMain" alt="PSCV Room" />
          <h1 className="authTitle">Verificando acceso institucional</h1>
          <p>Estamos comprobando tu sesión segura antes de abrir PSCV Room.</p>
          <div className="loader" aria-hidden="true" />
        </section>
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
        <h1 className="authTitle">Acceso no disponible</h1>
        <p>PSCV Room protege el acceso institucional mediante Cloudflare Access.</p>
        {error ? (
          <p className="authError" role="alert">
            {error}
          </p>
        ) : null}
        <div className="authActions">
          <button className="microsoftButton" onClick={restartAccess} type="button">
            Volver a iniciar acceso
          </button>
          <button className="authSecondaryButton" onClick={retrySessionCheck} type="button">
            Reintentar comprobación
          </button>
        </div>
      </section>
    </main>
  );
}
