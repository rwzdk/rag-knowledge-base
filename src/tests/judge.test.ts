import { describe, expect, it } from 'vitest';
import { judgeAnswer, type LlmCall } from '../lib/judge';

/** 依 prompt 内容返回不同脚本响应，模拟真实评审行为 */
function scriptedCall(responses: { match: RegExp; reply: string }[]): LlmCall {
  return async (prompt) => {
    const hit = responses.find((r) => r.match.test(prompt));
    if (!hit) throw new Error(`未预期的 prompt：${prompt.slice(0, 60)}`);
    return hit.reply;
  };
}

const sources = [{ title: 'RAG 笔记', content: 'RAG 先检索再生成，能缓解幻觉。' }];

describe('judgeAnswer（注入式评审）', () => {
  it('正常解析忠实度与相关性', async () => {
    const call = scriptedCall([
      {
        match: /事实核查员/,
        reply: '{"total_claims": 3, "supported_claims": 2, "unsupported_claims": ["速度提升 50%"]}',
      },
      { match: /评审/, reply: '{"score": 2, "reason": "正面回答"}' },
    ]);
    const result = await judgeAnswer(
      { question: '什么是 RAG？', answer: 'RAG 是检索增强生成，能缓解幻觉，且速度提升 50%。', sources },
      call,
    );
    expect(result.faithfulness).toBeCloseTo(2 / 3, 5);
    expect(result.relevancy).toBe(2);
    expect(result.unsupported).toEqual(['速度提升 50%']);
    expect(result.note).toBeUndefined();
  });

  it('评审输出被 Markdown 代码块包裹时仍可解析', async () => {
    const call = scriptedCall([
      { match: /事实核查员/, reply: '好的，结论如下：\n```json\n{"total_claims": 2, "supported_claims": 2, "unsupported_claims": []}\n```' },
      { match: /评审/, reply: '```json\n{"score": 1, "reason": "部分相关"}\n```' },
    ]);
    const result = await judgeAnswer({ question: 'q', answer: 'a', sources }, call);
    expect(result.faithfulness).toBe(1);
    expect(result.relevancy).toBe(1);
  });

  it('畸形 JSON 降级为 null 并给出说明', async () => {
    const call = scriptedCall([
      { match: /事实核查员/, reply: '我认为这个回答还行，总体可信。' },
      { match: /评审/, reply: '{"score": "也许吧", "reason": "看不懂"}' },
    ]);
    const result = await judgeAnswer({ question: 'q', answer: 'a', sources }, call);
    expect(result.faithfulness).toBeNull();
    expect(result.relevancy).toBeNull();
    expect(result.note).toContain('无法解析');
  });

  it('支撑数超出总数时钳制到 1', async () => {
    const call = scriptedCall([
      { match: /事实核查员/, reply: '{"total_claims": 2, "supported_claims": 5, "unsupported_claims": []}' },
      { match: /评审/, reply: '{"score": 0, "reason": "无关"}' },
    ]);
    const result = await judgeAnswer({ question: 'q', answer: 'a', sources }, call);
    expect(result.faithfulness).toBe(1);
    expect(result.relevancy).toBe(0);
  });

  it('空答案直接返回 null 并说明', async () => {
    const result = await judgeAnswer({ question: 'q', answer: '   ', sources }, async () => {
      throw new Error('不应调用评审');
    });
    expect(result.faithfulness).toBeNull();
    expect(result.relevancy).toBeNull();
    expect(result.note).toContain('答案为空');
  });

  it('评审请求失败时异常向上传播（由调用方决定降级策略）', async () => {
    const call: LlmCall = async () => {
      throw new Error('网络炸了');
    };
    await expect(judgeAnswer({ question: 'q', answer: 'a', sources }, call)).rejects.toThrow('网络炸了');
  });
});
