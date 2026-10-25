import { describe, expect, it } from 'vitest';
import { bm25 } from '../lib/bm25';

const docs = [
  { id: 1, tokens: ['bm25', '检索', '排序', '词频'] },
  { id: 2, tokens: ['向量', '检索', '嵌入', '余弦'] },
  { id: 3, tokens: ['react', '组件', '前端'] },
];

describe('bm25', () => {
  it('按相关性排序：命中词元多的文档靠前', () => {
    const ranked = bm25(['bm25', '排序'], docs);
    expect(ranked[0].id).toBe(1);
    expect(ranked.some((r) => r.id === 3)).toBe(false);
  });

  it('稀有词的区分度高：bm25 只命中文档 1', () => {
    const ranked = bm25(['bm25'], docs);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe(1);
  });

  it('常见词得分低于稀有词（IDF 生效）', () => {
    const common = bm25(['检索'], docs)[0].score;
    const rare = bm25(['bm25'], docs)[0].score;
    expect(rare).toBeGreaterThan(common);
  });

  it('无命中返回空数组', () => {
    expect(bm25(['不存在的词'], docs)).toEqual([]);
  });

  it('空输入安全', () => {
    expect(bm25([], docs)).toEqual([]);
    expect(bm25(['bm25'], [])).toEqual([]);
  });
});
