import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAddresses, saveAddress, deleteAddress } from '@/lib/kv';

function userId(session: Session | null) {
  const user = session?.user as ({ id?: string; email?: string | null }) | undefined;
  return user?.id ?? user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json([], { status: 401 });

  const type = req.nextUrl.searchParams.get('type') ?? 'home';
  return NextResponse.json(await getAddresses(uid, type));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, address } = await req.json();
  await saveAddress(uid, type, address);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = userId(session);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, address } = await req.json();
  await deleteAddress(uid, type, address);
  return NextResponse.json({ ok: true });
}
