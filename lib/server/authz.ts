import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ServerProfile = {
  id: string;
  email: string;
  role: "student" | "admin" | "owner";
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireProfile(supabase: SupabaseServer): Promise<ServerProfile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email) throw new HttpError(401, "Sesión no válida.");

  const byAuth = await supabase
    .from("app_profiles")
    .select("id,email,role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth.error) throw new HttpError(500, byAuth.error.message);
  if (byAuth.data) return byAuth.data as ServerProfile;

  const byEmail = await supabase
    .from("app_profiles")
    .select("id,email,role")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (byEmail.error) throw new HttpError(500, byEmail.error.message);
  if (!byEmail.data) throw new HttpError(403, "Perfil no encontrado.");

  return byEmail.data as ServerProfile;
}

export async function requirePermission(supabase: SupabaseServer, permission: string) {
  const { data, error } = await supabase.rpc("has_admin_permission", { permission_name: permission });
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(403, "No autorizado.");
}

export function errorResponse(error: unknown) {
  if (error instanceof Error && error.message.includes("Missing Supabase env vars")) {
    return Response.json({ error: "Supabase no configurado." }, { status: 401 });
  }

  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: error instanceof Error ? error.message : "Error inesperado." }, { status: 500 });
}
