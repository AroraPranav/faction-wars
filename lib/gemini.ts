import { ResolvedRound, Team, ActionType } from './types';
import { getEvent } from './events';
import { TOKEN_LEDGER_PREFIX } from './game-engine';

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

  // Drop GM-only token-ledger lines so the narration never leaks who bribed for what.
  const lines = round.log
    .filter(l => !l.startsWith(TOKEN_LEDGER_PREFIX))
    .map(l => '- ' + l.replace(/\*\*/g, ''))
    .join('\n');

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

**TOTAL ANONYMITY — this is the single most important rule.** This game lives or dies on bluffing and deduction. The narration is a riddle, NOT a report. When a player reads it, they must NOT be able to tell whether a described event happened to THEM, to a rival, or to nobody in particular. Keep EVERY team guessing.

**NAME NO ONE — neither attacker, victim, saboteur, spy, nor target.** Do not name a team for any attack, sabotage, spy, failed trade, defend, or reinforce. Refer to all parties only through anonymous, atmospheric phrasing so that even the team it happened to is left wondering "wait… was that me?":
  • actors: "kisi ne", "anjaan haathon se", "ek chhupa hua khiladi", "parde ke peeche se"
  • events: "ek vaar hua", "ek ghaat lagayi gayi", "ek saazish kaamyab hui", "kisi ki dhal kaam aayi", "ek yojana tut gayi", "saaye mein koi nazar rakh raha tha"
  • Speak in counts and rumors, never identities: "do vaar hue, dono ka anjaam alag", "kahin khabar leak hui — par kiski, kisne, ye raaz hai".

**The ONLY exceptions where a team may be named:**
- ✅ A SUCCESSFUL Trade between two teams (both consented openly — UNLESS the event is Silent Trade, then stay anonymous).
- ✅ ELIMINATED teams (it's public).
Everything else stays nameless — including who got attacked. Describe the BLOW landing in the dark, never whose door it knocked on.

**Other rules:**
1. Mix Hindi (Roman script) and English naturally — don't lean too heavy on either. Bollywood vocabulary welcome: "jang", "vaar", "dhokha", "sazish", "ghaat", "chaal", "talwar", "khoon", "raaz", "andhera", "saaya", "ant".
2. **DO NOT list TP changes mechanically.** Weave outcomes into the story as rumor and consequence, never as a scoreboard.
3. Keep numbers vague — "kuch teams kamzor padi", not "Alpha lost 2".
4. End with one short hook sentence about the gathering suspicion or chaos — without naming who leads or exact TP values.
5. Plain flowing prose. No bullet points, no markdown, no asterisks. Under 140 words.
6. 4-6 sentences total.

Inspiration tone (style only — do NOT copy, and note how NO team is named):
"Round ${round.roundNumber} ki raat khaamosh nahi rahi. Andhere mein ek vaar chala — kis par, ye sirf shikaar aur shikari jaante hain. Ek mez ke neeche se ghaat lagayi gayi, par jiska nuksaan hua woh bhi shayad samajh na paaye ki ye kiska kaam tha. Kahin ek dhal mazboot nikli, kahin ek yojana bikhar gayi. Saaye mein nazar rakhi gayi — par kis pe, ye raaz parde ke peeche hi dafan hai. Aaj har koi apne padosi ko shakk ki nigah se dekh raha hai."`;

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
