import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, requirePermission, requireProfile } from "@/lib/server/authz";

const materialLinkSchema = z.object({
  materialId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    await requireProfile(supabase);
    await requirePermission(supabase, "tasks:edit");

    const { data, error } = await supabase
      .from("task_materials")
      .select("materials(id,title,material_type,provider,source_url,preview_url,thumbnail_url,r2_key,file_name,content_type,size_bytes)")
      .eq("task_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, materials: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    await requireProfile(supabase);
    await requirePermission(supabase, "tasks:edit");
    const { materialId } = materialLinkSchema.parse(await request.json());

    const { error } = await supabase
      .from("task_materials")
      .upsert({ task_id: id, material_id: materialId }, { onConflict: "task_id,material_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_log").insert({
      action: "task.material.link",
      entity: "task_materials",
      entity_id: `${id}:${materialId}`,
      after_data: { task_id: id, material_id: materialId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    await requireProfile(supabase);
    await requirePermission(supabase, "tasks:edit");
    const { materialId } = materialLinkSchema.parse(await request.json());

    const { error } = await supabase
      .from("task_materials")
      .delete()
      .eq("task_id", id)
      .eq("material_id", materialId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_log").insert({
      action: "task.material.unlink",
      entity: "task_materials",
      entity_id: `${id}:${materialId}`,
      before_data: { task_id: id, material_id: materialId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
