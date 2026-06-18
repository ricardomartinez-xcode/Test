import assert from "node:assert/strict";

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:3000");

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function request(path, options = {}) {
  const response = await fetch(url(path), {
    redirect: "manual",
    ...options,
    headers: {
      "user-agent": "pscv-smoke-tests/1.0",
      ...(options.headers ?? {}),
    },
  });
  return response;
}

async function json(path) {
  const response = await request(path);
  assert.equal(response.ok, true, `${path} should return 2xx, got ${response.status}`);
  return response.json();
}

async function checkHome() {
  const response = await request("/");
  assert.equal(response.ok, true, `/ should return 2xx, got ${response.status}`);
  const html = await response.text();
  assert.match(html, /PSCV Room 2\.0|PSCV Room/, "home page should render the PSCV app shell");
}

async function checkHealth() {
  const health = await json("/api/health");
  assert.equal(health.ok, true, "health.ok should be true");
  assert.equal(health.app, "PSCV Room 2.0", "health app name should match");
  assert.equal(typeof health.integrations, "object", "health should include integrations");
  assert.equal(typeof health.integrations.r2, "boolean", "health should report R2 config");
  assert.equal(typeof health.integrations.supabase, "boolean", "health should report Supabase config");
}

async function checkTasks() {
  const payload = await json("/api/tasks");
  assert.ok(Array.isArray(payload.tasks), "tasks payload should include tasks[]");
  assert.ok(payload.tasks.length > 0, "tasks[] should not be empty in smoke mode");
  const sample = payload.tasks[0];
  for (const field of ["id", "title", "dueDate", "dueTime", "status"]) {
    assert.ok(field in sample, `task should include ${field}`);
  }
}

async function checkUploadDestinations() {
  const payload = await json("/api/uploads/destinations");
  assert.equal(payload.ok, true, "destinations.ok should be true");
  assert.ok(Array.isArray(payload.destinations), "destinations should be an array");

  const paths = new Set(payload.destinations.map((destination) => destination.path));
  for (const requiredPath of [
    "Alteraciones de la conducta",
    "Compendio de Psicología",
    "Evaluacion Psicológica I",
    "Procesos Grupales",
    "Teorias del Aprendizaje",
  ]) {
    assert.equal(paths.has(requiredPath), true, `missing destination: ${requiredPath}`);
  }
}

async function checkMaterialsLibraryContract() {
  const payload = await json("/api/materials/library?limit=25");
  assert.equal(payload.ok, true, "materials library ok should be true");
  assert.ok(Array.isArray(payload.sections), "materials library should include sections[]");
  assert.ok(Array.isArray(payload.materials), "materials library should include materials[]");
  assert.equal(typeof payload.summary, "object", "materials library should include summary");

  for (const material of payload.materials) {
    assert.ok("preview_url" in material, "material should expose preview_url");
    assert.ok("public_url" in material, "material should expose public_url");
    if (material.r2_key) {
      assert.match(
        material.preview_url ?? "",
        /^\/api\/materials\/.+\/file\?mode=preview|^https?:\/\//,
        "R2 material preview should be internal signed route or HTTP fallback",
      );
    }
  }
}

async function checkProtectedOperationsRoutes() {
  for (const path of ["/api/notifications", "/api/reports/operations", "/api/admin/notifications"]) {
    const response = await fetch(new URL(path, baseUrl));
    assert.ok([401, 403].includes(response.status), `${path} should require an authenticated session, got ${response.status}`);
  }
}

const checks = [
  ["home", checkHome],
  ["health", checkHealth],
  ["tasks", checkTasks],
  ["upload destinations", checkUploadDestinations],
  ["materials library contract", checkMaterialsLibraryContract],
  ["protected operations routes", checkProtectedOperationsRoutes],
];

console.log(`Running PSCV smoke tests against ${baseUrl.toString()}`);

for (const [name, check] of checks) {
  await check();
  console.log(`ok - ${name}`);
}

console.log("Smoke tests passed.");
