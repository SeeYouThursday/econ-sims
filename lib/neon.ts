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
