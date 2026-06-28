import { getCloudflareEnv, getMaterialsBucket } from "@/lib/server/cloudflare";
import { normalizeMaterialR2Key } from "@/lib/server/r2-paths";

function publicUrl(baseUrl: string | undefined, key: string) {
  const base = baseUrl?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function listNativeR2Objects(prefix = "", limit = 1000) {
  const bucket = await getMaterialsBucket();
  const objects: Array<{ key: string; size: number; lastModified: Date; etag: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, limit: Math.min(limit - objects.length, 1000), cursor });
    objects.push(...page.objects.map((object) => ({ key: object.key, size: object.size, lastModified: object.uploaded, etag: object.etag })));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && objects.length < limit);
  return objects;
}

export async function putNativeR2Object(input: { key: string; body: ReadableStream | ArrayBuffer | string; contentType?: string; contentDisposition?: string }) {
  const bucket = await getMaterialsBucket();
  const key = normalizeMaterialR2Key(input.key);
  if (!key) throw new Error("Clave R2 inválida.");
  await bucket.put(key, input.body, { httpMetadata: { contentType: input.contentType, contentDisposition: input.contentDisposition } });
  const env = await getCloudflareEnv();
  return { key, publicUrl: publicUrl(env.R2_PUBLIC_BASE_URL, key) };
}

export async function getNativeR2Object(key: string) {
  const bucket = await getMaterialsBucket();
  const normalizedKey = normalizeMaterialR2Key(key);
  if (!normalizedKey) return null;
  return bucket.get(normalizedKey);
}

export async function deleteNativeR2Object(key: string) {
  const bucket = await getMaterialsBucket();
  const normalizedKey = normalizeMaterialR2Key(key);
  if (!normalizedKey) throw new Error("Clave R2 inválida.");
  await bucket.delete(normalizedKey);
}
