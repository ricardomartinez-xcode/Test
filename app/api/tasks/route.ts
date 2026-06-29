import { NextResponse } from "next/server";
import { z } from "zod";
import { seedTasks } from "@/lib/seed";
import { getSql } from "@/lib/server/db";
import type { TaskStatus } from "@/lib/domain";
import { calculateDaysRemaining, deriveReaderVisibility, deriveStatus } from "@/lib/task-utils";

type TaskRow = {
  id: string;
  course: string;
  due_date: string | Date;
  due_time: string | Date;
  title: string;
  material_needed: string | null;
  material_url: string | null;
  delivery_type: string;
  status: TaskStatus;
  notes: string | null;
  platform_url: string | null;
  calendar_event_id: string | null;
  last_sync_at: string | Date | null;
};

const taskSchema = z.object({
  course: z.string().min(1),
  dueDate: z.string().min(10),
  dueTime: z.string().default("23:59"),
  title: z.string().min(1),
  materialNeeded: z.string().optional(),
  materialUrl: z.string().url().optional().or(z.literal("")),
  deliveryType: z.string().min(1),
  status: z.string().min(1).default("Pendiente"),
  notes: z.string().optional(),
  platformUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ source: "demo", tasks: seedTasks });
  }

  const rows = await sql<TaskRow>`
    select
      id,
      course,
      due_date,
      due_time,
      title,
      material_needed,
      material_url,
      delivery_type,
      status,
      notes,
      platform_url,
      calendar_event_id,
      last_sync_at
    from tasks
    where archived_at is null
    order by due_date asc, due_time asc
  `;

  return NextResponse.json({
    source: "postgres",
    tasks: rows.map((row) => {
      const dueDate = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : String(row.due_date);
      const daysRemaining = calculateDaysRemaining(dueDate);
      const status = deriveStatus(row.status, daysRemaining);
      return {
        id: row.id,
        course: row.course,
        dueDate,
        dueTime: String(row.due_time).slice(0, 5),
        title: row.title,
        materialNeeded: row.material_needed ?? "",
        materialUrl: row.material_url ?? "",
        deliveryType: row.delivery_type,
        status,
        daysRemaining,
        notes: row.notes ?? "",
        platformUrl: row.platform_url ?? "",
        calendarEventId: row.calendar_event_id ?? "",
        lastSync: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : "",
        visibleToReaders: deriveReaderVisibility({ status }),
      };
    }),
  });
}

export async function POST(request: Request) {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "DATABASE_URL no está configurado. En modo demo la UI usa localStorage." },
      { status: 501 },
    );
  }

  const payload = taskSchema.parse(await request.json());
  const [task] = await sql`
    insert into tasks (
      course, due_date, due_time, title, material_needed, material_url,
      delivery_type, status, notes, platform_url
    ) values (
      ${payload.course}, ${payload.dueDate}, ${payload.dueTime}, ${payload.title},
      ${payload.materialNeeded ?? null}, ${payload.materialUrl || null},
      ${payload.deliveryType}, ${payload.status}, ${payload.notes ?? null}, ${payload.platformUrl || null}
    )
    returning id
  `;

  return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
}
