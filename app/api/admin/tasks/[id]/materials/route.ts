import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const materialLinkSchema = z.object({
  materialId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function taskIdFrom(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function GET(_request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("task_materials")
    .select("materials(id,title,material_type,provider,source_url,preview_url,thumbnail_url,r2_key,file_name,content_type,size_bytes)")
    .eq("task_id", taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, materials: data ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();
  const { materialId } = materialLinkSchema.parse(await request.json());

  const { error } = await supabase
    .from("task_materials")
    .upsert({ task_id: taskId, material_id: materialId }, { onConflict: "task_id,material_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    action: "task.material.link",
    entity: "task_materials",
    entity_id: `${taskId}:${materialId}`,
    after_data: { task_id: taskId, material_id: materialId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();
  const { materialId } = materialLinkSchema.parse(await request.json());

  const { error } = await supabase
    .from("task_materials")
    .delete()
    .eq("task_id", taskId)
    .eq("material_id", materialId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    action: "task.material.unlink",
    entity: "task_materials",
    entity_id: `${taskId}:${materialId}`,
    before_data: { task_id: taskId, material_id: materialId },
  });

  return NextResponse.json({ ok: true });
}
