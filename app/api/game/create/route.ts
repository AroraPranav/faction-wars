import { NextRequest, NextResponse } from 'next/server';
import { Game } from '@/lib/types';
import { generateCode, generateToken, getTeamColor } from '@/lib/utils';
import { saveGame } from '@/lib/kv';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { maxRounds = 12, startingTP = 10, startingBribes = 5, geminiKey } = body;

  const gameCode = generateCode(6);
  const gmToken = generateToken(40);

  const game: Game = {
    id: gameCode,
    gmToken,
    status: 'lobby',
    settings: {
      maxRounds: Number(maxRounds),
      startingTP: Number(startingTP),
      startingBribes: Number(startingBribes),
      maxTeams: 6,
      geminiKey: geminiKey || undefined,
    },
    currentRound: 0,
    teams: [],
    currentActions: {},
    currentBribes: [],
    currentWorldEvent: null,
    currentShieldDome: undefined,
    currentDeclarations: {},
    roundHistory: [],
    undoStack: [],
    createdAt: Date.now(),
  };

  await saveGame(game);

  return NextResponse.json({ gameCode, gmToken });
}
