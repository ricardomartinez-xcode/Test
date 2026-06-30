import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { d1All, d1First, d1Run } from "@/lib/server/d1-data";

const studentInputSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido.").max(320),
  fullName: z.string().trim().min(2, "Ingresa el nombre completo.").max(120),
  controlNumber: z.string().trim().max(48).optional().or(z.literal("")),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "users:manage");
    const students = await d1All<Record<string, unknown>>(
      `SELECT id, email, full_name, control_number, role, active, created_at
       FROM app_profiles
       WHERE role = 'student'
       ORDER BY active DESC, full_name ASC
       LIMIT 250`,
    );
    return NextResponse.json({ students });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "users:manage");
    const body = await request.json().catch(() => null);
    const parsed = studentInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Revisa los datos del alumno.", 400);
    }

    const input = {
      email: parsed.data.email.toLowerCase(),
      fullName: parsed.data.fullName,
      controlNumber: parsed.data.controlNumber?.trim() || null,
    };

    const existing = await d1First<{ id: string }>("SELECT id FROM app_profiles WHERE lower(email) = lower(?) LIMIT 1", [input.email]);
    const id = existing?.id ?? crypto.randomUUID();
    await d1Run(
      `INSERT INTO app_profiles (id, email, full_name, control_number, role, active, updated_at)
       VALUES (?, ?, ?, ?, 'student', 1, ?)
       ON CONFLICT (email) DO UPDATE SET
        full_name = excluded.full_name,
        control_number = excluded.control_number,
        role = 'student',
        active = 1,
        updated_at = excluded.updated_at`,
      [id, input.email, input.fullName, input.controlNumber, new Date().toISOString()],
    );
    const student = await d1First<Record<string, unknown>>(
      "SELECT id, email, full_name, control_number, role, active, created_at FROM app_profiles WHERE id = ? LIMIT 1",
      [id],
    );
    return NextResponse.json(
      {
        student,
        message: "Alumno guardado. El acceso se gestiona en Cloudflare Access/Microsoft Entra.",
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
