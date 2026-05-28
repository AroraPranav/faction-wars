import { Game, Team, Action, ActionType, SpyResult, ResolvedRound } from './types';

interface ResolutionResult {
  tpDeltas: Record<string, number>;
  spyResults: SpyResult[];
  log: string[];
  eliminatedTeamIds: string[];
  newTradePartners: Record<string, string[]>;
}

export function resolveRound(game: Game): ResolutionResult {
  const { teams, currentActions, currentWorldEvent, currentShieldDome, currentBribes } = game;

  const tpDeltas: Record<string, number> = {};
  const spyResults: SpyResult[] = [];
  const log: string[] = [];
  const newTradePartners: Record<string, string[]> = {};

  const activeTeams = teams.filter(t => !t.eliminated);

  // Initialize deltas and trade partners
  for (const t of activeTeams) {
    tpDeltas[t.id] = 0;
    newTradePartners[t.id] = [];
  }

  const getTeam = (id: string): Team | undefined => teams.find(t => t.id === id);
  const getAction = (teamId: string): Action | null => currentActions[teamId] ?? null;
  const name = (id: string) => getTeam(id)?.name ?? id;

  // Is this team fully immune this round?
  // Immunity sources: Shield Dome event OR 5-token bribe from last round
  const isImmune = (teamId: string): boolean => {
    const team = getTeam(teamId);
    if (!team) return false;
    if (team.immune) return true;
    if (currentWorldEvent === 'shield_dome' && currentShieldDome === teamId) return true;
    return false;
  };

  // Does this team's Defend action work?
  const defendsEffectively = (teamId: string): boolean => {
    if (currentWorldEvent === 'defenseless') return false; // Defenseless nullifies Defend
    if (isImmune(teamId)) return false; // Immune team doesn't need to defend
    return getAction(teamId)?.type === 'defend';
  };

  // Is this team's action sabotage-blocked via bribe?
  const hasBribeSabotageBlock = (teamId: string): boolean =>
    currentBribes.some(b => b.teamId === teamId && b.power === 'block_sabotage' && b.status === 'approved');

  // ── STEP 1: SPY ──────────────────────────────────────────────────────────────
  if (currentWorldEvent === 'fog_of_war') {
    log.push('🌫️ [Fog of War] All Spy actions are blind this round — no intel gathered.');
  } else {
    for (const team of activeTeams) {
      const action = getAction(team.id);
      if (!action || action.type !== 'spy' || !action.target) continue;
      if (isImmune(team.id)) continue; // immune team's own actions still fire unless they're the spy... actually, immune just means they can't be targeted. Let them spy.

      const targetTeam = getTeam(action.target);
      if (!targetTeam || targetTeam.eliminated) continue;

      const targetAction = getAction(action.target);
      if (!targetAction) continue;

      const result: SpyResult = {
        spyTeamId: team.id,
        targetTeamId: action.target,
        actionType: targetAction.type,
        actionTarget: targetAction.target,
      };

      if (currentWorldEvent === 'counter_intel') {
        result.counterIntel = true;
      }
      if (currentWorldEvent === 'counterspy') {
        result.counterspy = true;
      }

      spyResults.push(result);
      log.push(`🕵️ ${name(team.id)} spied on ${name(action.target)} — intel gathered.`);

      if (currentWorldEvent === 'counter_intel') {
        log.push(`🕵️ [Counter Intel] ${name(action.target)} was notified they were spied on (identity hidden).`);
      }
      if (currentWorldEvent === 'counterspy') {
        log.push(`🔍 [Counterspy] ${name(action.target)} learned that ${name(team.id)} was spying on them.`);
      }
    }
  }

  // ── STEP 2: DETERMINE WHICH SABOTAGES LAND ───────────────────────────────────
  // Note: "If you are Sabotaged yourself, your Sabotage is NOT cancelled" (Sabotage is defensive-neutral)
  const sabotageTargets = new Set<string>(); // teamIds whose primary action is cancelled

  for (const team of activeTeams) {
    const action = getAction(team.id);
    if (!action || action.type !== 'sabotage' || !action.target) continue;

    const targetId = action.target;
    const targetTeam = getTeam(targetId);
    if (!targetTeam || targetTeam.eliminated) continue;

    if (isImmune(targetId)) {
      log.push(`💥 ${name(team.id)} tried to Sabotage ${name(targetId)}, but they are immune.`);
      continue;
    }

    if (hasBribeSabotageBlock(targetId)) {
      log.push(`💥 ${name(team.id)} tried to Sabotage ${name(targetId)}, but their bribe blocked it.`);
      continue;
    }

    if (defendsEffectively(targetId)) {
      // Sabotage blocked by Defend
      log.push(`🛡️ ${name(team.id)} tried to Sabotage ${name(targetId)}, but they Defended.`);

      if (currentWorldEvent === 'saboteurs_echo') {
        tpDeltas[team.id] += 1;
        tpDeltas[targetId] -= 1;
        log.push(`🔊 [Saboteur's Echo] ${name(team.id)} still stole 1 TP from ${name(targetId)}.`);
      }
      continue;
    }

    // Sabotage lands
    const targetAction = getAction(targetId);
    if (targetAction && (targetAction.type === 'attack' || targetAction.type === 'trade')) {
      sabotageTargets.add(targetId);
      log.push(`💣 ${name(team.id)} Sabotaged ${name(targetId)}! Their ${targetAction.type.toUpperCase()} is cancelled.`);
    } else {
      // Sabotage on Defend or Spy — no special mechanical effect
      log.push(`💣 ${name(team.id)} Sabotaged ${name(targetId)} (no critical action to cancel).`);
    }

    if (currentWorldEvent === 'double_trouble') {
      tpDeltas[team.id] += 1;
      tpDeltas[targetId] -= 1;
      log.push(`💣 [Double Trouble] ${name(team.id)} also stole 1 TP from ${name(targetId)}.`);
    }
  }

  // ── STEP 3: TRADE ────────────────────────────────────────────────────────────
  const processedTradePairs = new Set<string>();

  for (const team of activeTeams) {
    const action = getAction(team.id);
    if (!action || action.type !== 'trade' || !action.target) continue;
    if (isImmune(team.id)) continue; // immune team's outgoing trade still works
    if (sabotageTargets.has(team.id)) {
      // Will be logged when we check the pair
      continue;
    }

    const targetId = action.target;
    const targetTeam = getTeam(targetId);
    if (!targetTeam || targetTeam.eliminated) continue;

    const targetAction = getAction(targetId);
    // Both must target each other
    if (!targetAction || targetAction.type !== 'trade' || targetAction.target !== team.id) continue;

    // Avoid processing the same pair twice
    const pairKey = [team.id, targetId].sort().join('|');
    if (processedTradePairs.has(pairKey)) continue;
    processedTradePairs.add(pairKey);

    if (sabotageTargets.has(team.id) || sabotageTargets.has(targetId)) {
      log.push(`🚫 Trade between ${name(team.id)} and ${name(targetId)} was cancelled by Sabotage.`);
      continue;
    }

    const tradeGain = currentWorldEvent === 'economic_boom' ? 2 : 1;
    tpDeltas[team.id] += tradeGain;
    tpDeltas[targetId] += tradeGain;

    // Record trade partners for next round protection
    newTradePartners[team.id].push(targetId);
    newTradePartners[targetId].push(team.id);

    const boomNote = currentWorldEvent === 'economic_boom' ? ' [Economic Boom: +2 each!]' : '';
    const silentNote = currentWorldEvent === 'silent_trade' ? ' [Silent Trade]' : '';
    log.push(`🤝 ${name(team.id)} and ${name(targetId)} traded successfully! (+${tradeGain} TP each)${boomNote}${silentNote}`);
  }

  // ── STEP 4: ATTACK ───────────────────────────────────────────────────────────
  for (const team of activeTeams) {
    const action = getAction(team.id);
    if (!action || action.type !== 'attack') continue;

    if (sabotageTargets.has(team.id)) {
      log.push(`🚫 ${name(team.id)}'s Attack was cancelled by Sabotage.`);
      continue;
    }

    const targets: string[] = [];
    if (action.target) targets.push(action.target);
    if (currentWorldEvent === 'double_attack' && action.target2) targets.push(action.target2);

    for (const targetId of targets) {
      if (targetId === team.id) continue;
      const targetTeam = getTeam(targetId);
      if (!targetTeam || targetTeam.eliminated) continue;

      // Trade protection: cannot attack last round's trade partner
      if (team.tradePartners.includes(targetId)) {
        log.push(`🛡️ ${name(team.id)} cannot attack ${name(targetId)} — Trade Protection is in effect.`);
        continue;
      }

      if (isImmune(targetId)) {
        log.push(`🔵 ${name(team.id)} attacked ${name(targetId)}, but they are immune this round.`);
        continue;
      }

      if (defendsEffectively(targetId)) {
        log.push(`🛡️ ${name(team.id)} attacked ${name(targetId)}, but they Defended successfully.`);
        if (currentWorldEvent === 'reverse_strike') {
          tpDeltas[team.id] -= 1;
          log.push(`⚔️ [Reverse Strike] ${name(team.id)} lost 1 TP for attacking a Defender.`);
        }
        continue;
      }

      // Successful attack
      tpDeltas[team.id] += 2;
      tpDeltas[targetId] -= 2;
      log.push(`⚔️ ${name(team.id)} attacked ${name(targetId)}! (+2 TP / −2 TP)`);
    }
  }

  // ── STEP 5: WORLD EVENT BONUSES ──────────────────────────────────────────────

  // Fortify: +1 to every team that Defended
  if (currentWorldEvent === 'fortify') {
    for (const team of activeTeams) {
      if (isImmune(team.id)) continue;
      if (getAction(team.id)?.type === 'defend') {
        tpDeltas[team.id] += 1;
        log.push(`🏰 [Fortify] ${name(team.id)} gained +1 TP for Defending.`);
      }
    }
  }

  // Sudden Reinforcements: +3 to faction(s) with current lowest TP (pre-delta)
  if (currentWorldEvent === 'sudden_reinforcements') {
    const tps = activeTeams.map(t => t.tp);
    const minTP = Math.min(...tps);
    for (const team of activeTeams) {
      if (team.tp === minTP) {
        tpDeltas[team.id] += 3;
        log.push(`🪖 [Sudden Reinforcements] ${name(team.id)} received +3 TP (lowest TP faction).`);
      }
    }
  }

  // Power Vacuum: leader loses 2, all others gain 1 (based on pre-delta TP)
  if (currentWorldEvent === 'power_vacuum') {
    const maxTP = Math.max(...activeTeams.map(t => t.tp));
    const leaders = activeTeams.filter(t => t.tp === maxTP);
    for (const leader of leaders) {
      tpDeltas[leader.id] -= 2;
      log.push(`👑 [Power Vacuum] ${name(leader.id)} (leader) lost 2 TP.`);
    }
    for (const team of activeTeams) {
      if (!leaders.find(l => l.id === team.id) && !isImmune(team.id)) {
        tpDeltas[team.id] += 1;
        log.push(`👑 [Power Vacuum] ${name(team.id)} gained +1 TP.`);
      }
    }
  }

  // ── STEP 6: APPLY APPROVED BRIBE EFFECTS ─────────────────────────────────────
  for (const bribe of currentBribes.filter(b => b.status === 'approved')) {
    if (bribe.power === 'steal_token') {
      // Token transfer handled separately in bribe-respond route
    }
    if (bribe.power === 'immunity') {
      // Immunity is flagged for NEXT round when bribe is approved
    }
    // Other effects (switch_action, block_sabotage, force_reveal, learn_last_action)
    // are handled at approval time or during the steps above
  }

  // ── STEP 7: SUDDEN DEATH ELIMINATION ─────────────────────────────────────────
  const eliminatedTeamIds: string[] = [];
  if (currentWorldEvent === 'sudden_death') {
    for (const team of activeTeams) {
      const finalTP = team.tp + tpDeltas[team.id];
      if (finalTP <= 0) {
        eliminatedTeamIds.push(team.id);
        log.push(`💀 [Sudden Death] ${name(team.id)} has been ELIMINATED! (TP: ${team.tp} → ${finalTP})`);
      }
    }
  }

  return { tpDeltas, spyResults, log, eliminatedTeamIds, newTradePartners };
}

