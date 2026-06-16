import { NextResponse } from "next/server";
import { createPublicR2Url } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SectionRow = {
  id: string;
  name: string;
  path: string;
  color: string | null;
  icon: string | null;
  card_size: string | null;
  preview_style: string | null;
  sort_order: number | null;
};

type MaterialRow = {
  id: string;
  title: string;
  material_type: string | null;
  provider: string | null;
  source_url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  r2_key: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  section_id: string | null;
  material_sections: SectionRow | SectionRow[] | null;
};

function firstSection(value: MaterialRow["material_sections"]): SectionRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function withR2Urls(row: MaterialRow) {
  const publicR2Url = createPublicR2Url(row.r2_key);
  const signedPreviewUrl = row.r2_key ? `/api/materials/${row.id}/file?mode=preview` : null;
  const signedDownloadUrl = row.r2_key ? `/api/materials/${row.id}/file?mode=download` : null;

  return {
    ...row,
    provider: row.r2_key ? "r2" : row.provider,
    public_url: publicR2Url ?? signedDownloadUrl,
    preview_url: publicR2Url ?? signedPreviewUrl,
    source_url: publicR2Url ?? signedDownloadUrl,
    thumbnail_url: null,
    section: firstSection(row.material_sections),
    material_sections: undefined,
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const query = requestUrl.searchParams.get("q")?.trim();
    const sectionId = requestUrl.searchParams.get("sectionId")?.trim();
    const limit = Math.min(Number(requestUrl.searchParams.get("limit") ?? 300), 500);

    const supabase = await createSupabaseServerClient();

    const sectionsResult = await supabase
      .from("material_sections")
      .select("id,name,path,color,icon,card_size,preview_style,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    let materialsQuery = supabase
      .from("materials")
      .select(
        "id,title,material_type,provider,source_url,preview_url,thumbnail_url,r2_key,file_name,content_type,size_bytes,section_id,material_sections(id,name,path,color,icon,card_size,preview_style,sort_order)",
      )
      .eq("visibility", "visible")
      .not("r2_key", "is", null)
      .order("title", { ascending: true })
      .limit(limit);

    if (sectionId) {
      materialsQuery = materialsQuery.eq("section_id", sectionId);
    }

    if (query) {
      const safeQuery = query.replace(/[%_]/g, "\\$&");
      materialsQuery = materialsQuery.or(
        `title.ilike.%${safeQuery}%,file_name.ilike.%${safeQuery}%,observations.ilike.%${safeQuery}%`,
      );
    }

    const materialsResult = await materialsQuery;

    if (sectionsResult.error) {
      return NextResponse.json({ error: sectionsResult.error.message }, { status: 500 });
    }

    if (materialsResult.error) {
      return NextResponse.json({ error: materialsResult.error.message }, { status: 500 });
    }

    const sections = (sectionsResult.data ?? []) as SectionRow[];
    const materials = ((materialsResult.data ?? []) as MaterialRow[]).map(withR2Urls);

    const countsBySection = materials.reduce<Record<string, number>>((obj, material) => {
      if (!material.section_id) return obj;
      obj[material.section_id] = (obj[material.section_id] ?? 0) + 1;
      return obj;
    }, {});

    return NextResponse.json({
      ok: true,
      query: query ?? "",
      sectionId: sectionId ?? "",
      summary: {
        sections: sections.length,
        materials: materials.length,
        providers: materials.reduce<Record<string, number>>((acc, material) => {
          const provider = material.provider ?? "r2";
          acc[provider] = (acc[provider] ?? 0) + 1;
          return acc;
        }, {}),
      },
      sections: sections.map((section) => ({
        ...section,
        material_count: countsBySection[section.id] ?? 0,
      })),
      materials,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la biblioteca." },
      { status: 500 },
    );
  }
}
