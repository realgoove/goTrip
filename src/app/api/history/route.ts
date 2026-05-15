import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHistory, saveToHistory, deleteFromHistory } from '@/lib/kv';

function userId(session: Session | null) {
  const user = session?.user as ({ id?: string; email?: string | null }) | undefined;
  return user?.id ?? user?.email ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await getHistory(uid));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const search = await req.json();
  await saveToHistory(uid, search);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await deleteFromHistory(uid, id);
  return NextResponse.json({ ok: true });
}
