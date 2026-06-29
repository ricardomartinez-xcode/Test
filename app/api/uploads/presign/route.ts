import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMaterialR2Key, MATERIALS_R2_ROOT } from "@/lib/server/r2-paths";
import { createUploadUrl, hasR2Config } from "@/lib/server/r2";
import { errorResponse, requirePermission } from "@/lib/server/authz";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sectionPath: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    await requirePermission(request, "r2:manage");

    if (!hasR2Config()) {
      return NextResponse.json(
        { error: "R2 no está configurado. Agrega variables CLOUDFLARE_R2_* para habilitar uploads." },
        { status: 501 },
      );
    }

    const payload = uploadSchema.parse(await request.json());
    const key = buildMaterialR2Key({ fileName: payload.fileName, sectionPath: payload.sectionPath });
    const result = await createUploadUrl({ key, contentType: payload.contentType });
    return NextResponse.json({ ...result, root: MATERIALS_R2_ROOT });
  } catch (error) {
    return errorResponse(error);
  }
}
