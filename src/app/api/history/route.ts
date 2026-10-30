import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHistory, saveToHistory, deleteFromHistory } from '@/lib/kv';

function userId(session: Session | null) {
  const user = session?.user as ({ id?: string; email?: string | null }) | undefined;
  return user?.id ?? user?.email ?? null;
}

// KV 오류는 503으로 알린다 — 클라이언트가 "서버에 없음"과 "서버 장애"를 구분할 수 있도록
function kvError(e: unknown) {
  console.error('[api/history] KV error:', e);
  return NextResponse.json({ error: 'KV_UNAVAILABLE' }, { status: 503 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json([], { status: 401 });
  try {
    return NextResponse.json(await getHistory(uid));
  } catch (e) {
    return kvError(e);
  }
}

// 단건(객체) 또는 여러 건(배열: localStorage 이력 이전용)을 받는다
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  try {
    await saveToHistory(uid, Array.isArray(body) ? body : [body]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return kvError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  try {
    await deleteFromHistory(uid, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return kvError(e);
  }
}