export function applyResolution(game: Game, result: ResolutionResult, geminiSummary?: string): Game {
  const { tpDeltas, spyResults, log, eliminatedTeamIds, newTradePartners } = result;

  // Snapshot current state for undo (before applying)
  const snapshot = JSON.stringify(game);
  const undoStack = [...(game.undoStack ?? []), snapshot].slice(-5);

  const tpBefore: Record<string, number> = {};
  const tpAfter: Record<string, number> = {};

  const updatedTeams = game.teams.map(team => {
    tpBefore[team.id] = team.tp;
    const delta = tpDeltas[team.id] ?? 0;
    const newTP = team.tp + delta;
    tpAfter[team.id] = newTP;

    return {
      ...team,
      tp: newTP,
      eliminated: team.eliminated || eliminatedTeamIds.includes(team.id),
      immune: false, // reset immunity after use
      tradePartners: newTradePartners[team.id] ?? [],
    };
  });

  // Apply immunity bribe for NEXT round
  const immunityBribes = game.currentBribes.filter(b => b.power === 'immunity' && b.status === 'approved');
  for (const bribe of immunityBribes) {
    const teamIdx = updatedTeams.findIndex(t => t.id === bribe.teamId);
    if (teamIdx >= 0) updatedTeams[teamIdx].immune = true;
  }

  const resolvedRound: ResolvedRound = {
    roundNumber: game.currentRound,
    worldEvent: game.currentWorldEvent,
    shieldDomeFaction: game.currentShieldDome,
    actions: { ...game.currentActions },
    bribeRequests: [...game.currentBribes],
    tpBefore,
    tpAfter,
    tpDeltas,
    spyResults,
    log,
    geminiSummary,
    resolvedAt: Date.now(),
  };

  const maxRoundsReached = game.currentRound >= game.settings.maxRounds;
  const activeCount = updatedTeams.filter(t => !t.eliminated).length;
  const finished = maxRoundsReached || activeCount <= 1;

  return {
    ...game,
    status: finished ? 'finished' : 'round_resolved',
    teams: updatedTeams,
    roundHistory: [...game.roundHistory, resolvedRound],
    currentActions: {},
    currentBribes: [],
    currentDeclarations: {},
    undoStack,
  };
}

export function undoRound(game: Game): Game | null {
  if (!game.undoStack || game.undoStack.length === 0) return null;
  const previous = game.undoStack[game.undoStack.length - 1];
  const restored = JSON.parse(previous) as Game;
  restored.undoStack = game.undoStack.slice(0, -1);
  return restored;
}
