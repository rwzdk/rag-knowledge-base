import { describe, expect, it } from 'vitest';
import { bm25 } from '../lib/bm25';
import { buildExtractiveAnswer } from '../lib/rag';
import { tokenize } from '../lib/tokenize';
import { createEnvLlmCall, judgeAnswer } from '../lib/judge';
import type { Source } from '../lib/rag';

/**
 * LLM-as-judge 端到端评估：对本地检索 + 摘要式回答跑 faithfulness / relevancy 双指标。
 * 未配置 OPENAI_API_KEY 时整体跳过（CI 无 Key 亦安全）；
 * 配置后运行：npm run eval:judge
 */
const maybe = describe.skipIf(!process.env.OPENAI_API_KEY);

const corpus = [
  { id: 1, text: 'RAG（检索增强生成）先从知识库检索相关片段，再交给大语言模型生成带引用的回答，能缓解幻觉。' },
  { id: 2, text: 'BM25 是基于词频与逆文档频率的经典排序函数，适合关键词精确匹配。' },
  { id: 3, text: 'RRF 倒数排名融合通过合并多路检索结果的倒数排名得到统一榜单。' },
  { id: 4, text: 'SQLite 是嵌入式数据库，整个库就是一个文件，部署轻量。' },
];

const questions = [
  { q: 'RAG 是什么？', expectId: 1 },
  { q: 'BM25 适合什么场景？', expectId: 2 },
  { q: 'RRF 怎么融合多路结果？', expectId: 3 },
  { q: 'SQLite 有什么特点？', expectId: 4 },
];

maybe('LLM-as-judge 端到端评估', () => {
  it(
    '摘要式回答：faithfulness ≥ 0.9，平均 relevancy ≥ 1',
    { timeout: 180_000 },
    async () => {
      const call = createEnvLlmCall();
      if (!call) throw new Error('评审调用不可用');

      const docs = corpus.map((c) => ({ id: c.id, tokens: tokenize(c.text) }));
      const rows: { q: string; faithfulness: number | null; relevancy: number | null }[] = [];

      for (const { q, expectId } of questions) {
        const top = bm25(tokenize(q), docs).slice(0, 3);
        const sources: Source[] = top.map((t, i) => {
          const doc = corpus.find((c) => c.id === t.id)!;
          return {
            n: i + 1,
            documentId: 1,
            documentTitle: `语料 #${doc.id}`,
            chunkId: doc.id,
            score: t.score,
            content: doc.text,
          };
        });
        const answer = buildExtractiveAnswer(q, sources);
        const verdict = await judgeAnswer(
          {
            question: q,
            answer,
            sources: sources.map((s) => ({ title: s.documentTitle, content: s.content })),
          },
          call,
        );
        rows.push({ q, faithfulness: verdict.faithfulness, relevancy: verdict.relevancy });
      }

      console.info('\n[LLM-as-judge]\n' + rows.map((r) => `${r.q} → faith=${r.faithfulness} rel=${r.relevancy}`).join('\n'));

      const faiths = rows.map((r) => r.faithfulness).filter((v): v is number => v !== null);
      const rels = rows.map((r) => r.relevancy).filter((v): v is number => v !== null);
      const avgFaith = faiths.reduce((a, b) => a + b, 0) / rows.length;
      const avgRel = rels.reduce((a, b) => a + b, 0) / rows.length;

      expect(avgFaith).toBeGreaterThanOrEqual(0.9);
      expect(avgRel).toBeGreaterThanOrEqual(1);
    },
  );
});
