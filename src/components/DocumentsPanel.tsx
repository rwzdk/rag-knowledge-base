'use client';

import { useRef, useState } from 'react';

export type DocumentItem = {
  id: number;
  title: string;
  charCount: number;
  chunkCount: number;
  embeddingModel: string | null;
};

export default function DocumentsPanel({
  documents,
  onChanged,
}: {
  documents: DocumentItem[];
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(payload: { title: string; text: string }) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? '上传失败');
        return;
      }
      setTitle('');
      setText('');
      if (fileRef.current) fileRef.current.value = '';
      await onChanged();
    } catch {
      setError('网络错误，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload({ title: file.name.replace(/\.(txt|md|markdown)$/i, ''), text: await file.text() });
  }

  async function onDelete(id: number) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    await onChanged();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
      <div className="px-4 py-4">
        <h2 className="text-sm font-bold tracking-wide">📚 知识库</h2>
        <p className="mt-1 text-xs text-slate-500">支持 .txt / .md，上传后自动分块并建立索引</p>
      </div>

      <div className="mx-4 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-xs">
        {(['file', 'paste'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-1.5 transition-colors ${
              tab === t ? 'bg-sky-600 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'file' ? '上传文件' : '粘贴文本'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'file' ? (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 py-6 text-xs text-slate-400 transition-colors hover:border-sky-600 hover:text-slate-200 ${
              busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <span className="text-lg">📄</span>
            {busy ? '处理中…' : '点击选择 .txt / .md 文件'}
            <input ref={fileRef} type="file" accept=".txt,.md,.markdown,text/plain" className="hidden" onChange={onFileChange} />
          </label>
        ) : (
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文档标题"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-sky-500"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="粘贴文档内容…"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-sky-500"
            />
            <button
              onClick={() => void upload({ title: title || '未命名文档', text })}
              disabled={busy || !text.trim()}
              className="w-full rounded-lg bg-sky-600 py-2 text-xs font-medium transition-colors hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? '处理中…' : '加入知识库'}
            </button>
          </div>
        )}
        {error && <p className="mt-2 rounded-lg bg-red-950/60 px-3 py-2 text-xs text-red-300">{error}</p>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {documents.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-500">还没有文档</p>}
        {documents.map((d) => (
          <div
            key={d.id}
            className="group flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-slate-200">{d.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.chunkCount} 块 · {d.charCount} 字
                {d.embeddingModel && <span className="ml-1 text-sky-500">· 已向量化</span>}
              </p>
            </div>
            <button
              title="删除文档"
              onClick={() => void onDelete(d.id)}
              className="hidden text-xs text-slate-500 transition-colors hover:text-red-400 group-hover:block"
            >
              🗑
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
