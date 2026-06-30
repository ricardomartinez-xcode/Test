import { createRemoteJWKSet, jwtVerify } from "jose";
import { getCloudflareEnv, getD1 } from "@/lib/server/cloudflare";

export type Permission =
  | "tasks:edit"
  | "tasks:delete"
  | "materials:manage"
  | "users:manage"
  | "settings:manage"
  | "group:manage"
  | "notifications:manage"
  | "reports:view"
  | "r2:manage";

export type ServerProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "admin" | "owner";
  active: number;
  auth_user_id: string | null;
  can_edit_tasks: number;
  can_delete_tasks: number;
  can_manage_materials: number;
  can_manage_users: number;
  can_manage_settings: number;
  can_manage_group: number;
  can_manage_notifications: number;
  can_view_reports: number;
  can_manage_r2: number;
};

type AccessIdentity = { email: string; subject: string };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function enabled(value: number | boolean | null | undefined) {
  return value === 1 || value === true;
}

export async function getCurrentIdentity(request: Request): Promise<AccessIdentity> {
  const env = await getCloudflareEnv();

  if (env.AUTH_MODE === "development") {
    if (process.env.NODE_ENV === "production" && env.ALLOW_DEV_AUTH !== "1") {
      throw new HttpError(500, "AUTH_MODE development no está permitido en producción.");
    }
    const email = env.DEV_AUTH_EMAIL?.trim().toLowerCase();
    if (!email) throw new HttpError(401, "DEV_AUTH_EMAIL no configurado.");
    return { email, subject: `development:${email}` };
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const audience = env.ACCESS_AUD?.trim();
  if (!token) throw new HttpError(401, "Sesión de Cloudflare Access no encontrada.");
  if (!teamDomain || !audience) throw new HttpError(500, "Cloudflare Access no está configurado.");

  const issuer = `https://${teamDomain}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!email || !subject) throw new HttpError(401, "Token de Access incompleto.");
  return { email, subject };
}

export async function requireProfile(request: Request): Promise<ServerProfile> {
  const identity = await getCurrentIdentity(request);
  const db = await getD1();
  const profile = await db
    .prepare(`SELECT id, email, full_name, role, active, auth_user_id,
      can_edit_tasks, can_delete_tasks, can_manage_materials, can_manage_users,
      can_manage_settings, can_manage_group, can_manage_notifications,
      can_view_reports, can_manage_r2
      FROM app_profiles
      WHERE lower(email) = lower(?) OR auth_user_id = ?
      LIMIT 1`)
    .bind(identity.email, identity.subject)
    .first<ServerProfile>();

  if (!profile) throw new HttpError(403, "Perfil no encontrado o no autorizado.");
  if (!enabled(profile.active)) throw new HttpError(403, "Perfil inactivo.");
  return profile;
}

export async function requirePermission(request: Request, permission: Permission) {
  const profile = await requireProfile(request);
  if (profile.role === "owner") return profile;
  if (profile.role !== "admin") throw new HttpError(403, "No autorizado.");

  const grants: Record<Permission, keyof ServerProfile> = {
    "tasks:edit": "can_edit_tasks",
    "tasks:delete": "can_delete_tasks",
    "materials:manage": "can_manage_materials",
    "users:manage": "can_manage_users",
    "settings:manage": "can_manage_settings",
    "group:manage": "can_manage_group",
    "notifications:manage": "can_manage_notifications",
    "reports:view": "can_view_reports",
    "r2:manage": "can_manage_r2",
  };

  if (!enabled(profile[grants[permission]] as number)) throw new HttpError(403, "No autorizado.");
  return profile;
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "Error inesperado." },
    { status: 500 },
  );
}
