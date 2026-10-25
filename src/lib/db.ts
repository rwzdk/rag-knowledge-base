import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';

function defaultUrl(): string {
  const toFileUrl = (p: string) => `file:${p.replace(/\\/g, '/')}`;
  try {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    return toFileUrl(path.join(dir, 'app.db'));
  } catch {
    // 只读文件系统（如部分 Serverless 环境）回退到临时目录
    const tmp = path.join(os.tmpdir(), 'rag-knowledge-base');
    fs.mkdirSync(tmp, { recursive: true });
    return toFileUrl(path.join(tmp, 'app.db'));
  }
}

export const db: Client = createClient({
  url: process.env.LIBSQL_URL ?? defaultUrl(),
  authToken: process.env.LIBSQL_AUTH_TOKEN,
});

let schemaPromise: Promise<unknown> | null = null;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = db.batch(
      [
        `CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          char_count INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL DEFAULT 0,
          embedding_model TEXT,
          embedding_dimension INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          idx INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id, idx)`,
      ].map((sql) => ({ sql, args: [] as never[] })),
    );
  }
  return schemaPromise;
}
