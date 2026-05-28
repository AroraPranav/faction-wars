import { GoogleGenerativeAI } from '@google/generative-ai';
import { ResolvedRound, Team } from './types';

export async function generateRoundSummary(
  apiKey: string,
  round: ResolvedRound,
  teams: Team[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const deltaLines = Object.entries(round.tpDeltas)
    .filter(([, delta]) => delta !== 0)
    .map(([id, delta]) => `  ${teamMap[id] ?? id}: ${delta > 0 ? '+' : ''}${delta} TP (now ${round.tpAfter[id]} TP)`)
    .join('\n');

  const logLines = round.log.join('\n');

  const prompt = `You are the dramatic narrator for "Faction Wars" — a multiplayer strategy game of diplomacy, deception, and calculated betrayal.

Write a short, dramatic, in-character summary (3-5 sentences) of this round's events. Use vivid language. Reference factions by name. Be theatrical and fun — this is a family game on vacation.

Round: ${round.roundNumber}
World Event: ${round.worldEvent ?? 'None'}
${round.worldEvent === 'shield_dome' && round.shieldDomeFaction ? `Shield Dome Faction: ${teamMap[round.shieldDomeFaction]}` : ''}

What happened:
${logLines || 'Nothing of significance occurred.'}

TP changes:
${deltaLines || 'No TP changes this round.'}

Write only the narrative summary. No headers. No bullet points. Just dramatic prose.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
