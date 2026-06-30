import { NextResponse } from "next/server";
import { createNativePublicR2Url, getNativeR2Object, resolveNativeR2ObjectKey } from "@/lib/server/r2-native";
import { d1First, d1Run } from "@/lib/server/d1-data";

const isDebug = process.env.R2_DEBUG === "1";

type RouteContext = { params: Promise<{ id: string }> };

type MaterialFileRow = {
  id: string;
  title: string;
  provider: string | null;
  r2_key: string | null;
  file_name: string | null;
  content_type: string | null;
};

function wantsHtmlFallback(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const destination = request.headers.get("sec-fetch-dest") ?? "";
  return destination === "iframe" || destination === "document" || accept.includes("text/html");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unavailableFileResponse(request: Request, message: string, status = 404) {
  if (!wantsHtmlFallback(request)) return NextResponse.json({ error: message }, { status });

  const safeMessage = escapeHtml(message);

  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:18px;box-sizing:border-box}.box{max-width:420px;border:1px solid #d8e0ea;background:#fff;border-radius:12px;padding:16px;box-shadow:0 14px 30px rgba(15,23,42,.08)}strong{display:block;margin-bottom:6px}p{margin:0;color:#64748b;font-size:14px;line-height:1.45}</style></head><body><div class="box"><strong>Preview no disponible</strong><p>${safeMessage}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode") === "download" ? "download" : "preview";

  const data = await d1First<MaterialFileRow>(
    "SELECT id, title, provider, r2_key, file_name, content_type FROM materials WHERE id = ? LIMIT 1",
    [id],
  );
  if (!data) return unavailableFileResponse(request, "Material no encontrado.", 404);
  if (!data.r2_key) return unavailableFileResponse(request, "Este material no tiene asset R2 asociado.", 404);

  let resolvedKey = data.r2_key;

  try {
    resolvedKey = await resolveNativeR2ObjectKey({ key: data.r2_key, fileName: data.file_name, title: data.title });
    const publicUrl = await createNativePublicR2Url(resolvedKey);

    if (resolvedKey !== data.r2_key) {
      await d1Run(
        "UPDATE materials SET r2_key = ?, source_url = ?, preview_url = ?, updated_at = ? WHERE id = ?",
        [resolvedKey, publicUrl, publicUrl, new Date().toISOString(), data.id],
      );
    }

    if (publicUrl) return NextResponse.redirect(publicUrl, { status: 302 });

    const object = await getNativeR2Object(resolvedKey);
    if (!object?.body) return unavailableFileResponse(request, "Objeto R2 no encontrado.", 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.etag);
    if (data.content_type && !headers.has("content-type")) headers.set("content-type", data.content_type);
    const fileName = encodeURIComponent(data.file_name || data.title || "material");
    headers.set("content-disposition", `${mode === "download" ? "attachment" : "inline"}; filename*=UTF-8''${fileName}`);
    return new Response(object.body, { headers });
  } catch (readError) {
    if (isDebug) {
      return NextResponse.json(
        {
          error: readError instanceof Error ? readError.message : "No se pudo resolver el objeto R2.",
          materialId: data.id,
          r2Key: data.r2_key,
          fileName: data.file_name,
          title: data.title,
        },
        { status: 404 },
      );
    }
    return unavailableFileResponse(
      request,
      readError instanceof Error ? readError.message : "No se pudo leer el documento R2.",
      404,
    );
  }
}
