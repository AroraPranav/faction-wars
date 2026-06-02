import { NextRequest, NextResponse } from 'next/server';
import { getGame, getGameByGmToken, getGameByTeamToken } from '@/lib/kv';
import { ActionType, TeamGameState } from '@/lib/types';

// GM state — returns everything
export async function GET(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { searchParams } = new URL(req.url);
  const gmToken = searchParams.get('gmToken');
  const teamToken = searchParams.get('teamToken');
  const gameCode = params.gameCode.toUpperCase();

  if (gmToken) {
    const game = await getGameByGmToken(gmToken);
    if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(game);
  }

  if (teamToken) {
    const result = await getGameByTeamToken(teamToken);
    if (!result || result.game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { game, teamId } = result;
    const myTeam = game.teams.find(t => t.id === teamId);
    if (!myTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const lastRound = game.roundHistory[game.roundHistory.length - 1];
    const spyIntelRaw = lastRound?.spyResults.find(r => r.spyTeamId === teamId);
    const spyIntel = spyIntelRaw ? {
      spyTeamId: spyIntelRaw.spyTeamId,
      targetTeamId: spyIntelRaw.targetTeamId,
      actionType: spyIntelRaw.actionType,
      actionTarget: spyIntelRaw.actionTarget,
      counterspy: spyIntelRaw.counterspy,
      counterIntel: spyIntelRaw.counterIntel,
    } : undefined;
    const spyIntelNarration = spyIntelRaw?.narration;
    const counterspyInfo = lastRound?.spyResults
      .filter(r => r.counterspy && r.targetTeamId === teamId)
      .map(r => ({ spiedByTeamId: r.spyTeamId, spiedByTeamName: game.teams.find(t => t.id === r.spyTeamId)?.name ?? r.spyTeamId }))[0] ?? null;
    const counterIntelInfo = lastRound?.spyResults.some(r => r.counterIntel && r.targetTeamId === teamId) ?? false;

    // Exposed Plans: show all actions — but only after this team has submitted their own,
    // so they cannot peek at others' plans before committing.
    const exposedActions =
      game.currentWorldEvent === 'exposed_plans' &&
      (game.status === 'round_active' || game.status === 'round_locked') &&
      !!game.currentActions[teamId]
        ? game.currentActions
        : undefined;

    // Force-reveal intel — delivered only to the team that paid for it, during the round.
    // Read the target's action LIVE so the buyer sees it regardless of whether the target
    // had submitted when the GM approved (and tracks any later switch). Falls back to the
    // snapshot taken at approval if the target's live action is somehow missing.
    const forceRevealResults =
      (game.status === 'round_active' || game.status === 'round_locked')
        ? game.currentBribes
            .filter(b => b.teamId === teamId && b.power === 'force_reveal' && b.status === 'approved' && b.targetTeamId)
            .map((b): { targetTeamId: string; actionType: ActionType; actionTarget?: string } | null => {
              const action = game.currentActions[b.targetTeamId!] ?? b.revealedAction;
              return action
                ? { targetTeamId: b.targetTeamId!, actionType: action.type, actionTarget: action.target }
                : null;
            })
            .filter((r): r is { targetTeamId: string; actionType: ActionType; actionTarget?: string } => r !== null)
        : undefined;

    const response: TeamGameState = {
      status: game.status,
      currentRound: game.currentRound,
      maxRounds: game.settings.maxRounds,
      worldEvent: game.currentWorldEvent,
      teams: game.teams.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        tp: game.pointsVisible ? t.tp : 0,
        bribes: t.bribes,
        eliminated: t.eliminated,
        isTradePartner: myTeam.tradePartners.includes(t.id),
      })),
      myTeam: {
        id: myTeam.id,
        name: myTeam.name,
        color: myTeam.color,
        tp: game.pointsVisible ? myTeam.tp : 0,
        bribes: myTeam.bribes,
        immune: myTeam.immune,
        tradePartners: myTeam.tradePartners,
      },
      submittedTeamIds: Object.keys(game.currentActions),
      declarations: game.currentDeclarations,
      hasSubmitted: !!game.currentActions[teamId],
      spyIntel: game.status === 'round_resolved' ? spyIntel : undefined,
      spyIntelNarration: game.status === 'round_resolved' ? spyIntelNarration : undefined,
      lastRoundLog: game.status === 'round_resolved' ? lastRound?.log : undefined,
      lastRoundDeltas: game.status === 'round_resolved' && game.pointsVisible ? lastRound?.tpDeltas : undefined,
      exposedActions,
      counterspyInfo: game.status === 'round_resolved' ? counterspyInfo : null,
      counterIntelInfo: game.status === 'round_resolved' ? counterIntelInfo : false,
      pointsVisible: game.pointsVisible,
      forceRevealResults: forceRevealResults && forceRevealResults.length > 0 ? forceRevealResults : undefined,
    };

    return NextResponse.json(response);
  }

  return NextResponse.json({ error: 'Missing token' }, { status: 400 });
}
