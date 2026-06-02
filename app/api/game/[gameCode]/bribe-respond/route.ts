import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';
import { ACTION_META } from '@/lib/utils';

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
    // Force reveal: snapshot the target's current action so the briber (and only the
    // briber) can see it immediately — works like a spy report, delivered on approval.
    if (bribe.power === 'force_reveal' && bribe.targetTeamId) {
      const targetAction = game.currentActions[bribe.targetTeamId];
      updatedBribes[brideIdx] = {
        ...updatedBribes[brideIdx],
        revealedAction: targetAction
          ? { type: targetAction.type, target: targetAction.target }
          : undefined,
      };
    }

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
      // Replace the team's submitted action with the switched-to action + its new target.
      // If the new action needs no target, drop any stale target so resolution stays correct.
      const needsTarget = ACTION_META[bribe.newAction]?.needsTarget;
      const updatedActions = {
        ...game.currentActions,
        [bribe.teamId]: {
          type: bribe.newAction,
          target: needsTarget ? bribe.newTarget : undefined,
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
