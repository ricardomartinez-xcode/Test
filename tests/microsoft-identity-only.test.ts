import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const removedPaths = [
  "../app/api/calendar/route.ts",
  "../lib/server/calendar-crypto.ts",
  "../lib/server/calendar-sync.ts",
  "../lib/server/microsoft-calendar.ts",
];

test("uses Microsoft only for identity and removes calendar integration code", async () => {
  const authGate = await readFile(new URL("../components/auth-gate.tsx", import.meta.url), "utf8");
  const appShell = await readFile(new URL("../components/app-shell-v5.tsx", import.meta.url), "utf8");
  const authz = await readFile(new URL("../lib/server/authz.ts", import.meta.url), "utf8");

  assert.match(authGate, /\/api\/auth\/session/);
  assert.match(authz, /cf-access-jwt-assertion/);
  assert.match(authz, /ALLOW_DEV_AUTH/);
  assert.doesNotMatch(`${authGate}\n${appShell}`, /Calendars\.ReadWrite|\/api\/calendar|CalendarConnectionSettings/);

  for (const path of removedPaths) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});
