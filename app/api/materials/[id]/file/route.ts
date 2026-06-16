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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Material no encontrado." }, { status: 404 });
  if (!data.r2_key) return NextResponse.json({ error: "Este material no tiene asset R2 asociado." }, { status: 404 });

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

      return NextResponse.json(
        { error: resolveError instanceof Error ? resolveError.message : "No se pudo resolver el objeto R2." },
        { status: 404 },
      );
    }
  }

  const publicUrl = createPublicR2Url(resolvedKey);

  if (publicUrl) return NextResponse.redirect(publicUrl, { status: 302 });

  if (!hasR2Config()) {
    return NextResponse.json({ error: "R2 no está configurado para lectura y no hay dominio público configurado." }, { status: 501 });
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
    return NextResponse.json(
      { error: signError instanceof Error ? signError.message : "No se pudo firmar el documento R2." },
      { status: 500 },
    );
  }
}
