import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
