import { describe, expect, it } from 'vitest';
import { chunkText } from '../lib/chunker';

describe('chunkText', () => {
  it('短文本返回单块', () => {
    const chunks = chunkText('hello world');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('hello world');
    expect(chunks[0].index).toBe(0);
  });

  it('空文本返回空数组', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('多个短段落聚合为单块（不超过 size）', () => {
    const text = Array.from({ length: 10 }, (_, i) => `第${i}段：内容较短`).join('\n\n');
    const chunks = chunkText(text, 500, 80);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('第0段');
    expect(chunks[0].content).toContain('第9段');
  });

  it('超长段落被硬切且每块不超过 size', () => {
    const long = 'A'.repeat(1200);
    const chunks = chunkText(long, 500, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(500);
  });

  it('硬切块之间保留 overlap 上下文', () => {
    const long = 'A'.repeat(1200);
    const chunks = chunkText(long, 500, 80);
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].content.slice(-80);
      expect(chunks[i].content.startsWith(prevTail)).toBe(true);
    }
  });

  it('块编号连续递增', () => {
    const chunks = chunkText(`${'A'.repeat(600)}\n\n${'B'.repeat(600)}`, 300, 50);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it('CRLF 与多余空行被归一化', () => {
    const chunks = chunkText('a\r\n\r\n\r\n\r\nb');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('a\n\nb');
  });

  it('非法参数报错', () => {
    expect(() => chunkText('x', 0)).toThrow();
    expect(() => chunkText('x', 100, 100)).toThrow();
    expect(() => chunkText('x', 100, -1)).toThrow();
  });
});
