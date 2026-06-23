import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/server/authz";
import { storeMicrosoftCalendarConnection, syncProfileCalendar } from "@/lib/server/calendar-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  let calendarStatus: "connected" | "error" | null = null;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      try {
        const profile = await requireProfile(supabase);
        if (profile.role === "student") {
          const stored = await storeMicrosoftCalendarConnection(profile.id, data.session);
          if (stored) {
            const summary = await syncProfileCalendar(profile.id);
            calendarStatus = summary.failed ? "error" : "connected";
          }
        }
      } catch {
        calendarStatus = "error";
      }
    }
  }

  const redirect = new URL(next, requestUrl.origin);
  if (calendarStatus) redirect.searchParams.set("calendar", calendarStatus);
  return NextResponse.redirect(redirect);
}
