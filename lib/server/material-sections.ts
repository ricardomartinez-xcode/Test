import { isGeneratedR2FolderPath, normalizeMaterialR2Key } from "./r2-paths.ts";

export type BucketMaterialSection = {
  id: string;
  name: string;
  path: string;
  sort_order: number | null;
};

function pathKey(value: string) {
  return normalizeMaterialR2Key(value).toLocaleLowerCase("es");
}

function canonicalScore(path: string, normalizedPath: string) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") === normalizedPath ? 0 : path.length;
}

export function selectBucketMaterialSections<T extends BucketMaterialSection>(
  folderPaths: string[],
  databaseSections: T[],
) {
  const bucketPaths = [...new Set(
    folderPaths
      .map(normalizeMaterialR2Key)
      .filter((path) => path && !isGeneratedR2FolderPath(path)),
  )].sort((a, b) => a.localeCompare(b, "es"));
  const allowed = new Set(bucketPaths.map(pathKey));
  const selected = new Map<string, { section: T; score: number }>();

  for (const section of databaseSections) {
    const normalizedPath = normalizeMaterialR2Key(section.path);
    const key = pathKey(normalizedPath);
    if (!allowed.has(key)) continue;
    const current = selected.get(key);
    const score = canonicalScore(section.path, normalizedPath);
    if (!current || score < current.score) {
      selected.set(key, { section: { ...section, path: normalizedPath }, score });
    }
  }

  return bucketPaths
    .map((path) => selected.get(pathKey(path))?.section)
    .filter((section): section is T => Boolean(section));
}
