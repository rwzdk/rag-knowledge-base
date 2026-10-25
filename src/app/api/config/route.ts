import { NextResponse } from 'next/server';
import { getEmbeddingMode } from '@/lib/embeddings';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    llm: Boolean(process.env.OPENAI_API_KEY),
    embeddings: getEmbeddingMode().kind === 'remote',
  });
}
