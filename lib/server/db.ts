import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!client) {
    client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return client;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
