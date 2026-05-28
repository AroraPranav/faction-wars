import { Redis } from '@upstash/redis';
import { Game } from './types';

const redis = Redis.fromEnv();

export async function getGame(gameCode: string): Promise<Game | null> {
  return redis.get<Game>(`game:${gameCode}`);
}

export async function saveGame(game: Game): Promise<void> {
  await redis.set(`game:${game.id}`, game, { ex: 172800 });
  await redis.set(`gm:${game.gmToken}`, game.id, { ex: 172800 });
}

export async function getGameByGmToken(gmToken: string): Promise<Game | null> {
  const gameCode = await redis.get<string>(`gm:${gmToken}`);
  if (!gameCode) return null;
  return getGame(gameCode);
}

export async function getGameByTeamToken(teamToken: string): Promise<{ game: Game; teamId: string } | null> {
  const data = await redis.get<{ gameCode: string; teamId: string }>(`team:${teamToken}`);
  if (!data) return null;
  const game = await getGame(data.gameCode);
  if (!game) return null;
  return { game, teamId: data.teamId };
}

export async function saveTeamToken(teamToken: string, gameCode: string, teamId: string): Promise<void> {
  await redis.set(`team:${teamToken}`, { gameCode, teamId }, { ex: 172800 });
}
