import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';

// GM manually adjusts TP or bribe tokens for a team
export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, teamId, tpDelta, bribeDelta } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updatedTeams = game.teams.map(t => {
    if (t.id !== teamId) return t;
    return {
      ...t,
      tp: typeof tpDelta === 'number' ? t.tp + tpDelta : t.tp,
      bribes: typeof bribeDelta === 'number' ? Math.max(0, t.bribes + bribeDelta) : t.bribes,
    };
  });

  const updated = { ...game, teams: updatedTeams };
  await saveGame(updated);
  return NextResponse.json({ ok: true });
}
