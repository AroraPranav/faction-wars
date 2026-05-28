import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';
import { resolveRound, applyResolution } from '@/lib/game-engine';
import { generateRoundSummary } from '@/lib/gemini';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, useGemini = false } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (game.status !== 'round_active') return NextResponse.json({ error: 'Round is not active' }, { status: 400 });

  const result = resolveRound(game);

  let geminiSummary: string | undefined;
  if (useGemini && game.settings.geminiKey) {
    try {
      // Build a preview of the resolved round for Gemini
      const previewRound = {
        roundNumber: game.currentRound,
        worldEvent: game.currentWorldEvent,
        shieldDomeFaction: game.currentShieldDome,
        actions: game.currentActions,
        bribeRequests: game.currentBribes,
        tpBefore: Object.fromEntries(game.teams.map(t => [t.id, t.tp])),
        tpAfter: Object.fromEntries(
          game.teams.map(t => [t.id, t.tp + (result.tpDeltas[t.id] ?? 0)])
        ),
        tpDeltas: result.tpDeltas,
        spyResults: result.spyResults,
        log: result.log,
        resolvedAt: Date.now(),
      };
      geminiSummary = await generateRoundSummary(game.settings.geminiKey, previewRound, game.teams);
    } catch (e) {
      console.error('Gemini error:', e);
      geminiSummary = undefined;
    }
  }

  const updatedGame = applyResolution(game, result, geminiSummary);
  await saveGame(updatedGame);

  const lastRound = updatedGame.roundHistory[updatedGame.roundHistory.length - 1];
  return NextResponse.json({
    ok: true,
    tpDeltas: result.tpDeltas,
    log: result.log,
    spyResults: result.spyResults,
    eliminatedTeamIds: result.eliminatedTeamIds,
    geminiSummary,
    status: updatedGame.status,
    round: lastRound,
  });
}
