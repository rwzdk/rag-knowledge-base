export type FusedScore = { id: number; score: number };

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Reciprocal Rank Fusion：把多路排序结果融合成一个榜单。
 * score(d) = Σ 1/(k + rank_i(d))，k=60 为原论文经验值。
 * 只依赖排名而不依赖分数本身，天然规避了 BM25 分数与余弦相似度不可比的问题。
 */
export function rrfFuse(rankings: { id: number; score: number }[][], k = 60): FusedScore[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((item, i) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
