import { executeDataQuery, executeRpc, withDataErrors, type DataQuery } from "@/lib/server/d1-data";

type DataRequest =
  | { kind: "query"; query: DataQuery }
  | { kind: "rpc"; name: string; args?: Record<string, unknown> };

export async function POST(request: Request) {
  return withDataErrors(async () => {
    const body = await request.json() as DataRequest;
    if (body.kind === "rpc") return executeRpc(request, body.name, body.args ?? {});
    return executeDataQuery(request, body.query);
  });
}
