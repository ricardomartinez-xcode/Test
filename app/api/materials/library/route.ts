import { NextResponse } from "next/server";
import { selectBucketMaterialSections } from "@/lib/server/material-sections";
import { createNativePublicR2Url, listNativeR2FolderPrefixes } from "@/lib/server/r2-native";
import { MATERIALS_R2_ROOT, materialSectionPathFromR2Key, normalizeMaterialR2Key } from "@/lib/server/r2-paths";
import { d1All } from "@/lib/server/d1-data";

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

function sectionKey(value: string) {
  return normalizeMaterialR2Key(value).toLocaleLowerCase("es");
}

async function withR2Urls(row: MaterialRow, sectionsByPath: Map<string, SectionRow>) {
  const publicR2Url = await createNativePublicR2Url(row.r2_key);
  const signedPreviewUrl = row.r2_key ? `/api/materials/${row.id}/file?mode=preview` : null;
  const signedDownloadUrl = row.r2_key ? `/api/materials/${row.id}/file?mode=download` : null;
  const joinedSection = firstSection(row.material_sections);
  const sectionPath = materialSectionPathFromR2Key(row.r2_key) || joinedSection?.path || "";
  const section = sectionsByPath.get(sectionKey(sectionPath)) ?? null;

  return {
    ...row,
    provider: row.r2_key ? "r2" : row.provider,
    public_url: signedDownloadUrl ?? publicR2Url,
    preview_url: signedPreviewUrl ?? publicR2Url,
    source_url: signedDownloadUrl ?? publicR2Url,
    thumbnail_url: null,
    section_id: section?.id ?? null,
    section,
    material_sections: undefined,
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const query = requestUrl.searchParams.get("q")?.trim();
    const sectionId = requestUrl.searchParams.get("sectionId")?.trim();
    const limit = Math.min(Number(requestUrl.searchParams.get("limit") ?? 300), 500);

    const sectionsResult = await d1All<SectionRow>(
      "SELECT id, name, path, color, icon, card_size, preview_style, sort_order FROM material_sections WHERE active = 1 ORDER BY sort_order ASC",
    );
    let folderPaths: string[] = [];
    try {
      folderPaths = await listNativeR2FolderPrefixes(MATERIALS_R2_ROOT);
    } catch {
      folderPaths = [];
    }

    const where: string[] = ["m.visibility = 'visible'", "m.r2_key IS NOT NULL"];
    const values: unknown[] = [];
    if (sectionId) {
      where.push("m.section_id = ?");
      values.push(sectionId);
    }
    if (query) {
      const like = `%${query.replace(/[%_]/g, "\\$&")}%`;
      where.push("(m.title LIKE ? ESCAPE '\\' OR m.file_name LIKE ? ESCAPE '\\' OR m.observations LIKE ? ESCAPE '\\')");
      values.push(like, like, like);
    }
    values.push(limit);
    const materialsResult = await d1All<MaterialRow & {
      material_section_id: string | null;
      joined_section_id: string | null;
      section_name: string | null;
      section_path: string | null;
      section_color: string | null;
      section_icon: string | null;
      section_card_size: string | null;
      section_preview_style: string | null;
      section_sort_order: number | null;
    }>(
      `SELECT m.id, m.title, m.material_type, m.provider, m.source_url, m.preview_url, m.thumbnail_url,
        m.r2_key, m.file_name, m.content_type, m.size_bytes, m.section_id AS material_section_id,
        ms.id AS joined_section_id, ms.name AS section_name, ms.path AS section_path, ms.color AS section_color,
        ms.icon AS section_icon, ms.card_size AS section_card_size, ms.preview_style AS section_preview_style,
        ms.sort_order AS section_sort_order
       FROM materials m
       LEFT JOIN material_sections ms ON ms.id = m.section_id
       WHERE ${where.join(" AND ")}
       ORDER BY m.title ASC
       LIMIT ?`,
      values,
    );

    const sections = folderPaths.length ? selectBucketMaterialSections(folderPaths, sectionsResult) : sectionsResult;
    const sectionsByPath = new Map(sections.map((section) => [sectionKey(section.path), section]));
    const materials = await Promise.all(materialsResult
      .map((row) => withR2Urls({
        ...row,
        section_id: row.material_section_id,
        material_sections: row.joined_section_id ? {
          id: row.joined_section_id,
          name: row.section_name ?? "",
          path: row.section_path ?? "",
          color: row.section_color,
          icon: row.section_icon,
          card_size: row.section_card_size,
          preview_style: row.section_preview_style,
          sort_order: row.section_sort_order,
        } : null,
      }, sectionsByPath)));

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
    if (error instanceof Error && error.message.includes("Missing env var")) {
      return NextResponse.json({
        ok: true,
        query: "",
        sectionId: "",
        summary: { sections: 0, materials: 0, providers: {} },
        sections: [],
        materials: [],
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la biblioteca." },
      { status: 500 },
    );
  }
}
