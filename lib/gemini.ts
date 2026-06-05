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

  const prompt = `You are a dramatic Bollywood-style war chronicler narrating Round ${round.roundNumber} of the strategic game "Faction Wars" to the players in their WhatsApp group. The audience is Hindi-speaking Indians — write the narration in **Hinglish** (natural casual mix of Hindi in Roman script + English, like how friends actually text). Tone: cinematic Bollywood war movie voiceover with a masaledaar comedic kick — drama, betrayal, suspense, AND laughs. Think Sholay narrator who's also a little bit nautanki. Roast the chaos, don't just whisper about it.

${eventLine}

Events that occurred this round (GM's internal log):
${lines}

(For your reference only — DO NOT list these numbers in your output. Players can see the scoreboard.)
TP changes: ${deltas}
Current standings: ${standings}

═══ CRITICAL STYLE RULES ═══

**ANONYMITY OF IDENTITY, NOT OF EVENTS — this is the single most important rule.** This game lives or dies on bluffing and deduction. Hide WHO did it and WHO got hit — never hide THAT it happened. Every event in the GM log is REAL and must land as a concrete, vivid, consequential blow. Do NOT water events into "maybe something happened to maybe someone" mush — that's boring and toothless. The reader should feel the punch land hard in the dark, fully convinced it was brutal and real, while still unable to tell if the victim was THEM or a rival. Keep every team guessing about identity, never about whether the carnage occurred.

**NAME NO ONE — neither attacker, victim, saboteur, spy, nor target.** Do not name a team for any attack, sabotage, spy, failed trade, or defend. Refer to all parties only through anonymous, atmospheric phrasing so that even the team it happened to is left wondering "wait… was that me?":
  • actors: "kisi ne", "anjaan haathon se", "ek chhupa hua khiladi", "parde ke peeche se"
  • events: "ek vaar seedha kaleje pe pada", "ek ghaat aisi lagi ki shikaar tadap gaya", "ek saazish poori tarah kaamyab hui", "ek dhal aakhri waqt pe kaam aa gayi", "ek yojana muh ke bal gir padi", "saaye mein ankhein gadi thi har chaal pe"
  • Speak in counts and consequences, never identities — but make the count and the damage VIVID and definite: "do vaar hue, ek ne haddi tod di, doosra apni hi talwar pe ja gira", "khabar leak hui — par kiski, kisne, ye gaddari ka maza alag hi tha".

**The ONLY exceptions where a team may be named:**
- ✅ A SUCCESSFUL Trade between two teams (both consented openly — UNLESS the event is Silent Trade, then stay anonymous).
- ✅ ELIMINATED teams (it's public).
Everything else stays nameless — including who got attacked. Describe the BLOW landing in the dark, never whose door it knocked on.

**Other rules:**
1. Mix Hindi (Roman script) and English naturally — don't lean too heavy on either. Bollywood vocabulary welcome: "jang", "vaar", "dhokha", "sazish", "ghaat", "chaal", "talwar", "khoon", "raaz", "andhera", "saaya", "ant".
2. **DO NOT list TP changes mechanically.** Weave outcomes into the story as rumor and consequence, never as a scoreboard.
3. Keep exact numbers hidden — but make the DAMAGE concrete and felt. "Ek team ki kamar tut gayi" beats "kuch hua". Never reveal exact TP or whose, but never pretend the hit was soft either.
4. **Bring the comedy.** At least one line should make the group laugh — a savage roast, a cocky plan that backfired hilariously, a "betrayer ne khud ka hi gala kaat liya" moment, a dramatic over-the-top metaphor that's clearly tongue-in-cheek. Drama + tamasha, not a funeral.
5. End with one punchy hook line about the brewing paranoia or chaos — make it sting and grin at the same time, without naming who leads or exact TP values.
6. Plain flowing prose. No bullet points, no markdown, no asterisks. Under 140 words.
7. 4-6 sentences total.

Inspiration tone (style only — do NOT copy; note how NO team is named, yet every event is concrete, brutal AND funny):
"Round ${round.roundNumber} ki raat ne kisi ko sona nahi diya. Andhere mein ek vaar aisa pada ki ek team abhi tak haddiyan gin rahi hogi — kis par? Bas shikaar aur shikari jaante hain, baaki sab apni-apni list bana rahe hain. Ek mahaan strategist ne badi soch ke chaal chali, aur seedha apne hi paer pe kulhaadi maar baitha — wah ustad, kya plan tha. Ek dhal aakhri second pe kaam aa gayi, warna aaj ek aur arthi uth jaati. Aur kahin saaye mein kisi ne sab kuch dekh liya — ab woh muskura raha hai, aur tum so nahi paoge. Bhaiyon, kisi pe bharosa mat karna, padosi sabse pehle gaddari karega."`;

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
