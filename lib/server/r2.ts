import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
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
    return { endpoint: raw.replace(/\/+$/, ""), bucketFromEndpoint: "" };
  }
}

export function getR2BucketName() {
  const configuredBucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
  if (configuredBucket) return configuredBucket;
  return getR2EndpointConfig().bucketFromEndpoint;
}

export function getR2PublicBaseUrl() {
  return (
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");
}

export function encodeR2Key(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function createPublicR2Url(key: string | null | undefined) {
  const publicBaseUrl = getR2PublicBaseUrl();
  return key && publicBaseUrl ? `${publicBaseUrl}/${encodeR2Key(key)}` : null;
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
  const fileName = input.fileName?.trim() || input.key.split("/").pop() || "material";
  const encodedFileName = encodeURIComponent(fileName);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.key,
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
