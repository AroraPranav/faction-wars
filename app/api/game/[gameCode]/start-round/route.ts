import { NextRequest, NextResponse } from 'next/server';
import { GameStatus } from '@/lib/types';
import { getGameByGmToken, saveGame } from '@/lib/kv';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, worldEvent, shieldDomeFaction } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowedStatuses: GameStatus[] = ['lobby', 'round_resolved', 'round_setup'];
  if (!allowedStatuses.includes(game.status)) {
    return NextResponse.json({ error: 'Cannot start round in current state' }, { status: 400 });
  }

  const nextRound = game.currentRound + 1;

  const updated = {
    ...game,
    status: 'round_active' as const,
    currentRound: nextRound,
    currentWorldEvent: worldEvent ?? null,
    currentShieldDome: worldEvent === 'shield_dome' ? shieldDomeFaction : undefined,
    currentActions: {},
    currentBribes: [],
    currentDeclarations: {},
  };

  await saveGame(updated);
  return NextResponse.json({ ok: true, round: nextRound });
}
