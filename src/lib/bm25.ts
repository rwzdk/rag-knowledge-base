export type LexDoc = { id: number; tokens: string[] };
export type Scored = { id: number; score: number };

const K1 = 1.5;
const B = 0.75;

/**
 * 经典 BM25 排序函数（纯函数、无外部依赖）：
 * score(q, d) = Σ IDF(q) · tf·(k1+1) / (tf + k1·(1-b+b·|d|/avgdl))
 * IDF 采用 Lucene 风格 ln(1 + (N-df+0.5)/(df+0.5))，避免负值。
 */
export function bm25(queryTokens: string[], docs: LexDoc[]): Scored[] {
  const N = docs.length;
  if (N === 0 || queryTokens.length === 0) return [];

  const avgdl = docs.reduce((sum, d) => sum + d.tokens.length, 0) / N;
  const queries = [...new Set(queryTokens)];

  const df = new Map<string, number>();
  for (const q of queries) {
    let count = 0;
    for (const d of docs) if (d.tokens.includes(q)) count++;
    df.set(q, count);
  }

  const results: Scored[] = [];
  for (const d of docs) {
    const tf = new Map<string, number>();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const q of queries) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * d.tokens.length) / avgdl));
    }
    if (score > 0) results.push({ id: d.id, score });
  }

  return results.sort((a, b) => b.score - a.score);
}
