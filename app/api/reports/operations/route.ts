import { NextResponse } from "next/server";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { d1All } from "@/lib/server/d1-data";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "reports:view");
    const [tasks, materials, students, audit] = await Promise.all([
      d1All<Record<string, unknown>>("SELECT * FROM report_task_summary ORDER BY course, task_type"),
      d1All<Record<string, unknown>>("SELECT * FROM report_material_summary ORDER BY section_path"),
      d1All<Record<string, unknown>>(
        `SELECT role, active, COUNT(*) AS total
         FROM app_profiles
         GROUP BY role, active
         ORDER BY active DESC, role ASC`,
      ),
      d1All<Record<string, unknown>>("SELECT id, actor_id, action, entity, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 40"),
    ]);

    return NextResponse.json({ ok: true, tasks, materials, students, audit });
  } catch (error) {
    return errorResponse(error);
  }
}
