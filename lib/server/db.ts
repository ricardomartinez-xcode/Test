import { getD1 } from "@/lib/server/cloudflare";

type D1Sql = <T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

function toSQLite(sql: string) {
  return sql
    .replace(/\bnow\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/::[a-z_][a-z0-9_]*/gi, "")
    .replace(/\btrue\b/gi, "1")
    .replace(/\bfalse\b/gi, "0");
}

const d1Sql: D1Sql = async (strings, ...values) => {
  const text = toSQLite(strings.join("?"));
  const db = await getD1();
  const statement = db.prepare(text).bind(...values);
  const result = await statement.all();
  return result.results as Record<string, unknown>[];
};

/**
 * Compatibility tag for existing route handlers. PostgreSQL tagged-template
 * interpolation is translated to D1 positional bindings; callers keep `await sql\`...\``.
 */
export function getSql(): D1Sql {
  return d1Sql;
}

export async function hasDatabase() {
  try {
    await getD1();
    return true;
  } catch {
    return false;
  }
}
