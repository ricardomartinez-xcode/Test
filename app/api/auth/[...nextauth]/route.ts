import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "NextAuth was replaced by Supabase Auth." }, { status: 410 });
}

export function POST() {
  return NextResponse.json({ error: "NextAuth was replaced by Supabase Auth." }, { status: 410 });
}
