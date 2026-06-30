import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { executeDataQuery } from "@/lib/server/d1-data";

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  course_id: z.string().nullable(),
  task_type_id: z.string().nullable(),
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
    const profile = await requirePermission(request, "tasks:edit");
    const input = taskCreateSchema.parse(await request.json());
    const result = await executeDataQuery(request, {
      table: "tasks",
      action: "insert",
      values: {
        ...input,
        created_by: profile.id,
        updated_by: profile.id,
      },
      single: true,
    });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ ok: true, task: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
