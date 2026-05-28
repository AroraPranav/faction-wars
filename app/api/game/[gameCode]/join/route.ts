import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame, saveTeamToken } from '@/lib/kv';
import { generateToken, getTeamColor } from '@/lib/utils';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gameCode } = params;
  const { name } = await req.json();

  if (!name || name.trim().length < 1) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  const game = await getGame(gameCode.toUpperCase());
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'lobby') return NextResponse.json({ error: 'Game has already started' }, { status: 400 });
  if (game.teams.length >= game.settings.maxTeams) {
    return NextResponse.json({ error: 'Game is full (max 6 teams)' }, { status: 400 });
  }

  const trimmedName = name.trim();
  if (game.teams.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
    return NextResponse.json({ error: 'That team name is already taken' }, { status: 400 });
  }

  const teamId = generateToken(16);
  const teamToken = generateToken(40);
  const color = getTeamColor(game.teams.length);

  game.teams.push({
    id: teamId,
    token: teamToken,
    name: trimmedName,
    color,
    tp: game.settings.startingTP,
    bribes: game.settings.startingBribes,
    eliminated: false,
    immune: false,
    tradePartners: [],
  });

  await saveGame(game);
  await saveTeamToken(teamToken, game.id, teamId);

  return NextResponse.json({ teamToken, teamId, teamName: trimmedName, color });
}
