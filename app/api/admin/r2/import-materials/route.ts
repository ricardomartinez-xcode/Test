import { NextResponse } from "next/server";
import { createPublicR2Url, getR2BucketName, listR2Objects, type R2ListedObject } from "@/lib/server/r2";
import { MATERIALS_R2_ROOT, materialSectionPathFromR2Key } from "@/lib/server/r2-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, requirePermission } from "@/lib/server/authz";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type DbError = { message: string } | null;
type ImportRequest = { dryRun?: boolean; root?: string; maxItems?: number; reset?: boolean; resetScope?: "r2" | "all"; confirm?: string };
type SectionRow = { id: string; path: string };
type MaterialRow = { id: string; r2_key: string | null };
type ImportableObject = R2ListedObject & { fileName: string; sectionPath: string; title: string; contentType: string; materialType: string; publicUrl: string | null };

const RESET_CONFIRMATION = "REIMPORTAR_R2";
const SKIP_FILE_RE = /(^|\/)\.(DS_Store|keep)$|(^|\/)Thumbs\.db$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanPath(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

function basename(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "seccion";
}

function ext(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[a-z0-9]{2,8}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || fileName;
}

function inferContentType(fileName: string) {
  switch (ext(fileName)) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "doc": return "application/msword";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "ppt": return "application/vnd.ms-powerpoint";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xls": return "application/vnd.ms-excel";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "txt": return "text/plain";
    default: return "application/octet-stream";
  }
}

