import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function hasR2Config() {
  return Boolean(
    process.env.CLOUDFLARE_R2_ENDPOINT &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET,
  );
}

export function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: required("CLOUDFLARE_R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function createUploadUrl(input: { key: string; contentType: string }) {
  const bucket = required("CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  return {
    key: input.key,
    uploadUrl,
    publicUrl: publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${input.key}` : null,
    expiresIn: 300,
  };
}

export async function createR2ReadUrl(input: {
  key: string;
  fileName?: string | null;
  contentType?: string | null;
  disposition?: "inline" | "attachment";
}) {
  const bucket = required("CLOUDFLARE_R2_BUCKET");
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
  const bucket = required("CLOUDFLARE_R2_BUCKET");
  const client = getR2Client();
  const rootPrefix = input.root.replace(/\/$/, "");
  const queue = [`${rootPrefix}/`];
  const seen = new Set<string>([rootPrefix]);

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
