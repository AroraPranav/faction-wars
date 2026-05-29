import { NextRequest, NextResponse } from 'next/server';
import { getGameByTeamToken, saveGame } from '@/lib/kv';
import { ActionType } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { teamToken, action, target, target2 } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const result = await getGameByTeamToken(teamToken);
  if (!result || result.game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { game, teamId } = result;

  const myTeam = game.teams.find(t => t.id === teamId);
  if (!myTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  if (myTeam.eliminated) return NextResponse.json({ error: 'Your faction is eliminated' }, { status: 400 });
  if (game.status !== 'round_active') return NextResponse.json({ error: 'Round is not active' }, { status: 400 });

  const validActions: ActionType[] = ['attack', 'defend', 'spy', 'sabotage', 'trade', 'reinforce'];
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  // Actions that need a target
  const needsTarget = ['attack', 'spy', 'sabotage', 'trade'];
  if (needsTarget.includes(action) && !target) {
    return NextResponse.json({ error: 'Target is required for this action' }, { status: 400 });
  }

  // Validate target is a real, non-eliminated, non-self team
  if (target) {
    const targetTeam = game.teams.find(t => t.id === target);
    if (!targetTeam) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    if (targetTeam.eliminated) return NextResponse.json({ error: 'Target is eliminated' }, { status: 400 });
    if (target === teamId) return NextResponse.json({ error: 'Cannot target yourself' }, { status: 400 });

    // Trade protection: cannot attack a trade partner from last round
    if (action === 'attack' && myTeam.tradePartners.includes(target)) {
      return NextResponse.json({ error: 'Trade Protection: cannot attack a recent trade partner' }, { status: 400 });
    }
  }

  if (target2) {
    if (game.currentWorldEvent !== 'double_attack') {
      return NextResponse.json({ error: 'Double Attack not active' }, { status: 400 });
    }
    if (target2 === teamId || target2 === target) {
      return NextResponse.json({ error: 'Targets must be two different factions' }, { status: 400 });
    }
    const targetTeam2 = game.teams.find(t => t.id === target2);
    if (!targetTeam2 || targetTeam2.eliminated) {
      return NextResponse.json({ error: 'Invalid second target' }, { status: 400 });
    }
    if (action === 'attack' && myTeam.tradePartners.includes(target2)) {
      return NextResponse.json({ error: 'Trade Protection applies to second target too' }, { status: 400 });
    }
  }

  const updated = {
    ...game,
    currentActions: {
      ...game.currentActions,
      [teamId]: { type: action, target, target2, submittedAt: Date.now() },
    },
  };

  await saveGame(updated);
  return NextResponse.json({ ok: true });
}