function inferMaterialType(fileName: string) {
  const extension = ext(fileName);
  if (extension === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "Imagen";
  if (["doc", "docx"].includes(extension)) return "Documento";
  if (["ppt", "pptx"].includes(extension)) return "Presentacion";
  if (["xls", "xlsx"].includes(extension)) return "Hoja de calculo";
  return "Archivo";
}

function isImportableObject(object: R2ListedObject) {
  const fileName = basename(object.key);
  return Boolean(fileName && fileName.includes(".") && !SKIP_FILE_RE.test(object.key));
}

function toImportable(object: R2ListedObject): ImportableObject {
  const fileName = basename(object.key);
  return {
    ...object,
    fileName,
    sectionPath: materialSectionPathFromR2Key(object.key) || MATERIALS_R2_ROOT,
    title: titleFromFileName(fileName),
    contentType: inferContentType(fileName),
    materialType: inferMaterialType(fileName),
    publicUrl: createPublicR2Url(object.key),
  };
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function loadSectionMap(supabase: SupabaseServerClient) {
  const result = await supabase.from("material_sections").select("id,path");
  const error = result.error as DbError;
  if (error) throw new Error(error.message);
  const rows = (result.data ?? []) as SectionRow[];
  return new Map(rows.map((row) => [cleanPath(row.path), row.id]));
}

async function ensureSectionPath(supabase: SupabaseServerClient, sectionMap: Map<string, string>, sectionPath: string) {
  const parts = cleanPath(sectionPath).split("/").filter(Boolean);
  let parentId: string | null = null;
  let currentPath = "";

  for (const [index, part] of parts.entries()) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existingId = sectionMap.get(currentPath);
    if (existingId) {
      parentId = existingId;
      continue;
    }

    const insertResult = await supabase
      .from("material_sections")
      .insert({
        parent_id: parentId,
        name: part,
        slug: slugify(index === 0 ? currentPath : part),
        path: currentPath,
        active: true,
        sort_order: sectionMap.size,
      })
      .select("id,path")
      .single();

    const error = insertResult.error as DbError;
    if (error) throw new Error(error.message);

    const row = insertResult.data as SectionRow | null;
    if (!row) throw new Error(`No se pudo crear la seccion ${currentPath}.`);

    sectionMap.set(cleanPath(row.path), row.id);
    parentId = row.id;
  }

  return parentId;
}

async function loadExistingMaterials(supabase: SupabaseServerClient, keys: string[]) {
  const map = new Map<string, string>();
  for (const keysChunk of chunk(keys, 500)) {
    const result = await supabase.from("materials").select("id,r2_key").in("r2_key", keysChunk);
    const error = result.error as DbError;
    if (error) throw new Error(error.message);
    for (const row of (result.data ?? []) as MaterialRow[]) if (row.r2_key) map.set(row.r2_key, row.id);
  }
  return map;
}

async function resetMaterials(supabase: SupabaseServerClient, scope: "r2" | "all") {
  const query = supabase.from("materials").select("id");
  const result = scope === "r2" ? await query.eq("provider", "r2") : await query;
  const error = result.error as DbError;
  if (error) throw new Error(error.message);

  const ids = ((result.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  for (const idsChunk of chunk(ids, 500)) {
    const linkDelete = await supabase.from("task_materials").delete().in("material_id", idsChunk);
    if (linkDelete.error) throw new Error(linkDelete.error.message);
    const materialDelete = await supabase.from("materials").delete().in("id", idsChunk);
    if (materialDelete.error) throw new Error(materialDelete.error.message);
  }
  return ids.length;
}

async function runImport(request: Request, fallbackBody: ImportRequest) {
  try {
    await requirePermission(request, "r2:manage");
    const supabase = await createSupabaseServerClient();

    const body = request.method === "POST" ? ((await request.json().catch(() => ({}))) as ImportRequest) : fallbackBody;
    const dryRun = body.dryRun ?? request.method !== "POST";
    const reset = Boolean(body.reset);
    const resetScope = body.resetScope ?? "r2";
    const root = cleanPath(body.root ?? MATERIALS_R2_ROOT);
    const maxItems = Math.max(1, Math.min(body.maxItems ?? 10000, 50000));

    if (reset && body.confirm !== RESET_CONFIRMATION) {
      return json({ error: `Envia confirm: "${RESET_CONFIRMATION}".`, destructiveScope: resetScope }, 400);
    }

    const objects = (await listR2Objects({ root, maxItems })).filter(isImportableObject).map(toImportable);
    const sectionPaths = Array.from(new Set(objects.map((object) => object.sectionPath))).sort((a, b) => a.localeCompare(b, "es"));

    if (dryRun) {
      return json({
        dryRun: true,
        bucket: getR2BucketName(),
        root,
        scannedObjects: objects.length,
        sectionsToEnsure: sectionPaths.length,
        sampleSections: sectionPaths.slice(0, 12),
        sampleMaterials: objects.slice(0, 12).map((object) => ({
          title: object.title,
          key: object.key,
          sectionPath: object.sectionPath,
          size: object.size,
          publicUrl: object.publicUrl,
        })),
      });
    }

    const deletedMaterials = reset ? await resetMaterials(supabase, resetScope) : 0;
    const sectionMap = await loadSectionMap(supabase);
    const sectionIdByPath = new Map<string, string>();

    for (const sectionPath of sectionPaths) {
      const sectionId = await ensureSectionPath(supabase, sectionMap, sectionPath);
      if (sectionId) sectionIdByPath.set(cleanPath(sectionPath), sectionId);
    }

    const existingMaterials = reset ? new Map<string, string>() : await loadExistingMaterials(supabase, objects.map((object) => object.key));
    let inserted = 0;
    let updated = 0;

    for (const object of objects) {
      const payload = {
        section_id: sectionIdByPath.get(cleanPath(object.sectionPath)) ?? null,
        title: object.title,
        material_type: object.materialType,
        visibility: "visible",
        provider: "r2",
        source_url: object.publicUrl,
        preview_url: object.publicUrl,
        r2_bucket: getR2BucketName(),
        r2_key: object.key,
        file_name: object.fileName,
        content_type: object.contentType,
        size_bytes: object.size,
        observations: `Importado automaticamente desde R2 (${root}).`,
        updated_at: new Date().toISOString(),
      };

      const existingId = existingMaterials.get(object.key);
      if (existingId) {
        const { error } = await supabase.from("materials").update(payload).eq("id", existingId);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await supabase.from("materials").insert(payload);
        if (error) throw new Error(error.message);
        inserted += 1;
      }
    }

    return json({
      dryRun: false,
      bucket: getR2BucketName(),
      root,
      reset,
      resetScope: reset ? resetScope : null,
      deletedMaterials,
      importedObjects: objects.length,
      ensuredSections: sectionPaths.length,
      inserted,
      updated,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return runImport(request, {
    dryRun: true,
    root: url.searchParams.get("root") ?? MATERIALS_R2_ROOT,
    maxItems: Number(url.searchParams.get("maxItems") ?? 10000),
  });
}

export async function POST(request: Request) {
  return runImport(request, { dryRun: false });
}
