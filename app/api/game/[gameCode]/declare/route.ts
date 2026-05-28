import { NextRequest, NextResponse } from 'next/server';
import { getGameByTeamToken, saveGame } from '@/lib/kv';
import { Declaration } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { teamToken, declaration } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const result = await getGameByTeamToken(teamToken);
  if (!result || result.game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { game, teamId } = result;

  if (game.status !== 'round_active') return NextResponse.json({ error: 'Not in active round' }, { status: 400 });
  if (game.currentWorldEvent !== 'civil_unrest') return NextResponse.json({ error: 'No civil unrest event' }, { status: 400 });

  const validDeclarations: Declaration[] = ['offensive', 'defensive', 'neutral'];
  if (!validDeclarations.includes(declaration)) {
    return NextResponse.json({ error: 'Invalid declaration' }, { status: 400 });
  }

  const updated = {
    ...game,
    currentDeclarations: { ...game.currentDeclarations, [teamId]: declaration },
  };

  await saveGame(updated);
  return NextResponse.json({ ok: true });
}
