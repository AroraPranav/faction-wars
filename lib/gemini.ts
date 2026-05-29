import { ResolvedRound, Team, ActionType } from './types';
import { getEvent } from './events';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(apiKey: string, prompt: string, temperature = 0.85): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1500,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

export async function generateRoundSummary(
  apiKey: string,
  round: ResolvedRound,
  teams: Team[]
): Promise<string> {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
  const eventDef = getEvent(round.worldEvent);
  const eventLine = round.worldEvent && round.worldEvent !== 'none'
    ? `World event in effect: ${eventDef.name}`
    : 'No world event this round.';

  const lines = round.log.map(l => '- ' + l.replace(/\*\*/g, '')).join('\n');

  const deltas = Object.entries(round.tpDeltas)
    .filter(([, d]) => d !== 0)
    .map(([id, d]) => `${teamMap[id] ?? id}: ${d > 0 ? '+' : ''}${d}`)
    .join(', ') || 'no TP changes';

  const standings = [...teams]
    .sort((a, b) => b.tp - a.tp)
    .map(t => `${t.name}: ${round.tpAfter[t.id] ?? t.tp} TP${t.eliminated ? ' (ELIMINATED)' : ''}`)
    .join(', ');

  const prompt = `You are a dramatic Bollywood-style war chronicler narrating Round ${round.roundNumber} of the strategic game "Faction Wars" to the players in their WhatsApp group. The audience is Hindi-speaking Indians — write the narration in **Hinglish** (natural casual mix of Hindi in Roman script + English, like how friends actually text). Tone: cinematic Bollywood war movie voiceover — drama, betrayal, suspense, mystery.

${eventLine}

Events that occurred this round (GM's internal log):
${lines}

(For your reference only — DO NOT list these numbers in your output. Players can see the scoreboard.)
TP changes: ${deltas}
Current standings: ${standings}

═══ CRITICAL STYLE RULES ═══

**PARTIAL REVEAL — this is the most important rule.** This game's strategy depends on bluffing and deduction. DO NOT freely reveal WHO attacked, sabotaged, or spied on whom. Reveal **outcomes**, not **intentions**. Hide attacker / saboteur / spy identities behind phrases like:
  • "kisi ne", "anjaan haathon se", "ek ghaat lagayi gayi", "raat ke andhere mein"
  • "ek saazish kaamyab hui", "kisi ki yojana tut gayi"
  • "khabar leak hui — par leak kisne ki, ye raaz hi rahega"

**When to name a team:**
- ✅ The VICTIM of an attack (they obviously know they got hit): "Team Alpha pe vaar hua"
- ✅ A SUCCESSFUL Trade between two teams (both consented openly — UNLESS the event is Silent Trade)
- ✅ ELIMINATED teams (it's public)
- ❌ The ATTACKER (don't say "Echo attacked Alpha" — say "kisi ne Alpha pe vaar kiya")
- ❌ The SABOTEUR (don't reveal who sabotaged whom)
- ❌ The SPY and their target (just hint that "saaye mein koi nazar rakh raha tha")
- ❌ A FAILED trade attempt's parties (hide the names — say "ek deal table par aayi par hath nahi mila")

**Other rules:**
1. Mix Hindi (Roman script) and English naturally — don't lean too heavy on either. Bollywood vocabulary welcome: "jang", "vaar", "dhokha", "sazish", "ghaat", "chaal", "talwar", "khoon", "raaz", "andhera", "saaya", "ant".
2. **DO NOT list TP changes mechanically.** Weave outcomes into the story.
3. End with one short hook sentence about the leader's position OR the gathering chaos — without naming exact TP values.
4. Plain flowing prose. No bullet points, no markdown, no asterisks. Under 140 words.
5. 4-6 sentences total.

Inspiration tone (style only — do NOT copy):
"Round ${round.roundNumber} ka pardafash hua. Maidan-e-jung mein Team Alpha pe ek anjaan vaar hua — par unki dhal mazboot nikli, vaar bekaar gaya. Udhar ek mez ke neeche se ghaat lagayi gayi, jiska shikar bhi maloom nahi pad raha. Saaye mein koi nazar rakh raha tha, par kis pe — ye raaz abhi sirf usi ke paas hai. Aaj koi gira nahi, par har team ek-doosre ko shakk ki nigah se dekh rahi hai. Chaal-baazi ki asli jung ab shuru hone wali hai."`;

  return callGemini(apiKey, prompt, 0.9);
}

export async function generateSpyIntel(
  apiKey: string,
  params: {
    spyName: string;
    targetName: string;
    targetAction: ActionType;
    targetTargetName?: string | null;
    targetIsAttackingSpy: boolean;
  }
): Promise<string> {
  const { spyName, targetName, targetAction, targetTargetName, targetIsAttackingSpy } = params;
  const prompt = `You are a noir-style informant in the strategic faction-warfare game "Faction Wars". The players are Hindi-speaking Indians — write the report in **Hinglish** (natural casual mix of Hindi in Roman script + English, like how friends actually text on WhatsApp). Bollywood spy-thriller tone — dramatic, but the facts must land clearly.

A spy from "${spyName}" infiltrated "${targetName}" and learned their plans for this round.

Target's plan: ${targetAction}${targetTargetName ? ` (directed at ${targetTargetName})` : ''}
${targetIsAttackingSpy ? `\n⚠ CRITICAL: ${targetName} is targeting ${spyName} themselves. Make this danger obvious — the spy needs to know they're the prey.` : ''}

Write a brief Hinglish intelligence report (2-3 sentences, max 60 words) addressed directly to ${spyName} (use "tum" / "aapki team"). Keep team names in English (they're configured names). State plainly WHO is doing WHAT to WHOM — no mysticism that hides the facts. Mix Hindi and English naturally; don't force either side. Plain prose only, no markdown, no asterisks.

Inspiration (don't copy): "Khabar pakki hai — ${targetName} chupke se ${spyName} pe vaar karne wala hai. Sambhal jao."`;

  return callGemini(apiKey, prompt, 0.85);
}
