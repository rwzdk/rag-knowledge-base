export type Source = {
  n: number;
  documentId: number;
  documentTitle: string;
  chunkId: number;
  score: number;
  content: string;
};

export const buildSystemPrompt = () =>
  '你是一个严谨的知识库问答助手。遵守以下规则：\n' +
  '- 只能依据用户消息中【参考资料】里的内容回答，不要引入资料之外的知识\n' +
  '- 引用资料时在句末标注编号，如 [1]、[2]\n' +
  '- 如果资料不足以回答问题，明确说明"知识库中没有足够的相关内容"，不要编造\n' +
  '- 用简体中文、简洁地回答，可以使用 Markdown';

export function buildContextBlock(sources: Source[]): string {
  return sources
    .map((s) => `[${s.n}]（文档《${s.documentTitle}》）\n${s.content}`)
    .join('\n\n');
}

export function buildUserMessage(question: string, sources: Source[]): string {
  return `【参考资料】\n${buildContextBlock(sources)}\n\n【问题】${question}`;
}

/** 未配置 LLM 时的本地降级回答：直接把命中的资料摘要展示给用户 */
export function buildExtractiveAnswer(question: string, sources: Source[]): string {
  const lines = sources.map(
    (s) => `- [${s.n}] 《${s.documentTitle}》：${s.content.replace(/\s+/g, ' ').slice(0, 120)}…`,
  );
  return (
    '⚠️ 尚未配置 LLM（`OPENAI_API_KEY`），以下是基于**本地混合检索**命中的资料片段，' +
    '配置后可获得带引用的自然语言回答：\n\n' +
    `问题：${question}\n\n${lines.join('\n')}`
  );
}
