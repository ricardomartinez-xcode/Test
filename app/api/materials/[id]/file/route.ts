import { NextResponse } from "next/server";
import { createPublicR2Url, createR2ReadUrl, hasR2Config, resolveR2ObjectKey } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("materials")
    .select("id,title,provider,r2_key,file_name,content_type")
    .eq("id", id)
    .maybeSingle<MaterialFileRow>();

  if (error) return unavailableFileResponse(request, error.message, 500);
  if (!data) return unavailableFileResponse(request, "Material no encontrado.", 404);
  if (!data.r2_key) return unavailableFileResponse(request, "Este material no tiene asset R2 asociado.", 404);

  let resolvedKey = data.r2_key;

  if (hasR2Config()) {
    try {
      resolvedKey = await resolveR2ObjectKey({ key: data.r2_key, fileName: data.file_name, title: data.title });

      if (resolvedKey !== data.r2_key) {
        await supabase
          .from("materials")
          .update({
            r2_key: resolvedKey,
            source_url: createPublicR2Url(resolvedKey),
            preview_url: createPublicR2Url(resolvedKey),
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      }
    } catch (resolveError) {
      if (isDebug) {
        return NextResponse.json(
          {
            error: resolveError instanceof Error ? resolveError.message : "No se pudo resolver el objeto R2.",
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
        resolveError instanceof Error ? resolveError.message : "No se pudo resolver el objeto R2.",
        404,
      );
    }
  }

  const publicUrl = createPublicR2Url(resolvedKey);

  if (publicUrl) return NextResponse.redirect(publicUrl, { status: 302 });

  if (!hasR2Config()) {
    return unavailableFileResponse(request, "R2 no está configurado para lectura y no hay dominio público configurado.", 501);
  }

  try {
    const signedUrl = await createR2ReadUrl({
      key: resolvedKey,
      fileName: data.file_name || data.title,
      contentType: data.content_type,
      disposition: mode === "download" ? "attachment" : "inline",
    });

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (signError) {
    return unavailableFileResponse(
      request,
      signError instanceof Error ? signError.message : "No se pudo firmar el documento R2.",
      500,
    );
  }
}
