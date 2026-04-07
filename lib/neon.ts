import { neon } from '@neondatabase/serverless';

type NeonSql = ReturnType<typeof neon>;

declare global {
  var __econSimsNeonSql: NeonSql | undefined;
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? '';
}

export function isNeonConfigured() {
  return getDatabaseUrl().length > 0;
}

export function getNeonSql() {
  if (!isNeonConfigured()) {
    throw new Error('Missing DATABASE_URL for Neon connection.');
  }

  if (!globalThis.__econSimsNeonSql) {
    globalThis.__econSimsNeonSql = neon(getDatabaseUrl());
  }

  return globalThis.__econSimsNeonSql;
}

// Planned usage: lightweight DB health probe for a future diagnostics/health
// endpoint so we can verify Neon connectivity from the running app process.
// export async function pingNeon() {
//   const sql = getNeonSql();
//   const result = await sql`SELECT 1 AS ok`;
//   if (!Array.isArray(result)) {
//     return false;
//   }
//
//   const firstRow = result[0] as { ok?: unknown } | undefined;
//   return firstRow?.ok === 1;
// }
