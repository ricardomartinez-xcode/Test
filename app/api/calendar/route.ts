import { NextResponse } from "next/server";
import {
  disconnectMicrosoftCalendar,
  getMicrosoftCalendarStatus,
  syncProfileCalendar,
} from "@/lib/server/calendar-sync";
import { errorResponse, requireProfile } from "@/lib/server/authz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(supabase);
    const status = await getMicrosoftCalendarStatus(profile.id);
    return NextResponse.json({ ok: true, status }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(supabase);
    if (profile.role !== "student") {
      return NextResponse.json({ error: "La sincronización personal está disponible para alumnos." }, { status: 403 });
    }
    const summary = await syncProfileCalendar(profile.id);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await requireProfile(supabase);
    await disconnectMicrosoftCalendar(profile.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

