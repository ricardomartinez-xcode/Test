import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission, requireProfile } from "@/lib/server/authz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  course_id: z.string().uuid().nullable(),
  task_type_id: z.string().uuid().nullable(),
  due_date: z.string().min(1),
  due_time: z.string().min(1),
  status: z.string().min(1),
  priority: z.string().min(1),
  visible_to_students: z.boolean(),
  material_needed: z.string().nullable(),
  material_url: z.string().nullable(),
  platform_url: z.string().nullable(),
  notes: z.string().nullable(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(supabase);
    await requirePermission(supabase, "tasks:edit");
    const input = taskCreateSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        ...input,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, task: data });
  } catch (error) {
    return errorResponse(error);
  }
}
