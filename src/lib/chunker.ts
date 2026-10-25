export type Chunk = { index: number; content: string };

export const DEFAULT_CHUNK_SIZE = 500;
export const DEFAULT_CHUNK_OVERLAP = 80;

/**
 * 文档分块：优先沿段落边界聚合，段落超长时按 size 硬切并保留 overlap 上下文。
 * 这是 RAG 里少数"参数怎么选都有说法"的环节：块太大切不准、太小丢上下文、
 * overlap 用来避免关键句正好被切在边界上。
 */
export function chunkText(
  text: string,
  size = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): Chunk[] {
  if (size <= 0) throw new Error('size 必须大于 0');
  if (overlap < 0 || overlap >= size) throw new Error('overlap 必须满足 0 <= overlap < size');

  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  // 先切成不超过 size 的片段：短段落原样保留，长段落硬切 + overlap
  const step = size - overlap;
  const pieces: string[] = [];
  for (const paragraph of normalized.split(/\n\n+/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length <= size) {
      pieces.push(p);
    } else {
      for (let i = 0; i < p.length; i += step) pieces.push(p.slice(i, i + size));
    }
  }

  // 贪心把相邻片段聚合到接近 size（聚合块之间不制造 overlap，边界天然在段落处）
  const contents: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > size) {
      contents.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) contents.push(current);

  return contents.map((content, index) => ({ index, content }));
}
