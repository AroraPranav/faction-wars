import { kv } from '@vercel/kv';
import { Game } from './types';

export async function getGame(gameCode: string): Promise<Game | null> {
  const data = await kv.get<Game>(`game:${gameCode}`);
  return data ?? null;
}

export async function saveGame(game: Game): Promise<void> {
  // Store game, expire after 48 hours
  await kv.set(`game:${game.id}`, game, { ex: 172800 });
  await kv.set(`gm:${game.gmToken}`, game.id, { ex: 172800 });
}

export async function getGameByGmToken(gmToken: string): Promise<Game | null> {
  const gameCode = await kv.get<string>(`gm:${gmToken}`);
  if (!gameCode) return null;
  return getGame(gameCode);
}

export async function getGameByTeamToken(teamToken: string): Promise<{ game: Game; teamId: string } | null> {
  const data = await kv.get<{ gameCode: string; teamId: string }>(`team:${teamToken}`);
  if (!data) return null;
  const game = await getGame(data.gameCode);
  if (!game) return null;
  return { game, teamId: data.teamId };
}

export async function saveTeamToken(teamToken: string, gameCode: string, teamId: string): Promise<void> {
  await kv.set(`team:${teamToken}`, { gameCode, teamId }, { ex: 172800 });
}
