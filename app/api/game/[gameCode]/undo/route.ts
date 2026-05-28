import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';
import { undoRound } from '@/lib/game-engine';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const restored = undoRound(game);
  if (!restored) return NextResponse.json({ error: 'Nothing to undo' }, { status: 400 });

  await saveGame(restored);
  return NextResponse.json({ ok: true, round: restored.currentRound });
}
