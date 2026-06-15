import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const taskPatchSchema = z.object({
  title: z.string().min(1).optional(),
  course_id: z.string().uuid().nullable().optional(),
  task_type_id: z.string().uuid().nullable().optional(),
  due_date: z.string().min(1).optional(),
  due_time: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  priority: z.string().min(1).optional(),
  visible_to_students: z.boolean().optional(),
  material_needed: z.string().nullable().optional(),
  material_url: z.string().nullable().optional(),
  platform_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function taskIdFrom(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

function taskSelect() {
  return [
    "*",
    "courses(id,name,color,icon,card_size)",
    "task_types(id,name,color,icon,card_size)",
    "task_materials(materials(id,title,material_type,provider,source_url,preview_url,thumbnail_url,r2_key,file_name,content_type,size_bytes))",
  ].join(",");
}

export async function GET(_request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect())
    .eq("id", taskId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tarea no encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, task: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();
  const patch = taskPatchSchema.parse(await request.json());

  const before = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (before.error) return NextResponse.json({ error: before.error.message }, { status: 500 });
  if (!before.data) return NextResponse.json({ error: "Tarea no encontrada." }, { status: 404 });

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select(taskSelect())
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    action: "task.update",
    entity: "tasks",
    entity_id: taskId,
    before_data: before.data,
    after_data: data,
  });

  return NextResponse.json({ ok: true, task: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const taskId = await taskIdFrom(context);
  const supabase = await createSupabaseServerClient();

  const before = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (before.error) return NextResponse.json({ error: before.error.message }, { status: 500 });
  if (!before.data) return NextResponse.json({ error: "Tarea no encontrada." }, { status: 404 });

  const { data, error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("id,archived_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    action: "task.archive",
    entity: "tasks",
    entity_id: taskId,
    before_data: before.data,
    after_data: data,
  });

  return NextResponse.json({ ok: true, task: data });
}
