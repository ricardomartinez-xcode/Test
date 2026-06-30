import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps PSCV authentication delegated to Cloudflare Access and compatible with Keycloak", async () => {
  const [authGate, authz, healthRoute, envTypes, runbook] = await Promise.all([
    readFile(new URL("../components/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/authz.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../types/cloudflare-env.d.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/CLOUDFLARE_ACCESS_DEPLOYMENT.md", import.meta.url), "utf8"),
  ]);

  assert.match(authGate, /Cloudflare Access/);
  assert.match(authz, /cf-access-jwt-assertion/);
  assert.match(healthRoute, /provider: "cloudflare-access"/);
  assert.match(healthRoute, /identityProvider/);
  assert.doesNotMatch(healthRoute, /cloudflare-access-microsoft/);
  assert.match(envTypes, /AUTH_IDENTITY_PROVIDER/);
  assert.match(runbook, /Configurar Keycloak como broker OIDC/);
  assert.match(runbook, /Email claim name: email/);
  assert.match(runbook, /cf-access-jwt-assertion/);
  assert.doesNotMatch(`${authGate}\n${authz}`, /KEYCLOAK_CLIENT_SECRET|KC_CLIENT_SECRET/);
});
