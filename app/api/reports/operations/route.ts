import { NextResponse } from "next/server";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "reports:view");
    const supabase = await createSupabaseServerClient();

    const [tasks, materials, students, audit] = await Promise.all([
      supabase.from("report_task_summary").select("*").order("course").order("delivery_type"),
      supabase.from("report_material_summary").select("*").order("section_path"),
      supabase.from("report_student_followup").select("*").order("active_flags", { ascending: false }).limit(80),
      supabase.from("audit_log").select("id,actor_id,action,entity,entity_id,created_at").order("created_at", { ascending: false }).limit(40),
    ]);

    const failure = tasks.error || materials.error || students.error || audit.error;
    if (failure) throw new Error(failure.message);

    return NextResponse.json({
      ok: true,
      tasks: tasks.data ?? [],
      materials: materials.data ?? [],
      students: students.data ?? [],
      audit: audit.data ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
