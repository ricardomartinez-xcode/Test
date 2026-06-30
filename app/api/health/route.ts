import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/server/db";
import { getCloudflareEnv, getMaterialsBucket } from "@/lib/server/cloudflare";

export async function GET() {
  const database = await hasDatabase();
  let r2Binding = false;
  try {
    await getMaterialsBucket();
    r2Binding = true;
  } catch {
    r2Binding = false;
  }
  let authConfigured = false;
  try {
    const env = await getCloudflareEnv();
    authConfigured = env.AUTH_MODE === "development"
      ? Boolean(env.DEV_AUTH_EMAIL)
      : Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);
  } catch {
    authConfigured = false;
  }
  return NextResponse.json({
    ok: true,
    app: "PSCV Room 2.0",
    mode: database ? "database" : "demo",
    auth: {
      provider: "cloudflare-access-microsoft",
      configured: authConfigured,
    },
    integrations: {
      d1: database,
      r2: r2Binding,
      sheetsLegacy: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
    },
  });
}
