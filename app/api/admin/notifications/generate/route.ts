import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const generateSchema = z.object({
  windowDays: z.number().int().min(1).max(14).default(3),
});

export async function POST(request: Request) {
  try {
    await requirePermission(request, "notifications:manage");
    const supabase = await createSupabaseServerClient();
    const body = generateSchema.parse(await request.json().catch(() => ({})));
    const { data, error } = await supabase.rpc("generate_due_task_notifications", { window_days: body.windowDays });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, inserted: data ?? 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
