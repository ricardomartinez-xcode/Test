import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getCloudflareEnv(): Promise<CloudflareEnv> {
  const context = await getCloudflareContext({ async: true });
  return context.env as unknown as CloudflareEnv;
}

export async function getD1(): Promise<D1Database> {
  const env = await getCloudflareEnv();
  if (!env.DB) throw new Error("D1 binding DB no configurado.");
  return env.DB;
}

export async function getMaterialsBucket(): Promise<R2Bucket> {
  const env = await getCloudflareEnv();
  if (!env.MATERIALS_BUCKET) throw new Error("R2 binding MATERIALS_BUCKET no configurado.");
  return env.MATERIALS_BUCKET;
}
