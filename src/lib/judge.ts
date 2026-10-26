/**
 * LLM-as-judge 答案质量评估：
 * - faithfulness：答案中的断言被检索资料支撑的比例（0~1）
 * - relevancy：答案与问题的相关度（0=答非所问，1=部分相关，2=切题）
 * 评审 LLM 调用以函数注入，测试里换成脚本化实现即可离线确定性运行。
 */

export type JudgeSource = { title: string; content: string };

export type JudgeResult = {
  faithfulness: number | null;
  relevancy: number | null;
  unsupported: string[];
  note?: string;
};

export type LlmCall = (prompt: string) => Promise<string>;

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function faithfulnessPrompt(question: string, answer: string, sources: JudgeSource[]): string {
  const refs = sources.map((s, i) => `[${i + 1}]（${s.title}）\n${s.content}`).join('\n\n');
  return (
    '你是严格的事实核查员。对照下面的【参考资料】审查【回答】中的每一个事实断言。\n' +
    '【问题】' + question + '\n\n【参考资料】\n' + refs + '\n\n【回答】\n' + answer + '\n\n' +
    '只输出 JSON，不要输出其他内容：' +
    '{"total_claims": 断言总数(整数), "supported_claims": 被资料支撑的断言数(整数), "unsupported_claims": ["未被支撑的断言", ...]}'
  );
}

function relevancyPrompt(question: string, answer: string): string {
  return (
    '你是严格的评审。评估下面的【回答】对【问题】的相关程度。\n' +
    '【问题】' + question + '\n\n【回答】\n' + answer + '\n\n' +
    '评分标准：2 = 切题且正面回答；1 = 部分相关或仅有间接信息；0 = 答非所问或拒绝回答。\n' +
    '只输出 JSON，不要输出其他内容：{"score": 0或1或2, "reason": "一句话理由"}'
  );
}

export async function judgeAnswer(
  input: { question: string; answer: string; sources: JudgeSource[] },
  call: LlmCall,
): Promise<JudgeResult> {
  if (!input.answer.trim()) {
    return { faithfulness: null, relevancy: null, unsupported: [], note: '答案为空，无法评估' };
  }

  const [faithRaw, relevancyRaw] = await Promise.all([
    call(faithfulnessPrompt(input.question, input.answer, input.sources)),
    call(relevancyPrompt(input.question, input.answer)),
  ]);

  const faithJson = extractJson(faithRaw) as
    | { total_claims?: unknown; supported_claims?: unknown; unsupported_claims?: unknown }
    | null;
  const relJson = extractJson(relevancyRaw) as { score?: unknown } | null;

  const total = Number(faithJson?.total_claims);
  const supported = Number(faithJson?.supported_claims);
  const unsupported = Array.isArray(faithJson?.unsupported_claims)
    ? (faithJson!.unsupported_claims as unknown[]).map(String)
    : [];

  const faithfulness =
    Number.isFinite(total) && Number.isFinite(supported) && total > 0
      ? Math.min(1, Math.max(0, supported / total))
      : null;

  const relevancyScore = Number(relJson?.score);
  const relevancy =
    Number.isFinite(relevancyScore) && [0, 1, 2].includes(relevancyScore) ? relevancyScore : null;

  const note =
    faithfulness === null && relevancy === null ? '评审输出无法解析为有效的 JSON 结论' : undefined;

  return { faithfulness, relevancy, unsupported, note };
}

/** 基于 OpenAI 兼容接口的默认评审调用；未配置 Key 时返回 null（调用方降级跳过） */
export function createEnvLlmCall(): LlmCall | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  return async (prompt: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是严谨的评审，严格按用户要求的 JSON 格式输出。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`评审 LLM 请求失败 ${res.status}：${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  };
}
