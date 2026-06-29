import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requirePermission } from "@/lib/server/authz";
import { deliverAnnouncementEmails, type AnnouncementNotification } from "@/lib/server/notification-email";
import { groupAdminNotifications, type AdminNotificationRow } from "@/lib/server/notification-groups";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const notificationSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().default(""),
  kind: z.enum(["system", "reminder", "material_added", "task_updated"]).default("system"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  audience: z.enum(["all", "students", "admins"]).default("all"),
});

type ProfileTarget = {
  id: string;
  role: "student" | "admin" | "owner";
};

export async function GET(request: Request) {
  try {
    await requirePermission(request, "notifications:manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id,profile_id,kind,priority,title,body,entity,entity_id,read_at,dismissed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return NextResponse.json(
      { ok: true, notifications: groupAdminNotifications((data ?? []) as AdminNotificationRow[]) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requirePermission(request, "notifications:manage");
    const supabase = await createSupabaseServerClient();
    const body = notificationSchema.parse(await request.json());

    let targetsQuery = supabase
      .from("app_profiles")
      .select("id,role")
      .eq("active", true);

    if (body.audience === "students") targetsQuery = targetsQuery.eq("role", "student");
    if (body.audience === "admins") targetsQuery = targetsQuery.in("role", ["admin", "owner"]);

    const targets = await targetsQuery;
    if (targets.error) throw new Error(targets.error.message);

    const rows = ((targets.data ?? []) as ProfileTarget[]).map((target) => ({
      profile_id: target.id,
      kind: body.kind,
      priority: body.priority,
      title: body.title,
      body: body.body,
      entity: "broadcast",
      entity_id: body.audience,
      created_by: profile.id,
    }));

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        email: { configured: false, considered: 0, delivered: 0, skipped: 0, failed: 0, errors: [] },
      });
    }

    const { data: insertedRows, error } = await supabase
      .from("notifications")
      .insert(rows)
      .select("id,profile_id,kind,priority,title,body,action_url");
    if (error) throw new Error(error.message);

    const email = await deliverAnnouncementEmails((insertedRows ?? []) as AnnouncementNotification[]);
    return NextResponse.json({ ok: true, inserted: rows.length, email });
  } catch (error) {
    return errorResponse(error);
  }
}
