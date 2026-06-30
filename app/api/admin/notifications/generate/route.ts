import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { d1All, d1Run } from "@/lib/server/d1-data";

const generateSchema = z.object({
  windowDays: z.number().int().min(1).max(14).default(3),
});

type DueTask = {
  id: string;
  title: string;
  due_date: string;
  due_time: string;
  course_name: string | null;
};

type Student = { id: string };

export async function POST(request: Request) {
  try {
    const profile = await requirePermission(request, "notifications:manage");
    const body = generateSchema.parse(await request.json().catch(() => ({})));
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + body.windowDays);
    const end = endDate.toISOString().slice(0, 10);

    const [tasks, students] = await Promise.all([
      d1All<DueTask>(
        `SELECT t.id, t.title, t.due_date, t.due_time, c.name AS course_name
         FROM tasks t
         LEFT JOIN courses c ON c.id = t.course_id
         WHERE t.archived_at IS NULL
           AND t.visible_to_students = 1
           AND t.status NOT IN ('Entregado', 'Cancelado')
           AND t.due_date BETWEEN ? AND ?
         ORDER BY t.due_date ASC, t.due_time ASC`,
        [start, end],
      ),
      d1All<Student>("SELECT id FROM app_profiles WHERE active = 1 AND role = 'student'"),
    ]);

    let inserted = 0;
    for (const task of tasks) {
      for (const student of students) {
        const existing = await d1All<{ id: string }>(
          "SELECT id FROM notifications WHERE profile_id = ? AND kind = 'reminder' AND entity = 'tasks' AND entity_id = ? LIMIT 1",
          [student.id, task.id],
        );
        if (existing.length) continue;
        await d1Run(
          `INSERT INTO notifications (id, profile_id, kind, priority, title, body, entity, entity_id, action_url, created_by)
           VALUES (?, ?, 'reminder', 'normal', ?, ?, 'tasks', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            student.id,
            `Recordatorio: ${task.title}`,
            `${task.course_name ?? "Materia"} · ${task.due_date} ${String(task.due_time).slice(0, 5)}`,
            task.id,
            `/tasks/${task.id}`,
            profile.id,
          ],
        );
        inserted += 1;
      }
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (error) {
    return errorResponse(error);
  }
}
