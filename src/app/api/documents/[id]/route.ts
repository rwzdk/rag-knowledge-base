import { NextResponse } from 'next/server';
import { db, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  await ensureSchema();
  const rs = await db.execute({ sql: 'SELECT id FROM documents WHERE id = ?', args: [id] });
  if (rs.rows.length === 0) return NextResponse.json({ error: '文档不存在' }, { status: 404 });

  await db.execute({ sql: 'DELETE FROM chunks WHERE document_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}
