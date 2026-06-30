import { NextResponse } from "next/server";
import { errorResponse, requirePermission } from "@/lib/server/authz";

export async function POST(request: Request) {
  try {
    await requirePermission(request, "r2:manage");
    return NextResponse.json(
      { error: "Las subidas usan /api/uploads/direct con el binding MATERIALS_BUCKET." },
      { status: 410 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
