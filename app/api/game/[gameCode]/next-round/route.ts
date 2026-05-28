import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (game.status !== 'round_resolved') return NextResponse.json({ error: 'Round not yet resolved' }, { status: 400 });

  const updated = { ...game, status: 'round_setup' as const };
  await saveGame(updated);
  return NextResponse.json({ ok: true });
}
