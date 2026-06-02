'use client';
import { useEffect, useState, useCallback } from 'react';
import { TeamGameState, ActionType, Declaration } from '@/lib/types';
import { ACTION_META, BRIBE_MENU } from '@/lib/utils';
import { getEvent, WORLD_EVENTS } from '@/lib/events';

export default function PlayPage({ params }: { params: { gameCode: string; teamToken: string } }) {
  const { gameCode, teamToken } = params;
  const [state, setState] = useState<TeamGameState | null>(null);
  const [error, setError] = useState('');

  // Action selection state
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [target, setTarget] = useState('');
  const [target2, setTarget2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Declaration state (Civil Unrest)
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [declaring, setDeclaring] = useState(false);

  // Bribe state
  const [showBribeMenu, setShowBribeMenu] = useState(false);
  const [selectedBribe, setSelectedBribe] = useState('');
  const [brideTarget, setBribeTarget] = useState('');
  const [brideNewAction, setBribeNewAction] = useState('');
  const [brideNewTarget, setBribeNewTarget] = useState('');
  const [bribeError, setBribeError] = useState('');
  const [bribeSuccess, setBribeSuccess] = useState('');
  const [bribeLoading, setBribeLoading] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameCode}/state?teamToken=${teamToken}`);
      if (!res.ok) { setError('Session expired or invalid.'); return; }
      const data: TeamGameState = await res.json();
      setState(prev => {
        // Reset action selection when round changes
        if (prev && prev.currentRound !== data.currentRound) {
          setSelectedAction(null);
          setTarget('');
          setTarget2('');
          setDeclaration(null);
          setSubmitError('');
          setBribeSuccess('');
          setBribeError('');
        }
        return data;
      });
    } catch {
      // silently retry
    }
  }, [gameCode, teamToken]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  async function submitAction() {
    if (!selectedAction) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/game/${gameCode}/submit-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamToken, action: selectedAction, target: target || undefined, target2: target2 || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await poll();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDeclaration() {
    if (!declaration) return;
    setDeclaring(true);
    try {
      await fetch(`/api/game/${gameCode}/declare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamToken, declaration }),
      });
      await poll();
    } finally {
      setDeclaring(false);
    }
  }

  async function submitBribe() {
    if (!selectedBribe) return;
    setBribeLoading(true);
    setBribeError('');
    setBribeSuccess('');
    try {
      const res = await fetch(`/api/game/${gameCode}/bribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamToken,
          power: selectedBribe,
          targetTeamId: brideTarget || undefined,
          newAction: brideNewAction || undefined,
          newTarget: brideNewTarget || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBribeSuccess('Bribe request sent! Waiting for GM approval.');
      setSelectedBribe('');
      setBribeTarget('');
      setBribeNewAction('');
      setBribeNewTarget('');
      await poll();
    } catch (e: unknown) {
      setBribeError(e instanceof Error ? e.message : 'Failed to send bribe');
    } finally {
      setBribeLoading(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-2">⚠️ {error}</p>
          <p className="text-white/40">Check your link and try again.</p>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-4xl mb-3">⚔️</div>
          <p className="text-white/40">Connecting to war room...</p>
        </div>
      </main>
    );
  }

  const myTeam = state.myTeam;
  const event = getEvent(state.worldEvent);
  const otherTeams = state.teams.filter(t => t.id !== myTeam.id && !t.eliminated);
  const myDeclared = state.declarations[myTeam.id];
  const isDoubleAttack = state.worldEvent === 'double_attack';
  const needsCivilUnrest = state.worldEvent === 'civil_unrest' && !myDeclared;

  // ── LOBBY ─────────────────────────────────────────────────────────────────────
  if (state.status === 'lobby') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: myTeam.color }} />
            <span className="font-bold text-lg">{myTeam.name}</span>
          </div>
          <p className="text-white/40 text-sm">Game Code: <span className="font-mono font-bold text-white/70 tracking-widest">{gameCode}</span></p>
        </div>

        <div className="card text-center max-w-sm w-full">
          <div className="text-4xl mb-3">⏳</div>
          <h2 className="font-bold text-lg mb-1">Waiting for the Game Master</h2>
          <p className="text-white/40 text-sm">The GM will start the game once all factions have joined.</p>
        </div>

        <div className="card max-w-sm w-full">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Factions Registered</p>
          {state.teams.map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="font-medium">{t.name}</span>
              {t.id === myTeam.id && <span className="text-xs text-white/30">(you)</span>}
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── GAME OVER ────────────────────────────────────────────────────────────────
  if (state.status === 'finished') {
    const sorted = [...state.teams].sort((a, b) => b.tp - a.tp);
    const winner = sorted[0];
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h2 className="text-2xl font-black">GAME OVER</h2>
          <p className="text-white/40 mt-1">The war has ended.</p>
        </div>
        <div className="card max-w-sm w-full">
          <p className="text-center text-[#F5A623] font-bold text-lg mb-4">👑 {winner.name} WINS</p>
          {sorted.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <span className="text-white/40 w-5 font-bold">{i + 1}.</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 font-medium">{t.name}</span>
              <span className="font-bold text-white">{t.tp} TP</span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── ROUND RESOLVED ───────────────────────────────────────────────────────────
  if (state.status === 'round_resolved') {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 gap-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <span className="text-white/40 text-sm">Round {state.currentRound}</span>
          <span className="text-white/40 text-sm">{myTeam.name}</span>
        </div>

        <div className="card w-full text-center">
          <div className="text-3xl mb-2">📣</div>
          <h2 className="font-bold text-lg">Round Complete!</h2>
          <p className="text-white/40 text-sm mt-1">
            {state.pointsVisible
              ? 'The Game Master is announcing results...'
              : 'The Game Master will narrate what happened. Points are hidden until they reveal.'}
          </p>
        </div>

        {/* Spy Intel — only shown to the spy */}
        {state.spyIntel && (
          <div className="card w-full border-blue-500/50 bg-blue-950/30">
            <p className="text-blue-400 text-xs uppercase tracking-wider font-bold mb-2">🕵️ Spy Intel</p>
            {state.spyIntelNarration && (
              <p className="text-white/90 italic leading-relaxed text-sm mb-3 border-l-2 border-blue-400/40 pl-3">
                {state.spyIntelNarration}
              </p>
            )}
            <p className="font-medium text-sm">
              <span className="text-white/60">You spied on </span>
              <span className="font-bold text-white">
                {state.teams.find(t => t.id === state.spyIntel!.targetTeamId)?.name}
              </span>
              <span className="text-white/60">. They played </span>
              <span className={`font-bold uppercase ${ACTION_META[state.spyIntel.actionType]?.color}`}>
                {state.spyIntel.actionType}
              </span>
              {state.spyIntel.actionTarget && (
                <span className="text-white/60">
                  {' '}targeting{' '}
                  <span className="font-bold text-white">
                    {state.teams.find(t => t.id === state.spyIntel!.actionTarget)?.name ?? 'Unknown'}
                  </span>
                </span>
              )}
              .
            </p>
          </div>
        )}

        {/* Counterspy notification */}
        {state.counterspyInfo && (
          <div className="card w-full border-yellow-500/50 bg-yellow-950/30">
            <p className="text-yellow-400 text-xs uppercase tracking-wider font-bold mb-1">🔍 Counterspy Alert</p>
            <p className="text-sm">
              <span className="font-bold text-white">{state.counterspyInfo.spiedByTeamName}</span>
              {' '}was spying on you this round.
            </p>
          </div>
        )}

        {/* Counter Intel notification */}
        {state.counterIntelInfo && !state.counterspyInfo && (
          <div className="card w-full border-yellow-500/40 bg-yellow-950/20">
            <p className="text-yellow-400 text-xs uppercase tracking-wider font-bold mb-1">🕵️ Counter Intel</p>
            <p className="text-sm text-white/70">Someone spied on you this round. Identity unknown.</p>
          </div>
        )}

        {/* Standings — only if GM has revealed points */}
        {state.pointsVisible && (
          <div className="card w-full">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Current Standings</p>
            {[...state.teams].sort((a, b) => b.tp - a.tp).map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 py-1.5">
                <span className="text-white/40 text-sm w-4">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className={`flex-1 text-sm font-medium ${t.eliminated ? 'line-through text-white/30' : ''}`}>{t.name}</span>
                <span className="font-bold text-sm">{t.tp} TP</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-white/30 text-xs text-center">Waiting for GM to start the next round...</p>
      </main>
    );
  }

  // ── ROUND ACTIVE / LOCKED ────────────────────────────────────────────────────
  if (state.status === 'round_active' || state.status === 'round_locked') {
    const alreadySubmitted = state.hasSubmitted;
    const locked = state.status === 'round_locked';
    const canSwitch = state.worldEvent === 'chaos_market';

    return (
      <main className="min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: myTeam.color }} />
            <span className="font-bold">{myTeam.name}</span>
            {myTeam.immune && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-400/50 bg-blue-950/40 text-blue-300">
                🛡️ Immune this round
              </span>
            )}
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-white/50">Round <span className="font-bold text-white">{state.currentRound}</span></span>
            {state.pointsVisible && (
              <span className="text-white/50"><span className="font-bold text-[#F5A623]">{myTeam.tp}</span> TP</span>
            )}
            <span className="text-white/50"><span className="font-bold text-purple-400">{myTeam.bribes}</span> 🪙</span>
          </div>
        </div>

        {/* World Event banner */}
        {state.worldEvent && state.worldEvent !== 'none' && (
          <div className="card border-[#F5A623]/40 bg-[#F5A623]/10 py-3">
            <div className="flex items-start gap-2">
              <span className="text-xl">{event.emoji}</span>
              <div>
                <p className="font-bold text-[#F5A623] text-sm">{event.name}</p>
                <p className="text-white/60 text-xs mt-0.5">{event.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Locked banner */}
        {locked && (
          <div className="card border-[#F5A623]/40 bg-[#F5A623]/10 py-3">
            <p className="font-bold text-[#F5A623] text-sm">🔒 Actions locked</p>
            <p className="text-white/60 text-xs mt-0.5">
              {canSwitch
                ? 'The GM has locked the round. You can still pay 2 tokens to switch your action via the Bribe Menu below before resolution.'
                : 'The GM has locked the round and is resolving it now.'}
            </p>
          </div>
        )}

        {/* Force-reveal intel — only the team that paid sees this */}
        {state.forceRevealResults && state.forceRevealResults.length > 0 && (
          <div className="card border-yellow-500/50 bg-yellow-950/30">
            <p className="text-yellow-400 text-xs uppercase tracking-wider font-bold mb-2">📜 Forced Reveal — Intel</p>
            {state.forceRevealResults.map((r, i) => (
              <p key={i} className="text-sm py-1">
                <span className="font-bold text-white">{state.teams.find(t => t.id === r.targetTeamId)?.name ?? 'Unknown'}</span>
                <span className="text-white/60"> is playing </span>
                <span className={`font-bold uppercase ${ACTION_META[r.actionType]?.color}`}>{r.actionType}</span>
                {r.actionTarget && (
                  <span className="text-white/60"> → {state.teams.find(t => t.id === r.actionTarget)?.name ?? 'Unknown'}</span>
                )}
              </p>
            ))}
          </div>
        )}

        {/* Submission tracker */}
        <div className="flex gap-2 flex-wrap">
          {state.teams.filter(t => !t.eliminated).map(t => (
            <div key={t.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              state.submittedTeamIds.includes(t.id)
                ? 'border-green-500/50 bg-green-950/30 text-green-400'
                : 'border-white/10 bg-white/5 text-white/40'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
              {state.submittedTeamIds.includes(t.id) ? ' ✓' : ' ...'}
            </div>
          ))}
        </div>

        {/* Exposed Plans: show all submitted actions */}
        {state.exposedActions && Object.keys(state.exposedActions).length > 0 && (
          <div className="card border-orange-500/40 bg-orange-950/20">
            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">📋 Exposed Plans — All Actions Visible</p>
            {Object.entries(state.exposedActions).map(([tid, act]) => {
              const team = state.teams.find(t => t.id === tid);
              return (
                <div key={tid} className="flex items-center gap-2 text-sm py-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team?.color }} />
                  <span className="text-white/70 font-medium">{team?.name}:</span>
                  <span className={`font-bold uppercase ${ACTION_META[act.type]?.color}`}>{act.type}</span>
                  {act.target && <span className="text-white/40">→ {state.teams.find(t => t.id === act.target)?.name}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Civil Unrest: Declaration phase */}
        {state.worldEvent === 'civil_unrest' && !myDeclared && !alreadySubmitted && (
          <div className="card border-orange-500/40 bg-orange-950/20">
            <p className="text-orange-400 font-bold text-sm mb-1">📢 Civil Unrest — Declare your stance</p>
            <p className="text-white/50 text-xs mb-3">Your declaration is public. Choose before submitting your action.</p>
            <div className="flex gap-2">
              {(['offensive', 'defensive', 'neutral'] as Declaration[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDeclaration(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize border transition-colors ${
                    declaration === d ? 'border-orange-400 bg-orange-500/20 text-orange-300' : 'border-white/10 bg-white/5 text-white/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              className="btn-primary w-full mt-3 py-2 text-sm"
              onClick={submitDeclaration}
              disabled={!declaration || declaring}
            >
              {declaring ? 'Declaring...' : 'Submit Declaration'}
            </button>
          </div>
        )}

        {/* Other teams' declarations */}
        {state.worldEvent === 'civil_unrest' && Object.keys(state.declarations).length > 0 && (
          <div className="card">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Public Declarations</p>
            {Object.entries(state.declarations).map(([tid, decl]) => {
              const t = state.teams.find(t => t.id === tid);
              return (
                <div key={tid} className="flex items-center gap-2 py-1 text-sm">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t?.color }} />
                  <span className="text-white/70">{t?.name}:</span>
                  <span className={`font-bold capitalize ${decl === 'offensive' ? 'text-red-400' : decl === 'defensive' ? 'text-green-400' : 'text-blue-400'}`}>{decl}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Already submitted / locked state */}
        {(alreadySubmitted || locked) ? (
          alreadySubmitted ? (
            <div className="card text-center py-8 border-green-500/30 bg-green-950/20">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-bold text-green-400">Action submitted!</p>
              <p className="text-white/40 text-sm mt-1">
                {canSwitch
                  ? 'Chaos Market: you can switch your action for 2 tokens via the Bribe Menu below.'
                  : 'Waiting for the Game Master to resolve the round...'}
              </p>
            </div>
          ) : (
            <div className="card text-center py-8 border-white/10">
              <div className="text-3xl mb-2">🔒</div>
              <p className="font-bold text-white/70">Round locked</p>
              <p className="text-white/40 text-sm mt-1">You did not submit an action before the GM locked the round.</p>
            </div>
          )
        ) : (
          <>
            {/* Action cards */}
            {(!needsCivilUnrest) && (
              <>
                <p className="text-white/50 text-xs uppercase tracking-wider mt-1">Choose your action</p>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.entries(ACTION_META) as [ActionType, typeof ACTION_META[keyof typeof ACTION_META]][]).map(([action, meta]) => {
                    // Civil Unrest: a public declaration restricts which actions are allowed.
                    const allowedByDeclaration: Record<Declaration, ActionType[]> = {
                      offensive: ['attack', 'sabotage'],
                      defensive: ['defend', 'reinforce'],
                      neutral: ['spy', 'trade'],
                    };
                    const disabled =
                      state.worldEvent === 'civil_unrest' && !!myDeclared
                        ? !allowedByDeclaration[myDeclared].includes(action)
                        : false;
                    return (
                    <button
                      key={action}
                      disabled={disabled}
                      onClick={() => { setSelectedAction(action); setTarget(''); setTarget2(''); }}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        disabled
                          ? 'border-white/5 bg-white/5 opacity-40 cursor-not-allowed'
                          : selectedAction === action
                          ? `${meta.border} ${meta.bg}`
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-black text-base tracking-wider ${selectedAction === action ? meta.color : 'text-white'}`}>
                          {meta.label}
                        </span>
                        {selectedAction === action && <span className={`text-lg ${meta.color}`}>◼</span>}
                      </div>
                      <p className="text-white/40 text-xs mt-1">{meta.desc}</p>
                    </button>
                    );
                  })}
                </div>

                {/* Target selector */}
                {selectedAction && ACTION_META[selectedAction]?.needsTarget && (
                  <div className="space-y-2">
                    <label className="label">
                      {selectedAction === 'trade' ? 'Trade partner' : 'Target faction'}
                    </label>
                    <select
                      className="input"
                      value={target}
                      onChange={e => setTarget(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {otherTeams
                        .filter(t => {
                          // Trade protection: can't attack trade partner
                          if (selectedAction === 'attack' && myTeam.tradePartners.includes(t.id)) return false;
                          return true;
                        })
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}{state.pointsVisible ? ` (${t.tp} TP)` : ''}
                            {myTeam.tradePartners.includes(t.id) ? ' [trade protected]' : ''}
                          </option>
                        ))}
                    </select>

                    {/* Double Attack: second target */}
                    {isDoubleAttack && selectedAction === 'attack' && target && (
                      <div>
                        <label className="label">Second target (Double Attack)</label>
                        <select
                          className="input"
                          value={target2}
                          onChange={e => setTarget2(e.target.value)}
                        >
                          <option value="">— Optional —</option>
                          {otherTeams
                            .filter(t => t.id !== target && !myTeam.tradePartners.includes(t.id))
                            .map(t => (
                              <option key={t.id} value={t.id}>{t.name}{state.pointsVisible ? ` (${t.tp} TP)` : ''}</option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

                <button
                  className="btn-primary w-full py-3 text-base"
                  onClick={submitAction}
                  disabled={
                    !selectedAction ||
                    (ACTION_META[selectedAction]?.needsTarget && !target) ||
                    submitting
                  }
                >
                  {submitting ? 'Submitting...' : '🎯 Lock in Action'}
                </button>
              </>
            )}
          </>
        )}

        {/* Bribe Menu */}
        <div className="mt-2">
          <button
            className="w-full text-sm text-purple-400 border border-purple-500/30 rounded-lg py-2 hover:bg-purple-950/30 transition-colors"
            onClick={() => setShowBribeMenu(!showBribeMenu)}
          >
            🪙 Bribe Menu ({myTeam.bribes} tokens)
          </button>

          {showBribeMenu && (
            <div className="card mt-2 space-y-3">
              <p className="text-white/50 text-xs">Bribe requests go to the GM for approval.</p>

              {bribeSuccess && <p className="text-green-400 text-sm bg-green-950/30 p-2 rounded-lg">{bribeSuccess}</p>}
              {bribeError && <p className="text-red-400 text-sm">{bribeError}</p>}

              <select className="input text-sm" value={selectedBribe} onChange={e => { setSelectedBribe(e.target.value); setBribeTarget(''); setBribeNewAction(''); setBribeNewTarget(''); }}>
                <option value="">— Choose a power —</option>
                {BRIBE_MENU
                  // The 2-token "switch your action" bribe is only offered during Chaos Market.
                  .filter(b => b.power !== 'switch_action' || canSwitch)
                  .map(b => (
                    <option key={b.power} value={b.power} disabled={myTeam.bribes < b.cost}>
                      [{b.cost}🪙] {b.label}
                    </option>
                  ))}
              </select>

              {selectedBribe && (
                <p className="text-white/40 text-xs">{BRIBE_MENU.find(b => b.power === selectedBribe)?.desc}</p>
              )}

              {/* Target for bribes that need one */}
              {['learn_last_action', 'force_reveal', 'steal_token'].includes(selectedBribe) && (
                <select className="input text-sm" value={brideTarget} onChange={e => setBribeTarget(e.target.value)}>
                  <option value="">— Select target —</option>
                  {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}

              {/* New action (and new target) for switch_action */}
              {selectedBribe === 'switch_action' && (
                <>
                  <select className="input text-sm" value={brideNewAction} onChange={e => { setBribeNewAction(e.target.value); setBribeNewTarget(''); }}>
                    <option value="">— Switch to... —</option>
                    {Object.keys(ACTION_META).map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select>
                  {brideNewAction && ACTION_META[brideNewAction as ActionType]?.needsTarget && (
                    <select className="input text-sm" value={brideNewTarget} onChange={e => setBribeNewTarget(e.target.value)}>
                      <option value="">— {brideNewAction === 'trade' ? 'Trade partner' : 'New target'} —</option>
                      {otherTeams
                        .filter(t => !(brideNewAction === 'attack' && myTeam.tradePartners.includes(t.id)))
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </>
              )}

              <button
                className="btn-primary w-full py-2 text-sm"
                onClick={submitBribe}
                disabled={
                  !selectedBribe ||
                  bribeLoading ||
                  myTeam.bribes < (BRIBE_MENU.find(b => b.power === selectedBribe)?.cost ?? 99) ||
                  (['learn_last_action', 'force_reveal', 'steal_token'].includes(selectedBribe) && !brideTarget) ||
                  (selectedBribe === 'switch_action' && (!brideNewAction || (ACTION_META[brideNewAction as ActionType]?.needsTarget && !brideNewTarget)))
                }
              >
                {bribeLoading ? 'Sending...' : 'Send Bribe Request 🪙'}
              </button>
            </div>
          )}
        </div>

        {/* Round setup waiting state */}
      </main>
    );
  }

  // round_setup — waiting for GM to configure next round
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
      <div className="card text-center max-w-sm w-full">
        <div className="text-4xl mb-3">⚙️</div>
        <h2 className="font-bold text-lg">Preparing Next Round</h2>
        <p className="text-white/40 text-sm mt-1">The Game Master is setting up Round {state.currentRound + 1}...</p>
      </div>
      {state.pointsVisible && (
        <div className="card max-w-sm w-full">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Standings</p>
          {[...state.teams].sort((a, b) => b.tp - a.tp).map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 py-1.5">
              <span className="text-white/30 text-sm w-4">{i + 1}</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              <span className="font-bold text-sm">{t.tp} TP</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
