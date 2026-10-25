import { createDataStreamResponse, formatDataStreamPart, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ensureSchema, getDb } from '@/lib/db';
import { tokenize } from '@/lib/tokenize';
import { bm25 } from '@/lib/bm25';
import { cosineSimilarity, rrfFuse } from '@/lib/retriever';
import { embedTexts, getEmbeddingMode } from '@/lib/embeddings';
import {
  buildExtractiveAnswer,
  buildSystemPrompt,
  buildUserMessage,
  type Source,
} from '@/lib/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ChunkRow = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  content: string;
  embedding: number[] | null;
};

async function loadChunks(): Promise<ChunkRow[]> {
  await ensureSchema();
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT c.id AS chunk_id, c.document_id AS document_id, c.content AS content,
                 c.embedding AS embedding, d.title AS title
          FROM chunks c JOIN documents d ON d.id = c.document_id
          ORDER BY c.id`,
    args: [],
  });
  return rs.rows.map((r) => ({
    chunkId: Number(r.chunk_id),
    documentId: Number(r.document_id),
    documentTitle: String(r.title),
    content: String(r.content),
    embedding: r.embedding ? (JSON.parse(String(r.embedding)) as number[]) : null,
  }));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw: { role?: string; content?: unknown }[] = Array.isArray(body?.messages) ? body.messages : [];
  const question = [...raw]
    .reverse()
    .find((m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim() !== '')?.content as
    | string
    | undefined;
  if (!question) return Response.json({ error: '问题为空' }, { status: 400 });

  const topK = Math.min(Math.max(Number(body?.topK) || 4, 1), 8);

  const chunks = await loadChunks();
  if (chunks.length === 0) {
    return Response.json({ error: '知识库为空，请先上传文档' }, { status: 400 });
  }

  // 第一路：BM25 词项检索（永远可用，中文走 bigram）
  const rankings: { id: number; score: number }[][] = [
    bm25(tokenize(question), chunks.map((c) => ({ id: c.chunkId, tokens: tokenize(c.content) }))),
  ];

  // 第二路：向量检索（查询与分块都有嵌入时启用），两路用 RRF 融合
  if (getEmbeddingMode().kind === 'remote') {
    try {
      const [queryEmbedding] = (await embedTexts([question])) ?? [];
      if (queryEmbedding) {
        const vector = chunks
          .filter((c) => c.embedding)
          .map((c) => ({ id: c.chunkId, score: cosineSimilarity(queryEmbedding, c.embedding!) }))
          .sort((a, b) => b.score - a.score);
        if (vector.length > 0) rankings.push(vector);
      }
    } catch (e) {
      console.warn('查询嵌入失败，仅用词项检索:', e instanceof Error ? e.message : e);
    }
  }

  const byId = new Map(chunks.map((c) => [c.chunkId, c]));
  const sources: Source[] = rrfFuse(rankings)
    .slice(0, topK)
    .map((f, i) => {
      const c = byId.get(f.id)!;
      return {
        n: i + 1,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        chunkId: c.chunkId,
        score: Number(f.score.toFixed(4)),
        content: c.content,
      };
    });

  const apiKey = process.env.OPENAI_API_KEY;

  return createDataStreamResponse({
    execute: async (writer) => {
      // 自定义数据分片：检索来源随流下发，前端以"引用卡片"形式展示
      writer.writeData({
        sources: sources.map((s) => ({ ...s, excerpt: s.content.slice(0, 160) })),
      });

      if (!apiKey) {
        writer.write(formatDataStreamPart('text', buildExtractiveAnswer(question, sources)));
        return;
      }

      const openai = createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
      const modelId = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const result = streamText({
        model: openai(modelId),
        system: buildSystemPrompt(),
        prompt: buildUserMessage(question, sources),
      });
      result.mergeIntoDataStream(writer);
    },
  });
}
