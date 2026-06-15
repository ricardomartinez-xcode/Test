import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/server/db";
import { hasR2Config } from "@/lib/server/r2";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "PSCV Room 2.0",
    mode: hasDatabase() ? "database" : "demo",
    auth: {
      provider: "supabase-azure-microsoft",
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
    },
    integrations: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      postgresDirect: hasDatabase(),
      r2: hasR2Config(),
      sheetsLegacy: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
    },
  });
}
