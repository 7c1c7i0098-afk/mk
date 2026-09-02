/**
 * Single source for the connection string used by the app and the CLI scripts.
 * There is no local-file fallback on purpose: a missing DATABASE_URL should
 * fail loudly rather than silently write to a database nobody reads.
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — point it at a PostgreSQL database.");
  }
  return url;
}
