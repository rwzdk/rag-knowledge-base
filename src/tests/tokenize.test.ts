import { describe, expect, it } from 'vitest';
import { tokenize } from '../lib/tokenize';

describe('tokenize', () => {
  it('拉丁词转小写切分', () => {
    expect(tokenize('React is NOT hard')).toEqual(['react', 'is', 'not', 'hard']);
  });

  it('数字串保留为词元', () => {
    expect(tokenize('BM25 vs GPT4')).toEqual(['bm25', 'vs', 'gpt4']);
  });

  it('中文按二元组切分', () => {
    expect(tokenize('倒排索引')).toEqual(['倒排', '排索', '索引']);
  });

  it('单个汉字保留为词元', () => {
    expect(tokenize('图')).toEqual(['图']);
  });

  it('中英混排', () => {
    const tokens = tokenize('RAG 检索增强');
    expect(tokens).toContain('rag');
    expect(tokens).toContain('检索');
    expect(tokens).toContain('增强');
  });

  it('空字符串返回空数组', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('，。！？')).toEqual([]);
  });
});
