import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, ensureSchema } from '@/lib/db';
import { chunkText } from '@/lib/chunker';
import { embedTexts, getEmbeddingMode } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题过长'),
  text: z.string().min(1, '内容不能为空').max(500_000, '内容过长（上限 50 万字符）'),
});

export async function GET() {
  await ensureSchema();
  const rs = await db.execute({
    sql: 'SELECT id, title, char_count, chunk_count, embedding_model, created_at FROM documents ORDER BY id DESC',
    args: [],
  });
  return NextResponse.json({
    documents: rs.rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      charCount: Number(r.char_count),
      chunkCount: Number(r.chunk_count),
      embeddingModel: (r.embedding_model as string) ?? null,
      createdAt: String(r.created_at),
    })),
  });
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数错误' }, { status: 400 });
  }
  const { title, text } = parsed.data;

  const chunks = chunkText(text);
  if (chunks.length === 0) return NextResponse.json({ error: '文档内容为空' }, { status: 400 });

  // 尽力嵌入：接口失败时降级为纯词项检索，不阻塞入库
  let embeddings: number[][] | null = null;
  const mode = getEmbeddingMode();
  if (mode.kind === 'remote') {
    try {
      embeddings = await embedTexts(chunks.map((c) => c.content));
    } catch (e) {
      console.warn('嵌入失败，降级为词项检索:', e instanceof Error ? e.message : e);
    }
  }

  await ensureSchema();
  const embeddingModel = embeddings && mode.kind === 'remote' ? mode.model : null;
  const embeddingDimension = embeddings && mode.kind === 'remote' ? mode.dimension : null;
  const rs = await db.execute({
    sql: 'INSERT INTO documents (title, char_count, chunk_count, embedding_model, embedding_dimension) VALUES (?, ?, ?, ?, ?)',
    args: [title, text.length, chunks.length, embeddingModel, embeddingDimension],
  });
  const documentId = Number(rs.lastInsertRowid);

  for (const chunk of chunks) {
    await db.execute({
      sql: 'INSERT INTO chunks (document_id, idx, content, embedding) VALUES (?, ?, ?, ?)',
      args: [documentId, chunk.index, chunk.content, embeddings ? JSON.stringify(embeddings[chunk.index]) : null],
    });
  }

  return NextResponse.json({
    document: {
      id: documentId,
      title,
      charCount: text.length,
      chunkCount: chunks.length,
      embeddingModel,
    },
  });
}
