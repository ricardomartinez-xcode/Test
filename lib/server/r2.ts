import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MATERIALS_R2_ROOT, normalizeMaterialR2Key } from "@/lib/server/r2-paths";

export type R2ListedObject = {
  key: string;
  size: number;
  lastModified: Date | null;
  etag: string | null;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function normalizeBaseUrl(value: string | undefined | null) {
  const raw = value?.trim() ?? "";
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return withProtocol.replace(/\/+$/, "");
  }
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parentPrefix(key: string) {
  const parts = key.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `${parts.join("/")}/` : "";
}

function basename(key: string) {
  return key.split("/").filter(Boolean).pop() ?? key;
}

function comparable(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isNotFoundError(error: unknown) {
  const maybeError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return maybeError?.name === "NotFound" || maybeError?.$metadata?.httpStatusCode === 404;
}

export function hasR2Config() {
  const { endpoint } = getR2EndpointConfig();
  return Boolean(
    endpoint &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      getR2BucketName(),
  );
}

export function getR2EndpointConfig() {
  const raw = process.env.CLOUDFLARE_R2_ENDPOINT?.trim() ?? "";
  if (!raw) return { endpoint: "", bucketFromEndpoint: "" };

  try {
    const url = new URL(raw);
    const bucketFromEndpoint = url.pathname.split("/").filter(Boolean)[0] ?? "";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return { endpoint: url.toString().replace(/\/$/, ""), bucketFromEndpoint };
  } catch {
    return { endpoint: raw.replace(/\/+$|\s+$/g, ""), bucketFromEndpoint: "" };
  }
}

export function getR2BucketName() {
  const configuredBucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
  if (configuredBucket) return configuredBucket;
  return getR2EndpointConfig().bucketFromEndpoint;
}

export function getR2PublicBaseUrl() {
  return normalizeBaseUrl(
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ||
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL ||
      "",
  );
}

export function encodeR2Key(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function createPublicR2Url(key: string | null | undefined) {
  const publicBaseUrl = getR2PublicBaseUrl();
  const normalizedKey = normalizeMaterialR2Key(key);
  return normalizedKey && publicBaseUrl ? `${publicBaseUrl}/${encodeR2Key(normalizedKey)}` : null;
}

export function getR2Client() {
  const { endpoint } = getR2EndpointConfig();
  if (!endpoint) throw new Error("Missing env var: CLOUDFLARE_R2_ENDPOINT");
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function listR2Objects(input: { root?: string; maxItems?: number } = {}) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");

  const client = getR2Client();
  const root = (input.root ?? MATERIALS_R2_ROOT).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const prefix = root ? `${root}/` : "";
  const maxItems = Math.max(1, Math.min(input.maxItems ?? 10000, 50000));
  const objects: R2ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: Math.min(1000, maxItems - objects.length),
    }));

    for (const item of response.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? null,
        etag: item.ETag ?? null,
      });
      if (objects.length >= maxItems) break;
    }

    continuationToken = response.IsTruncated && objects.length < maxItems ? response.NextContinuationToken : undefined;
  } while (continuationToken && objects.length < maxItems);

  return objects;
}

export async function r2ObjectExists(key: string) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

export async function resolveR2ObjectKey(input: { key: string; fileName?: string | null; title?: string | null }) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();

  const decodedKey = safeDecode(input.key);
  const normalizedKey = normalizeMaterialR2Key(decodedKey);
  const exactCandidates = unique([
    input.key,
    decodedKey,
    normalizeMaterialR2Key(input.key),
    normalizedKey,
    normalizedKey.normalize("NFC"),
    normalizedKey.normalize("NFD"),
  ]);

  for (const candidate of exactCandidates) {
    if (await r2ObjectExists(candidate)) return candidate;
  }

  const targetNames = unique([
    basename(input.key),
    basename(decodedKey),
    basename(normalizedKey),
    input.fileName ?? undefined,
    input.title ?? undefined,
  ]).map(comparable).filter(Boolean);

  const prefixes = unique([
    parentPrefix(normalizedKey),
    parentPrefix(decodedKey),
    `${MATERIALS_R2_ROOT}/`,
  ]);

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;
    let pages = 0;

    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));

      for (const object of response.Contents ?? []) {
        const objectKey = object.Key;
        if (!objectKey) continue;

        if (exactCandidates.includes(objectKey)) return objectKey;
        if (targetNames.includes(comparable(basename(objectKey)))) return objectKey;
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      pages += 1;
    } while (continuationToken && pages < 10);
  }

  throw new Error(`No se encontró el objeto R2. Key intentada: ${normalizedKey}`);
}

export async function createUploadUrl(input: { key: string; contentType: string }) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
  return {
    key: input.key,
    uploadUrl,
    publicUrl: createPublicR2Url(input.key),
    expiresIn: 300,
  };
}

export async function createR2ReadUrl(input: {
  key: string;
  fileName?: string | null;
  contentType?: string | null;
  disposition?: "inline" | "attachment";
}) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();
  const normalizedKey = normalizeMaterialR2Key(input.key);
  const fileName = input.fileName?.trim() || normalizedKey.split("/").pop() || "material";
  const encodedFileName = encodeURIComponent(fileName);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
    ResponseContentType: input.contentType ?? undefined,
    ResponseContentDisposition: `${input.disposition ?? "inline"}; filename*=UTF-8''${encodedFileName}`,
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 5 });
}

export async function listR2FolderPrefixes(input: { root: string }) {
  const bucket = getR2BucketName();
  if (!bucket) throw new Error("Missing env var: CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();
  const rootPrefix = input.root.trim().replace(/\\/g, "/").replace(/\/$/, "");
  const queue = [rootPrefix ? `${rootPrefix}/` : ""];
  const seen = new Set<string>(rootPrefix ? [rootPrefix] : []);

  while (queue.length) {
    const prefix = queue.shift()!;
    let continuationToken: string | undefined;

    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      }));

      for (const item of response.CommonPrefixes ?? []) {
        const folder = item.Prefix?.replace(/\/$/, "");
        if (!folder || seen.has(folder)) continue;
        seen.add(folder);
        queue.push(`${folder}/`);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b, "es"));
}
