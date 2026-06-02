import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';
import { resolveRound, applyResolution } from '@/lib/game-engine';
import { generateRoundSummary, generateSpyIntel } from '@/lib/gemini';

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, useGemini = false } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Two-phase resolve: the GM must Lock Actions first. Resolution happens from the locked state.
  if (game.status !== 'round_locked') return NextResponse.json({ error: 'Lock actions before resolving the round' }, { status: 400 });

  const result = resolveRound(game);

  // Generate Hinglish spy intel narrations (best-effort)
  if (useGemini && game.settings.geminiKey && result.spyResults.length > 0) {
    await Promise.all(result.spyResults.map(async (sr) => {
      try {
        const spy = game.teams.find(t => t.id === sr.spyTeamId);
        const target = game.teams.find(t => t.id === sr.targetTeamId);
        if (!spy || !target) return;
        const targetTargetName = sr.actionTarget
          ? game.teams.find(t => t.id === sr.actionTarget)?.name ?? null
          : null;
        const targetIsAttackingSpy =
          (sr.actionType === 'attack' || sr.actionType === 'sabotage') && sr.actionTarget === spy.id;
        sr.narration = await generateSpyIntel(game.settings.geminiKey!, {
          spyName: spy.name,
          targetName: target.name,
          targetAction: sr.actionType,
          targetTargetName,
          targetIsAttackingSpy,
        });
      } catch (e) {
        console.error('Gemini spy intel error:', e);
      }
    }));
  }

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
