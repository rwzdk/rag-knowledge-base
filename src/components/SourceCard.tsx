'use client';

export type SourceItem = {
  n: number;
  documentId: number;
  documentTitle: string;
  chunkId: number;
  score: number;
  excerpt: string;
};

export default function SourceCard({ source }: { source: SourceItem }) {
  return (
    <details className="group rounded-xl bg-slate-950/70">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
        <span className="rounded bg-sky-950 px-1.5 py-0.5 font-medium text-sky-400">[{source.n}]</span>
        <span className="min-w-0 flex-1 truncate text-slate-300">{source.documentTitle}</span>
        <span className="shrink-0 text-slate-600">RRF {source.score}</span>
      </summary>
      <p className="border-t border-slate-800/60 px-3 py-2 text-xs leading-relaxed text-slate-400">
        {source.excerpt}…
      </p>
    </details>
  );
}
