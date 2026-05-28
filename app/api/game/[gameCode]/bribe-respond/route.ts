import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, bribeId, approve } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brideIdx = game.currentBribes.findIndex(b => b.id === bribeId);
  if (brideIdx === -1) return NextResponse.json({ error: 'Bribe not found' }, { status: 404 });

  const bribe = game.currentBribes[brideIdx];
  if (bribe.status !== 'pending') return NextResponse.json({ error: 'Bribe already resolved' }, { status: 400 });

  const updatedBribes = [...game.currentBribes];
  updatedBribes[brideIdx] = { ...bribe, status: approve ? 'approved' : 'rejected' };

  let updatedTeams = [...game.teams];

  if (!approve) {
    // Refund tokens
    updatedTeams = updatedTeams.map(t =>
      t.id === bribe.teamId ? { ...t, bribes: t.bribes + bribe.cost } : t
    );
  } else {
    // Apply immediate bribe effects
    if (bribe.power === 'steal_token' && bribe.targetTeamId) {
      // Steal 1 token from target (cannot reduce below 0)
      const target = updatedTeams.find(t => t.id === bribe.targetTeamId);
      if (target && target.bribes > 0) {
        updatedTeams = updatedTeams.map(t => {
          if (t.id === bribe.targetTeamId) return { ...t, bribes: t.bribes - 1 };
          if (t.id === bribe.teamId) return { ...t, bribes: t.bribes + 1 };
          return t;
        });
      }
    }

    if (bribe.power === 'switch_action' && bribe.newAction) {
      // Update the team's submitted action to the new one
      // (Target/target2 cleared — GM should note team needs to resubmit target via dashboard)
      const currentAction = game.currentActions[bribe.teamId];
      const updatedActions = {
        ...game.currentActions,
        [bribe.teamId]: {
          ...currentAction,
          type: bribe.newAction,
          target: currentAction?.target,
          submittedAt: Date.now(),
        },
      };
      const updated = {
        ...game,
        teams: updatedTeams,
        currentBribes: updatedBribes,
        currentActions: updatedActions,
      };
      await saveGame(updated);
      return NextResponse.json({ ok: true, approved: approve });
    }

    if (bribe.power === 'immunity') {
      // Will be applied after round resolution in game-engine
      // Flag is set in applyResolution
    }
  }

  const updated = {
    ...game,
    teams: updatedTeams,
    currentBribes: updatedBribes,
  };

  await saveGame(updated);
  return NextResponse.json({ ok: true, approved: approve });
}
