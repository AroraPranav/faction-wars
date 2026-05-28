import { NextRequest, NextResponse } from 'next/server';
import { getGameByTeamToken, saveGame } from '@/lib/kv';
import { BribePower, BribeRequest } from '@/lib/types';
import { BRIBE_MENU } from '@/lib/utils';
import { generateToken } from '@/lib/utils';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { teamToken, power, targetTeamId, newAction } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const result = await getGameByTeamToken(teamToken);
  if (!result || result.game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { game, teamId } = result;

  if (game.status !== 'round_active') return NextResponse.json({ error: 'Bribes only allowed during active round' }, { status: 400 });

  const myTeam = game.teams.find(t => t.id === teamId);
  if (!myTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  if (myTeam.eliminated) return NextResponse.json({ error: 'Eliminated factions cannot bribe' }, { status: 400 });

  const menuItem = BRIBE_MENU.find(b => b.power === power);
  if (!menuItem) return NextResponse.json({ error: 'Invalid bribe power' }, { status: 400 });

  // Chaos Market: switch_action only available if event is active
  if (power === 'switch_action' && game.currentWorldEvent !== 'chaos_market' && game.currentWorldEvent !== null) {
    // switch_action bribe is always on the menu regardless of event
  }

  if (myTeam.bribes < menuItem.cost) {
    return NextResponse.json({ error: `Not enough bribe tokens (need ${menuItem.cost}, have ${myTeam.bribes})` }, { status: 400 });
  }

  // Validate target for bribes that need one
  const needsTarget: BribePower[] = ['learn_last_action', 'force_reveal', 'steal_token'];
  if (needsTarget.includes(power as BribePower) && !targetTeamId) {
    return NextResponse.json({ error: 'Target team required for this bribe' }, { status: 400 });
  }

  const bribeRequest: BribeRequest = {
    id: generateToken(12),
    teamId,
    power: power as BribePower,
    targetTeamId,
    newAction,
    cost: menuItem.cost,
    status: 'pending',
    createdAt: Date.now(),
  };

  // Deduct tokens immediately (refunded if rejected)
  const updatedTeams = game.teams.map(t =>
    t.id === teamId ? { ...t, bribes: t.bribes - menuItem.cost } : t
  );

  const updated = {
    ...game,
    teams: updatedTeams,
    currentBribes: [...game.currentBribes, bribeRequest],
  };

  await saveGame(updated);
  return NextResponse.json({ ok: true, bribeId: bribeRequest.id });
}
