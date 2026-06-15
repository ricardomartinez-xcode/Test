import { NextResponse } from "next/server";
import { z } from "zod";
import { createUploadUrl, hasR2Config } from "@/lib/server/r2";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  if (!hasR2Config()) {
    return NextResponse.json(
      { error: "R2 no está configurado. Agrega variables CLOUDFLARE_R2_* para habilitar uploads." },
      { status: 501 },
    );
  }

  const payload = uploadSchema.parse(await request.json());
  const key = `materials/${new Date().getFullYear()}/${crypto.randomUUID()}-${safeFileName(payload.fileName)}`;
  const result = await createUploadUrl({ key, contentType: payload.contentType });
  return NextResponse.json(result);
}
