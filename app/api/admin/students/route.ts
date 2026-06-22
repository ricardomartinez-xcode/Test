import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const studentInputSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido.").max(320),
  fullName: z.string().trim().min(2, "Ingresa el nombre completo.").max(120),
  controlNumber: z.string().trim().max(48).optional().or(z.literal("")),
});

type ManagerProfile = {
  id: string;
  email: string;
  role: "student" | "admin" | "owner";
  active: boolean;
  can_manage_users: boolean;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function requireStudentManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("Tu sesión expiró. Inicia sesión nuevamente.", 401) } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("app_profiles")
    .select("id,email,role,active,can_manage_users")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email?.toLowerCase() ?? ""}`)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: jsonError("No se encontró un perfil activo para tu usuario.", 403) } as const;
  }

  const manager = profile as ManagerProfile;
  const allowed = manager.active && (manager.role === "owner" || manager.can_manage_users);
  if (!allowed) {
    return { error: jsonError("No tienes permiso para administrar alumnos.", 403) } as const;
  }

  return { manager, user } as const;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY para invitar alumnos.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function appOrigin(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return configuredOrigin || new URL(request.url).origin;
}

export async function GET() {
  try {
    const context = await requireStudentManager();
    if ("error" in context) return context.error;

    const service = createServiceClient();
    const { data, error } = await service
      .from("app_profiles")
      .select("id,email,full_name,control_number,role,active,created_at")
      .eq("role", "student")
      .order("active", { ascending: false })
      .order("full_name", { ascending: true })
      .limit(250);

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ students: data ?? [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar el directorio de alumnos.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireStudentManager();
    if ("error" in context) return context.error;

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
    const service = createServiceClient();

    const { data: existingProfile, error: existingError } = await service
      .from("app_profiles")
      .select("id,auth_user_id")
      .eq("email", input.email)
      .maybeSingle();

    if (existingError) return jsonError(existingError.message, 500);
    if (existingProfile?.auth_user_id) {
      return jsonError("Ese correo ya pertenece a un alumno con acceso. Usa el panel de usuarios para editarlo.", 409);
    }

    const invitationRedirect = `${appOrigin(request)}/auth/callback`;
    const { data: invitation, error: invitationError } = await service.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: invitationRedirect,
      data: {
        full_name: input.fullName,
        control_number: input.controlNumber,
      },
    });

    if (invitationError || !invitation.user) {
      return jsonError(invitationError?.message ?? "Supabase no pudo crear la invitación.", 400);
    }

    const { data: student, error: profileError } = await service
      .from("app_profiles")
      .upsert(
        {
          auth_user_id: invitation.user.id,
          email: input.email,
          full_name: input.fullName,
          control_number: input.controlNumber,
          role: "student",
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("id,email,full_name,control_number,role,active,created_at")
      .single();

    if (profileError) {
      return jsonError(`Se envió la invitación, pero no se pudo guardar el perfil: ${profileError.message}`, 500);
    }

    return NextResponse.json(
      {
        student,
        message: "Invitación enviada. El alumno recibirá el correo para activar su acceso.",
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo invitar al alumno.", 500);
  }
}
