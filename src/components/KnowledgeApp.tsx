'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DocumentsPanel, { type DocumentItem } from './DocumentsPanel';
import SourceCard, { type SourceItem } from './SourceCard';

const EXAMPLES = [
  '这份知识库里都讲了什么？',
  '总结一下检索增强生成的流程',
  'BM25 和向量检索分别适合什么场景？',
];

export default function KnowledgeApp() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [config, setConfig] = useState<{ llm: boolean; embeddings: boolean } | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, setInput, handleSubmit, isLoading, error, stop, data } = useChat({
    api: '/api/ask',
  });

  // 服务端通过自定义数据分片下发检索来源，从累积的 data 里取最新一份
  useEffect(() => {
    if (!data || data.length === 0) return;
    const payload = data[data.length - 1] as { sources?: SourceItem[] } | undefined;
    if (payload && Array.isArray(payload.sources)) setSources(payload.sources);
  }, [data]);

  async function refreshDocuments() {
    const res = await fetch('/api/documents');
    if (!res.ok) return;
    const data = (await res.json()) as { documents: DocumentItem[] };
    setDocuments(data.documents);
  }

  useEffect(() => {
    void refreshDocuments();
    fetch('/api/config')
      .then((r) => r.json())
      .then((c: { llm: boolean; embeddings: boolean }) => setConfig(c))
      .catch(() => setConfig({ llm: false, embeddings: false }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sources.length]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isLoading || documents.length === 0) return;
    setSources([]);
    handleSubmit(e);
  }

  const retrievalBadge = config?.embeddings ? '混合检索（BM25 + 向量，RRF 融合）' : '本地词项检索（BM25 + 中文 bigram）';

  return (
    <div className="flex h-dvh overflow-hidden">
      <DocumentsPanel documents={documents} onChanged={refreshDocuments} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
          <h1 className="text-sm font-semibold tracking-wide">📚 RAG 知识库问答</h1>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">{retrievalBadge}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              config?.llm ? 'bg-sky-950 text-sky-400' : 'bg-amber-950/60 text-amber-400'
            }`}
          >
            {config === null ? '…' : config.llm ? 'LLM 已接入 · 引用式回答' : '未配置 LLM · 本地摘要回答'}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.length === 0 ? (
              <div className="pt-16 text-center">
                <div className="text-3xl">📚</div>
                <h2 className="mt-4 text-lg font-semibold">问点什么吧</h2>
                <p className="mt-2 text-sm text-slate-500">
                  回答只基于左侧知识库检索到的内容，并附带引用来源{documents.length === 0 && '（先在左侧添加文档）'}
                </p>
                {documents.length > 0 && (
                  <div className="mx-auto mt-6 grid max-w-xl gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => {
                          setInput(ex);
                          textareaRef.current?.focus();
                        }}
                        className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sky-600/90 px-4 py-2.5 text-sm">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="prose prose-invert prose-sm max-w-none prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-950">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ),
              )
            )}

            {sources.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-xs font-medium text-slate-500">🔍 检索来源（本轮引用）</p>
                {sources.map((s) => (
                  <SourceCard key={s.chunkId} source={s} />
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-1.5 px-1 text-slate-500">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                请求失败：{error.message || '未知错误'}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-4">
          <form ref={formRef} onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              rows={2}
              disabled={documents.length === 0}
              placeholder={documents.length === 0 ? '请先在左侧添加文档…' : '输入问题，Enter 发送，Shift+Enter 换行'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-500 disabled:opacity-50"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl bg-slate-700 px-4 py-3 text-sm transition-colors hover:bg-slate-600"
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || documents.length === 0}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-medium transition-colors hover:bg-sky-500 disabled:opacity-40"
              >
                提问
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
