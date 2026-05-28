import { NextRequest, NextResponse } from 'next/server';
import { getGame, getGameByGmToken, getGameByTeamToken } from '@/lib/kv';
import { TeamGameState } from '@/lib/types';

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
    const spyIntel = lastRound?.spyResults.find(r => r.spyTeamId === teamId);
    const counterspyInfo = lastRound?.spyResults
      .filter(r => r.counterspy && r.targetTeamId === teamId)
      .map(r => ({ spiedByTeamId: r.spyTeamId, spiedByTeamName: game.teams.find(t => t.id === r.spyTeamId)?.name ?? r.spyTeamId }))[0] ?? null;
    const counterIntelInfo = lastRound?.spyResults.some(r => r.counterIntel && r.targetTeamId === teamId) ?? false;

    // Exposed Plans: show all actions
    const exposedActions =
      game.currentWorldEvent === 'exposed_plans' && game.status === 'round_active'
        ? game.currentActions
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
        tp: t.tp,
        bribes: t.bribes,
        eliminated: t.eliminated,
        isTradePartner: myTeam.tradePartners.includes(t.id),
      })),
      myTeam: {
        id: myTeam.id,
        name: myTeam.name,
        color: myTeam.color,
        tp: myTeam.tp,
        bribes: myTeam.bribes,
        immune: myTeam.immune,
        tradePartners: myTeam.tradePartners,
      },
      submittedTeamIds: Object.keys(game.currentActions),
      declarations: game.currentDeclarations,
      hasSubmitted: !!game.currentActions[teamId],
      spyIntel: game.status === 'round_resolved' ? spyIntel : undefined,
      lastRoundLog: game.status === 'round_resolved' ? lastRound?.log : undefined,
      lastRoundDeltas: game.status === 'round_resolved' ? lastRound?.tpDeltas : undefined,
      exposedActions,
      counterspyInfo: game.status === 'round_resolved' ? counterspyInfo : null,
      counterIntelInfo: game.status === 'round_resolved' ? counterIntelInfo : false,
    };

    return NextResponse.json(response);
  }

  return NextResponse.json({ error: 'Missing token' }, { status: 400 });
}
