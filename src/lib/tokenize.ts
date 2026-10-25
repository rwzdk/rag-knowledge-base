/**
 * 面向检索的轻量分词：
 * - 拉丁字母/数字串按词切分并转小写（react、bm25、rag）
 * - 中文按二元组（bigram）切分："倒排索引" → [倒排, 排索, 索引]
 *   bigram 是无需词典的中文检索基线，召回高于单字、实现成本远低于分词库
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];

  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    tokens.push(word);
  }

  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i = 0; i + 1 < run.length; i++) tokens.push(run.slice(i, i + 2));
    }
  }

  return tokens;
}
