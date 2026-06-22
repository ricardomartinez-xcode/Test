import { NextResponse } from "next/server";
import { MATERIALS_R2_ROOT, normalizeMaterialR2Key } from "@/lib/server/r2-paths";
import { hasR2Config, listR2FolderPrefixes } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SectionRow = {
  id: string;
  name: string;
  path: string;
  sort_order: number | null;
};

type UploadDestination = {
  id: string;
  sectionId: string | null;
  name: string;
  path: string;
  source: "r2";
};

function labelFromPath(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function destinationKey(path: string) {
  return normalizeMaterialR2Key(path).toLowerCase();
}

export async function GET() {
  const sectionsByPath = new Map<string, SectionRow>();

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("material_sections")
      .select("id,name,path,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    for (const section of (data ?? []) as SectionRow[]) {
      const key = destinationKey(section.path);
      if (key) sectionsByPath.set(key, section);
    }
  } catch {
    // Demo/local mode can run without Supabase env vars; bucket folders still drive destinations.
  }

  const destinations = new Map<string, UploadDestination>();

  if (hasR2Config()) {
    try {
      const folders = await listR2FolderPrefixes({ root: MATERIALS_R2_ROOT });
      for (const folder of folders) {
        const path = normalizeMaterialR2Key(folder);
        if (!path) continue;
        const key = destinationKey(path);
        const section = sectionsByPath.get(key);
        destinations.set(key, {
          id: `r2:${path}`,
          sectionId: section?.id ?? null,
          name: section?.name ?? labelFromPath(path),
          path,
          source: "r2",
        });
      }
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "No se pudieron leer destinos R2." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    root: MATERIALS_R2_ROOT,
    destinations: Array.from(destinations.values()).sort((a, b) => a.path.localeCompare(b.path, "es")),
  });
}
