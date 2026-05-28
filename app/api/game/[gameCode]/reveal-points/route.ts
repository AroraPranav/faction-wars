import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, visible } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updated = { ...game, pointsVisible: !!visible };
  await saveGame(updated);
  return NextResponse.json({ ok: true, pointsVisible: updated.pointsVisible });
}
