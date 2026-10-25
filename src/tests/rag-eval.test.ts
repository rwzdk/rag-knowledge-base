import { describe, expect, it } from 'vitest';
import { bm25, type LexDoc } from '../lib/bm25';
import { tokenize } from '../lib/tokenize';

/**
 * 检索质量评估：固定中文语料 + 标注问题，计算 hit@3 与 MRR。
 * 这是 RAG 项目里最容易被忽略、面试时最能体现工程素养的一环：
 * 不做评估，"换个分块大小/换 BM25 参数"就全是拍脑袋。
 * 运行：npm run eval
 */
const corpus: { id: number; text: string }[] = [
  { id: 1, text: 'React 是一个用于构建用户界面的 JavaScript 库，由 Meta 开源，核心思想是组件化与虚拟 DOM。' },
  { id: 2, text: 'BM25 是一种基于词频与逆文档频率的相关性排序函数，是搜索引擎打分的经典基线。' },
  { id: 3, text: '检索增强生成 RAG 先从知识库检索相关片段，再交给大语言模型生成带引用的回答，能缓解幻觉。' },
  { id: 4, text: 'SQLite 是嵌入式轻量级关系数据库，整个数据库就是单个文件，无需独立服务进程。' },
  { id: 5, text: '倒排索引把词项映射到包含它的文档列表，是全文检索的核心数据结构。' },
  { id: 6, text: 'RRF 倒数排名融合通过合并多路检索结果的倒数排名得到统一榜单，无需调分数权重。' },
];

const annotations: { query: string; expectId: number }[] = [
  { query: '什么是 RAG？', expectId: 3 },
  { query: 'BM25 是什么排序算法', expectId: 2 },
  { query: '倒排索引是干什么的', expectId: 5 },
  { query: 'SQLite 数据库有什么特点', expectId: 4 },
  { query: 'RRF 怎么融合多路结果', expectId: 6 },
  { query: 'React 的核心思想', expectId: 1 },
];

function retrieveTop(query: string, k: number): number[] {
  const docs: LexDoc[] = corpus.map((c) => ({ id: c.id, tokens: tokenize(c.text) }));
  return bm25(tokenize(query), docs)
    .slice(0, k)
    .map((r) => r.id);
}

describe('RAG 检索质量评估（本地 BM25）', () => {
  it('hit@3 ≥ 0.83，MRR ≥ 0.78', () => {
    let hits = 0;
    let mrrSum = 0;
    const rows: string[] = [];

    for (const { query, expectId } of annotations) {
      const top3 = retrieveTop(query, 3);
      const rank = top3.indexOf(expectId);
      const hit = rank !== -1;
      if (hit) {
        hits++;
        mrrSum += 1 / (rank + 1);
      }
      rows.push(
        `${hit ? '✓' : '✗'} query="${query}" 期望=#${expectId} 实际 top3=[${top3.join(', ')}] RR=${hit ? rank + 1 : '-'}`,
      );
    }

    const hitAt3 = hits / annotations.length;
    const mrr = mrrSum / annotations.length;
    console.info(`\n[检索评估] hit@3 = ${hitAt3.toFixed(2)}，MRR = ${mrr.toFixed(2)}\n${rows.join('\n')}`);

    expect(hitAt3).toBeGreaterThanOrEqual(0.83);
    expect(mrr).toBeGreaterThanOrEqual(0.78);
  });
});
