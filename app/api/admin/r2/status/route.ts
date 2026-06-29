import { NextResponse } from "next/server";
import {
  getR2BucketName,
  getR2EndpointConfig,
  getR2PublicBaseUrl,
  hasR2Config,
  listR2FolderPrefixes,
  listR2Objects,
} from "@/lib/server/r2";
import { MATERIALS_R2_ROOT } from "@/lib/server/r2-paths";
import { errorResponse, requirePermission } from "@/lib/server/authz";

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "r2:manage");

    const endpoint = getR2EndpointConfig();
    const bucket = getR2BucketName();
    const publicBaseUrl = getR2PublicBaseUrl();
    const configured = hasR2Config();
    const diagnostics = {
      endpoint: endpoint.endpoint,
      bucket,
      root: MATERIALS_R2_ROOT,
      publicBaseUrl,
      variables: {
        CLOUDFLARE_R2_ENDPOINT: present("CLOUDFLARE_R2_ENDPOINT"),
        CLOUDFLARE_R2_BUCKET: present("CLOUDFLARE_R2_BUCKET") || Boolean(endpoint.bucketFromEndpoint),
        CLOUDFLARE_R2_ACCESS_KEY_ID: present("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: present("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
        CLOUDFLARE_R2_PUBLIC_BASE_URL: present("CLOUDFLARE_R2_PUBLIC_BASE_URL"),
        NEXT_PUBLIC_R2_PUBLIC_BASE_URL: present("NEXT_PUBLIC_R2_PUBLIC_BASE_URL"),
        NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL: present("NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL"),
      },
    };

    if (!configured) {
      return NextResponse.json({
        ok: false,
        configured: false,
        ...diagnostics,
        error: "Faltan variables privadas de R2 para listar o firmar objetos.",
      });
    }

    const [folders, sampleObjects] = await Promise.all([
      listR2FolderPrefixes({ root: MATERIALS_R2_ROOT }),
      listR2Objects({ root: MATERIALS_R2_ROOT, maxItems: 5 }),
    ]);

    return NextResponse.json({
      ok: true,
      configured: true,
      ...diagnostics,
      folders,
      sampleObjects: sampleObjects.map((object) => ({
        key: object.key,
        size: object.size,
        lastModified: object.lastModified?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
