import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAG 知识库问答',
  description:
    '文档分块、BM25 + 向量混合检索（RRF 融合）、带引用的流式回答，零 API Key 也可完整运行的 RAG 演示。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
