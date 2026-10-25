import { describe, expect, it } from 'vitest';
import { cosineSimilarity, rrfFuse } from '../lib/retriever';

describe('cosineSimilarity', () => {
  it('同向向量为 1', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it('正交向量为 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('反向向量为 -1', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 10);
  });

  it('常见夹角 45° 为 √2/2', () => {
    expect(cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('零向量与维度不一致安全返回 0', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1], [1, 1])).toBe(0);
  });
});

describe('rrfFuse', () => {
  const lexical = [
    { id: 3, score: 9 },
    { id: 1, score: 5 },
    { id: 2, score: 1 },
  ];
  const vector = [
    { id: 1, score: 0.9 },
    { id: 2, score: 0.8 },
    { id: 4, score: 0.7 },
  ];

  it('两路都靠前的文档融合后排名第一', () => {
    const fused = rrfFuse([lexical, vector]);
    expect(fused[0].id).toBe(1); // 词项第 2 + 向量第 1
    expect(fused.map((f) => f.id)).toContain(3);
    expect(fused.map((f) => f.id)).toContain(4);
  });

  it('只出现在一路的文档按该路排名参与融合', () => {
    const fused = rrfFuse([lexical]);
    expect(fused.map((f) => f.id)).toEqual([3, 1, 2]);
  });

  it('融合分数是倒数排名之和', () => {
    const fused = rrfFuse([lexical, vector], 60);
    const item1 = fused.find((f) => f.id === 1)!;
    expect(item1.score).toBeCloseTo(1 / (60 + 2) + 1 / (60 + 1), 10);
  });

  it('空输入返回空数组', () => {
    expect(rrfFuse([])).toEqual([]);
    expect(rrfFuse([[]])).toEqual([]);
  });
});
