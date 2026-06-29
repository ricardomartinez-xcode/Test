import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireProfile } from "@/lib/server/authz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["read", "dismiss"]),
});

const emailPreferenceSchema = z.object({
  emailEnabled: z.boolean(),
});

const preferenceSelect = "profile_id,in_app_enabled,email_enabled,due_soon_hours,categories";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(request);
    const now = new Date().toISOString();

    const [notifications, preferences] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,kind,priority,title,body,entity,entity_id,action_url,scheduled_for,read_at,dismissed_at,created_at")
        .or(`profile_id.eq.${profile.id},profile_id.is.null`)
        .is("dismissed_at", null)
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: false })
        .limit(80),
      supabase
        .from("notification_preferences")
        .select(preferenceSelect)
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

    if (notifications.error) throw new Error(notifications.error.message);
    if (preferences.error) throw new Error(preferences.error.message);

    return NextResponse.json({
      ok: true,
      profileId: profile.id,
      notifications: notifications.data ?? [],
      unread: (notifications.data ?? []).filter((notification) => !notification.read_at).length,
      preferences: preferences.data ?? null,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await requireProfile(request);
    const body = patchSchema.parse(await request.json());
    const patch = body.action === "read"
      ? { read_at: new Date().toISOString() }
      : { dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() };

    const { error } = await supabase
      .from("notifications")
      .update(patch)
      .in("id", body.ids);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(request);
    const body = emailPreferenceSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          profile_id: profile.id,
          email_enabled: body.emailEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      )
      .select(preferenceSelect)
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, preferences: data });
  } catch (error) {
    return errorResponse(error);
  }
}
