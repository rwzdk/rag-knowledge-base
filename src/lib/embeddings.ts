import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export type EmbeddingMode = { kind: 'local' } | { kind: 'remote'; model: string; dimension: number };

/**
 * 嵌入层按环境变量自动降级：
 * - 配置了 EMBEDDINGS_API_KEY + EMBEDDINGS_MODEL → 走 OpenAI 兼容的 embedding 接口
 * - 未配置 → 返回 null，检索退化为纯 BM25 词项检索
 * 这样项目在零 API Key 的情况下依然完整可运行、可测试。
 */
export function getEmbeddingMode(): EmbeddingMode {
  if (process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_MODEL) {
    return {
      kind: 'remote',
      model: process.env.EMBEDDINGS_MODEL,
      dimension: Number(process.env.EMBEDDINGS_DIMENSION ?? 1536),
    };
  }
  return { kind: 'local' };
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const mode = getEmbeddingMode();
  if (mode.kind === 'local' || texts.length === 0) return null;

  const provider = createOpenAI({
    apiKey: process.env.EMBEDDINGS_API_KEY,
    baseURL: process.env.EMBEDDINGS_BASE_URL || undefined,
  });
  const { embeddings } = await embedMany({
    model: provider.textEmbeddingModel(mode.model),
    values: texts,
  });
  return embeddings;
}
