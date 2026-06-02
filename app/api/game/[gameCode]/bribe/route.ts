import { NextRequest, NextResponse } from 'next/server';
import { getGameByTeamToken, saveGame } from '@/lib/kv';
import { ActionType, BribePower, BribeRequest } from '@/lib/types';
import { ACTION_META, BRIBE_MENU } from '@/lib/utils';
import { generateToken } from '@/lib/utils';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { teamToken, power, targetTeamId, newAction, newTarget } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const result = await getGameByTeamToken(teamToken);
  if (!result || result.game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { game, teamId } = result;

  // Bribes are allowed during the active round and during the locked switch window.
  if (game.status !== 'round_active' && game.status !== 'round_locked') {
    return NextResponse.json({ error: 'Bribes only allowed during an active or locked round' }, { status: 400 });
  }

  const myTeam = game.teams.find(t => t.id === teamId);
  if (!myTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  if (myTeam.eliminated) return NextResponse.json({ error: 'Eliminated factions cannot bribe' }, { status: 400 });

  const menuItem = BRIBE_MENU.find(b => b.power === power);
  if (!menuItem) return NextResponse.json({ error: 'Invalid bribe power' }, { status: 400 });

  // Chaos Market: the "switch your action" bribe is only available when Chaos Market is the
  // active event. It works in both the active round and the locked switch window — once a team
  // has submitted, switching is the only way to change their action.
  if (power === 'switch_action' && game.currentWorldEvent !== 'chaos_market') {
    return NextResponse.json({ error: 'Switching actions is only allowed during the Chaos Market event' }, { status: 400 });
  }

  if (myTeam.bribes < menuItem.cost) {
    return NextResponse.json({ error: `Not enough bribe tokens (need ${menuItem.cost}, have ${myTeam.bribes})` }, { status: 400 });
  }

  // Validate target for bribes that need one
  const needsTarget: BribePower[] = ['learn_last_action', 'force_reveal', 'steal_token'];
  if (needsTarget.includes(power as BribePower) && !targetTeamId) {
    return NextResponse.json({ error: 'Target team required for this bribe' }, { status: 400 });
  }

  // Validate switch_action payload — must name a new action, and a new target if that action needs one.
  if (power === 'switch_action') {
    if (!game.currentActions[teamId]) {
      return NextResponse.json({ error: 'You must submit an action before switching it' }, { status: 400 });
    }
    if (!newAction || !ACTION_META[newAction]) {
      return NextResponse.json({ error: 'Choose a valid action to switch to' }, { status: 400 });
    }
    if (ACTION_META[newAction].needsTarget && !newTarget) {
      return NextResponse.json({ error: 'The action you are switching to requires a target' }, { status: 400 });
    }
    if (newTarget && newTarget === teamId) {
      return NextResponse.json({ error: 'Cannot target yourself' }, { status: 400 });
    }
  }

  const bribeRequest: BribeRequest = {
    id: generateToken(12),
    teamId,
    power: power as BribePower,
    targetTeamId,
    newAction: power === 'switch_action' ? (newAction as ActionType) : undefined,
    newTarget: power === 'switch_action' && newTarget ? newTarget : undefined,
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
