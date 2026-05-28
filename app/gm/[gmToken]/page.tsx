'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Game, Team, BribeRequest, ResolvedRound } from '@/lib/types';
import { ACTION_META, BRIBE_MENU } from '@/lib/utils';
import { WORLD_EVENTS, getEvent } from '@/lib/events';
import {
  Swords, Coin, Eye, EyeOff, Clipboard, Check, X as XIcon,
  Hourglass, Dice, Megaphone, Spyglass, Sparkle, Crown, Trophy,
  Skull, Shield, Handshake, Bolt, Gear, Undo, Warning,
} from '@/components/icons';

export default function GMPage({ params }: { params: { gmToken: string } }) {
  const { gmToken } = params;
  const searchParams = useSearchParams();
  const gameCode = searchParams.get('code') ?? '';

  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [useGemini, setUseGemini] = useState(true);
  const [copied, setCopied] = useState(false);

  // Round setup state
  const [selectedEvent, setSelectedEvent] = useState('none');
  const [shieldTarget, setShieldTarget] = useState('');
  const [startingRound, setStartingRound] = useState(false);

  // Adjust modal
  const [adjustTeam, setAdjustTeam] = useState<Team | null>(null);
  const [adjustTP, setAdjustTP] = useState('');
  const [adjustBribes, setAdjustBribes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameCode}/state?gmToken=${gmToken}`);
      if (!res.ok) { setError('Unauthorized or game not found.'); return; }
      const data: Game = await res.json();
      setGame(data);
    } catch {
      // retry silently
    }
  }, [gameCode, gmToken]);

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 3000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  async function startRound() {
    if (!game) return;
    setStartingRound(true);
    try {
      await fetch(`/api/game/${gameCode}/start-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmToken, worldEvent: selectedEvent === 'none' ? null : selectedEvent, shieldDomeFaction: shieldTarget || undefined }),
      });
      await fetchGame();
    } finally {
      setStartingRound(false);
    }
  }

  async function resolveRound() {
    if (!game) return;
    setResolving(true);
    try {
      await fetch(`/api/game/${gameCode}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmToken, useGemini: useGemini && !!game.settings.geminiKey }),
      });
      await fetchGame();
    } finally {
      setResolving(false);
    }
  }

  async function startNextRound() {
    await fetch(`/api/game/${gameCode}/next-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmToken }),
    });
    setSelectedEvent('none');
    setShieldTarget('');
    await fetchGame();
  }

  async function undoRound() {
    await fetch(`/api/game/${gameCode}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmToken }),
    });
    await fetchGame();
  }

  async function togglePoints() {
    if (!game) return;
    await fetch(`/api/game/${gameCode}/reveal-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmToken, visible: !game.pointsVisible }),
    });
    await fetchGame();
  }

  async function respondBribe(bribeId: string, approve: boolean) {
    await fetch(`/api/game/${gameCode}/bribe-respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmToken, bribeId, approve }),
    });
    await fetchGame();
  }

  async function adjustTeamStats() {
    if (!adjustTeam) return;
    setAdjusting(true);
    try {
      await fetch(`/api/game/${gameCode}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmToken,
          teamId: adjustTeam.id,
          tpDelta: adjustTP ? Number(adjustTP) : undefined,
          bribeDelta: adjustBribes ? Number(adjustBribes) : undefined,
        }),
      });
      setAdjustTeam(null);
      setAdjustTP('');
      setAdjustBribes('');
      await fetchGame();
    } finally {
      setAdjusting(false);
    }
  }

  function copyJoinLink() {
    const url = `${window.location.origin}/join/${gameCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-2 inline-flex items-center gap-2"><Warning size={20} /> {error}</p>
          <p className="text-white/40 text-sm">Make sure you have the correct GM link.</p>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center text-white/40">
          <Swords size={36} className="mx-auto mb-3" />
          <p>Loading GM Console…</p>
        </div>
      </main>
    );
  }

  const activeTeams = game.teams.filter(t => !t.eliminated);
  const maxTP = Math.max(...game.teams.map(t => t.tp), 1);
  const sorted = [...game.teams].sort((a, b) => b.tp - a.tp);
  const lastRound = game.roundHistory[game.roundHistory.length - 1];
  const pendingBribes = game.currentBribes.filter(b => b.status === 'pending');
  const event = getEvent(game.currentWorldEvent);

  // ── SCOREBOARD ────────────────────────────────────────────────────────────────
  const Scoreboard = () => (
    <div className="space-y-2">
      {sorted.map((team, i) => (
        <div key={team.id}
          className={`card p-3 cursor-pointer hover:border-white/20 transition-colors ${team.eliminated ? 'opacity-50' : ''}`}
          onClick={() => setAdjustTeam(team)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs font-bold w-4">{i + 1}</span>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="font-bold text-sm">{team.name}</span>
              {team.eliminated && <span className="badge bg-red-900/50 text-red-400 inline-flex items-center gap-1"><Skull size={11} /> out</span>}
              {team.immune && <span className="badge bg-blue-900/50 text-blue-400 inline-flex items-center gap-1"><Shield size={11} /> immune</span>}
              {team.tradePartners.length > 0 && (
                <span className="badge bg-green-900/50 text-green-400 inline-flex items-center"><Handshake size={11} /></span>
              )}
            </div>
            <div className="text-right">
              <span className="font-black text-lg text-white">{team.tp}</span>
              <span className="text-white/30 text-xs ml-1">TP</span>
            </div>
          </div>
          {/* TP bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(0, (team.tp / maxTP) * 100)}%`, backgroundColor: team.color }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/40">
            <span className="inline-flex items-center gap-1.5"><Coin size={12} /> {team.bribes} bribes</span>
            {game.currentActions[team.id] && (
              <span className={`font-bold uppercase inline-flex items-center gap-1 ${ACTION_META[game.currentActions[team.id].type]?.color}`}>
                <Check size={12} /> {game.currentActions[team.id].type}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // ── ROUND TAB ────────────────────────────────────────────────────────────────
  const RoundPanel = () => {
    if (game.status === 'lobby') {
      return (
        <div className="space-y-4">
          <div className="card text-center py-8">
            <Hourglass size={32} className="mx-auto mb-3 text-white/55" />
            <h3 className="font-bold text-lg">Waiting for teams to join…</h3>
            <p className="text-white/40 text-sm mt-1">Share the join link with your players.</p>
          </div>
          <div className="card">
            <p className="label">Join Link</p>
            <div className="flex gap-2">
              <code className="input text-sm flex-1 truncate">{typeof window !== 'undefined' ? `${window.location.origin}/join/${gameCode}` : `/join/${gameCode}`}</code>
              <button className="btn-secondary text-sm px-3 inline-flex items-center gap-1.5" onClick={copyJoinLink}>
                {copied ? <><Check size={13} /> Copied</> : <><Clipboard size={13} /> Copy</>}
              </button>
            </div>
            <p className="text-white/30 text-xs mt-2">Game Code: <span className="font-mono font-bold text-white/60 tracking-widest">{gameCode}</span></p>
          </div>
          {game.teams.length >= 2 && (
            <div className="card space-y-4">
              <div>
                <label className="label">World Event for Round 1</label>
                <select className="input" value={selectedEvent} onChange={e => { setSelectedEvent(e.target.value); setShieldTarget(''); }}>
                  {WORLD_EVENTS.map(e => (
                    <option key={e.id} value={e.id}>{e.emoji} {e.name}</option>
                  ))}
                </select>
                {selectedEvent !== 'none' && (
                  <p className="text-white/40 text-xs mt-1">{WORLD_EVENTS.find(e => e.id === selectedEvent)?.description}</p>
                )}
              </div>

              {selectedEvent === 'shield_dome' && (
                <div>
                  <label className="label">Shield Dome — Choose immune faction</label>
                  <select className="input" value={shieldTarget} onChange={e => setShieldTarget(e.target.value)}>
                    <option value="">— Select faction —</option>
                    {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <button
                className="w-full py-2 rounded-lg text-sm font-medium border border-white/10 text-white/60 hover:bg-white/5 inline-flex items-center justify-center gap-2"
                onClick={() => {
                  const pool = WORLD_EVENTS.filter(e => e.id !== 'none');
                  setSelectedEvent(pool[Math.floor(Math.random() * pool.length)].id);
                }}
              >
                <Dice size={14} /> Randomize Event
              </button>

              <button
                className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2"
                onClick={startRound}
                disabled={startingRound || (selectedEvent === 'shield_dome' && !shieldTarget)}
              >
                {startingRound ? 'Starting…' : <><Swords size={16} /> Start Game ({game.teams.length} teams ready)</>}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (game.status === 'round_setup') {
      return (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-lg text-[#4F6EF5] mb-1">Round {game.currentRound + 1} Setup</h3>
            <p className="text-white/40 text-sm">Configure the world event then start the round.</p>
          </div>

          <div className="card space-y-4">
            <div>
              <label className="label">World Event</label>
              <select className="input" value={selectedEvent} onChange={e => { setSelectedEvent(e.target.value); setShieldTarget(''); }}>
                {WORLD_EVENTS.map(e => (
                  <option key={e.id} value={e.id}>{e.emoji} {e.name}</option>
                ))}
              </select>
              {selectedEvent !== 'none' && (
                <p className="text-white/40 text-xs mt-1">{WORLD_EVENTS.find(e => e.id === selectedEvent)?.description}</p>
              )}
            </div>

            {selectedEvent === 'shield_dome' && (
              <div>
                <label className="label">Shield Dome — Choose immune faction</label>
                <select className="input" value={shieldTarget} onChange={e => setShieldTarget(e.target.value)}>
                  <option value="">— Select faction —</option>
                  {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <button
              className="w-full py-2 rounded-lg text-sm font-medium border border-white/10 text-white/60 hover:bg-white/5"
              onClick={() => {
                const pool = WORLD_EVENTS.filter(e => e.id !== 'none');
                setSelectedEvent(pool[Math.floor(Math.random() * pool.length)].id);
              }}
            >
              🎲 Randomize Event
            </button>
          </div>

          <button
            className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2"
            onClick={startRound}
            disabled={startingRound || (selectedEvent === 'shield_dome' && !shieldTarget)}
          >
            {startingRound ? 'Starting…' : <><Bolt size={16} /> Start Round {game.currentRound + 1}</>}
          </button>
        </div>
      );
    }

    if (game.status === 'round_active') {
      const totalActive = activeTeams.length;
      const submitted = Object.keys(game.currentActions).length;
      const allSubmitted = submitted >= totalActive;

      return (
        <div className="space-y-4">
          {/* Round header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#4F6EF5]">Round {game.currentRound} — Active</h3>
                <p className="text-white/40 text-sm mt-0.5">
                  {submitted}/{totalActive} factions submitted
                  {allSubmitted && <span className="text-green-400 font-bold"> — All in!</span>}
                </p>
              </div>
              {game.currentWorldEvent && game.currentWorldEvent !== 'none' && (
                <div className="text-right">
                  <span className="text-xl">{event.emoji}</span>
                  <p className="text-[#F5A623] text-xs font-bold">{event.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action table */}
          <div className="card">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Submitted Actions</p>
            {activeTeams.map(team => {
              const action = game.currentActions[team.id];
              const targetName = action?.target ? game.teams.find(t => t.id === action.target)?.name : '';
              const target2Name = action?.target2 ? game.teams.find(t => t.id === action.target2)?.name : '';
              return (
                <div key={team.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                  <span className="flex-1 font-medium text-sm">{team.name}</span>
                  {action ? (
                    <div className="text-right">
                      <span className={`font-bold text-sm uppercase ${ACTION_META[action.type]?.color}`}>
                        {action.type}
                      </span>
                      {targetName && (
                        <span className="text-white/40 text-xs ml-1.5">→ {targetName}{target2Name ? ` + ${target2Name}` : ''}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/20 text-sm">pending...</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Declarations for Civil Unrest */}
          {game.currentWorldEvent === 'civil_unrest' && Object.keys(game.currentDeclarations).length > 0 && (
            <div className="card">
              <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5"><Megaphone size={13} /> Civil Unrest Declarations</p>
              {Object.entries(game.currentDeclarations).map(([tid, decl]) => {
                const t = game.teams.find(t => t.id === tid);
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

          {/* Pending bribe requests */}
          {pendingBribes.length > 0 && (
            <div className="card border-purple-500/30 bg-purple-950/20">
              <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                <Coin size={13} /> Bribe Requests ({pendingBribes.length} pending)
              </p>
              {pendingBribes.map(bribe => {
                const requestor = game.teams.find(t => t.id === bribe.teamId);
                const target = bribe.targetTeamId ? game.teams.find(t => t.id === bribe.targetTeamId) : null;
                const menuItem = BRIBE_MENU.find(b => b.power === bribe.power);
                return (
                  <div key={bribe.id} className="border border-purple-500/20 rounded-lg p-3 mb-2 last:mb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: requestor?.color }} />
                          <span className="font-bold text-sm">{requestor?.name}</span>
                          <span className="text-purple-400 text-xs inline-flex items-center gap-0.5">[{bribe.cost}<Coin size={10} />]</span>
                        </div>
                        <p className="text-white/70 text-sm">{menuItem?.label}</p>
                        {target && <p className="text-white/40 text-xs">→ targeting {target.name}</p>}
                        {bribe.newAction && <p className="text-white/40 text-xs">→ switch to {bribe.newAction.toUpperCase()}</p>}
                        {bribe.power === 'learn_last_action' && (() => {
                          const lastAction = lastRound?.actions[bribe.targetTeamId ?? ''];
                          return lastAction ? (
                            <p className="text-yellow-400 text-xs mt-1 font-bold">
                              Intel: {target?.name} played {lastAction.type.toUpperCase()}
                              {lastAction.target ? ` → ${game.teams.find(t => t.id === lastAction.target)?.name}` : ''}
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button className="btn-success text-xs px-3 py-1.5 inline-flex items-center gap-1" onClick={() => respondBribe(bribe.id, true)}><Check size={12} /> Approve</button>
                        <button className="btn-danger text-xs px-3 py-1.5 inline-flex items-center gap-1" onClick={() => respondBribe(bribe.id, false)}><XIcon size={12} /> Reject</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Spy intel preview */}
          {Object.values(game.currentActions).some(a => a.type === 'spy') && game.currentWorldEvent !== 'fog_of_war' && (
            <div className="card border-blue-500/30 bg-blue-950/20">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5"><Spyglass size={13} /> Spy Intel Preview</p>
              {Object.entries(game.currentActions)
                .filter(([, a]) => a.type === 'spy')
                .map(([spyId, a]) => {
                  const spy = game.teams.find(t => t.id === spyId);
                  const target = game.teams.find(t => t.id === a.target);
                  const targetAction = a.target ? game.currentActions[a.target] : null;
                  return (
                    <div key={spyId} className="text-sm py-1.5 border-b border-blue-500/10 last:border-0">
                      <span className="font-bold text-blue-300">{spy?.name}</span>
                      <span className="text-white/40"> spied on </span>
                      <span className="font-bold text-white">{target?.name}</span>
                      {targetAction ? (
                        <>
                          <span className="text-white/40"> → </span>
                          <span className={`font-bold uppercase ${ACTION_META[targetAction.type]?.color}`}>{targetAction.type}</span>
                          {targetAction.target && (
                            <span className="text-white/40"> targeting {game.teams.find(t => t.id === targetAction.target)?.name}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-white/30"> → hasn't submitted yet</span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Resolve button */}
          <div className="space-y-2">
            {game.settings.geminiKey && (
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input type="checkbox" checked={useGemini} onChange={e => setUseGemini(e.target.checked)} className="accent-[#4F6EF5]" />
                Generate AI dramatic summary (Gemini)
              </label>
            )}
            <button
              className={`w-full py-3 rounded-xl font-bold text-base transition-all inline-flex items-center justify-center gap-2 ${
                allSubmitted ? 'btn-primary' : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
              onClick={resolveRound}
              disabled={resolving}
            >
              {resolving
                ? <><Gear size={16} className="animate-spin" /> Resolving…</>
                : <><Bolt size={16} /> Resolve Round {game.currentRound}{!allSubmitted ? ` (${totalActive - submitted} missing)` : ''}</>}
            </button>
          </div>
        </div>
      );
    }

    if (game.status === 'round_resolved') {
      if (!lastRound) return null;
      return (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-lg text-green-400">Round {lastRound.roundNumber} — Resolved</h3>
            <p className="text-white/40 text-sm mt-0.5">Review results below, then start next round.</p>
          </div>

          {/* Gemini summary */}
          {lastRound.geminiSummary && (
            <div className="card border-[#F5A623]/30 bg-[#F5A623]/5">
              <p className="text-[#F5A623] text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5"><Sparkle size={13} /> AI Dramatic Summary</p>
              <p className="text-white/80 italic leading-relaxed text-sm">{lastRound.geminiSummary}</p>
            </div>
          )}

          {/* TP changes */}
          <div className="card">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Territory Point Changes</p>
            {Object.entries(lastRound.tpDeltas)
              .sort(([, a], [, b]) => b - a)
              .map(([teamId, delta]) => {
                const team = game.teams.find(t => t.id === teamId);
                return (
                  <div key={teamId} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team?.color }} />
                    <span className="flex-1 font-medium text-sm">{team?.name}</span>
                    <span className={`font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-white/30'}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                    <span className="text-white/40 text-sm">{lastRound.tpBefore[teamId]} → <span className="font-bold text-white">{lastRound.tpAfter[teamId]}</span></span>
                  </div>
                );
              })}
          </div>

          {/* Round log */}
          <div className="card">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Round Events</p>
            <div className="space-y-1.5">
              {lastRound.log.map((entry, i) => (
                <p key={i} className="text-sm text-white/70 leading-relaxed">{entry}</p>
              ))}
            </div>
          </div>

          {/* Spy intel (full list for GM) */}
          {lastRound.spyResults.length > 0 && (
            <div className="card border-blue-500/30 bg-blue-950/20">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5"><Spyglass size={13} /> Spy Results</p>
              {lastRound.spyResults.map((r, i) => {
                const spy = game.teams.find(t => t.id === r.spyTeamId);
                const target = game.teams.find(t => t.id === r.targetTeamId);
                return (
                  <p key={i} className="text-sm py-1 text-white/70">
                    <span className="font-bold text-blue-300">{spy?.name}</span> saw{' '}
                    <span className="font-bold text-white">{target?.name}</span> played{' '}
                    <span className={`font-bold uppercase ${ACTION_META[r.actionType]?.color}`}>{r.actionType}</span>
                    {r.actionTarget && <span className="text-white/40"> → {game.teams.find(t => t.id === r.actionTarget)?.name}</span>}
                  </p>
                );
              })}
            </div>
          )}

          {/* Actions taken */}
          <div className="card">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Actions This Round</p>
            {game.teams.map(team => {
              const action = lastRound.actions[team.id];
              if (!action) return null;
              return (
                <div key={team.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-sm text-white/70 flex-1">{team.name}</span>
                  <span className={`font-bold text-sm uppercase ${ACTION_META[action.type]?.color}`}>{action.type}</span>
                  {action.target && <span className="text-white/40 text-xs">→ {game.teams.find(t => t.id === action.target)?.name}</span>}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            {game.undoStack.length > 0 && (
              <button className="btn-secondary flex-1 inline-flex items-center justify-center gap-1.5" onClick={undoRound}><Undo size={14} /> Undo Round</button>
            )}
            {game.status === 'round_resolved' && (
              game.currentRound >= game.settings.maxRounds ? (
                <button className="btn-primary flex-1 py-3 inline-flex items-center justify-center gap-2" onClick={() => {
                  fetch(`/api/game/${gameCode}/next-round`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gmToken }),
                  }).then(fetchGame);
                }}>
                  <Trophy size={16} /> End Game
                </button>
              ) : (
                <button className="btn-primary flex-1 py-3 inline-flex items-center justify-center gap-2" onClick={startNextRound}>
                  <Bolt size={16} /> Start Round {game.currentRound + 1}
                </button>
              )
            )}
          </div>
        </div>
      );
    }

    if (game.status === 'finished') {
      return (
        <div className="space-y-4">
          <div className="card text-center">
            <Trophy size={40} className="mx-auto mb-2 text-[#E8B863]" />
            <h3 className="font-black text-2xl">GAME OVER</h3>
            <p className="text-white/40 text-sm mt-1">The war has concluded after {game.roundHistory.length} rounds.</p>
          </div>
          <div className="card">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Final Standings</p>
            {sorted.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-white/40 font-bold w-5">{i + 1}.</span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="flex-1 font-bold">{t.name}</span>
                <span className="font-black text-xl text-white">{t.tp}</span>
                <span className="text-white/30 text-sm">TP</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[#E8B863] font-bold text-lg inline-flex items-center justify-center gap-2 w-full">
            <Crown size={18} /> {sorted[0]?.name} wins!
          </p>
        </div>
      );
    }

    return null;
  };

  // ── ROUND LOG ────────────────────────────────────────────────────────────────
  const LogPanel = () => (
    <div className="space-y-4">
      {game.roundHistory.length === 0 && (
        <div className="text-center text-white/30 py-8">No rounds played yet.</div>
      )}
      {[...game.roundHistory].reverse().map(round => (
        <div key={round.roundNumber} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#4F6EF5]">Round {round.roundNumber}</h3>
            {round.worldEvent && (
              <span className="text-xs text-[#F5A623] font-medium">{getEvent(round.worldEvent).emoji} {getEvent(round.worldEvent).name}</span>
            )}
          </div>
          {round.geminiSummary && (
            <p className="text-white/70 italic text-sm leading-relaxed border-l-2 border-[#F5A623]/50 pl-3">{round.geminiSummary}</p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(round.tpDeltas).filter(([, d]) => d !== 0).map(([tid, delta]) => {
              const t = game.teams.find(t => t.id === tid);
              return (
                <div key={tid} className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t?.color }} />
                  <span className="text-white/60 flex-1 truncate">{t?.name}</span>
                  <span className={`font-bold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                </div>
              );
            })}
          </div>
          <details className="text-xs">
            <summary className="text-white/30 cursor-pointer hover:text-white/50">View round log</summary>
            <div className="mt-2 space-y-1">
              {round.log.map((entry, i) => <p key={i} className="text-white/50 leading-relaxed">{entry}</p>)}
            </div>
          </details>
        </div>
      ))}
    </div>
  );

  // ── ADJUST MODAL ──────────────────────────────────────────────────────────────
  const AdjustModal = () => {
    if (!adjustTeam) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAdjustTeam(null)}>
        <div className="card w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: adjustTeam.color }} />
            <h3 className="font-bold">{adjustTeam.name} — Manual Adjust</h3>
          </div>
          <p className="text-white/40 text-xs">Current: {adjustTeam.tp} TP · {adjustTeam.bribes} bribes</p>
          <div>
            <label className="label">TP delta (e.g. +3 or -2)</label>
            <input className="input" placeholder="0" value={adjustTP} onChange={e => setAdjustTP(e.target.value)} />
          </div>
          <div>
            <label className="label">Bribe token delta</label>
            <input className="input" placeholder="0" value={adjustBribes} onChange={e => setAdjustBribes(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setAdjustTeam(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={adjustTeamStats} disabled={adjusting}>
              {adjusting ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const statusLabel =
    game.status === 'lobby' ? 'Lobby' :
    game.status === 'round_setup' ? 'Round setup' :
    game.status === 'round_active' ? 'Round active' :
    game.status === 'round_resolved' ? 'Round resolved' :
    game.status === 'finished' ? 'Finished' : game.status;

  const statusDot =
    game.status === 'round_active' ? 'bg-emerald-400' :
    game.status === 'round_resolved' ? 'bg-amber-400' :
    game.status === 'finished' ? 'bg-purple-400' :
    'bg-white/40';

  return (
    <main className="min-h-screen p-4 lg:p-6">
      {/* Top row: logo / code / toggles */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 mb-4">
        <div className="card flex items-center gap-3 px-5 py-3">
          <span className="font-serif text-2xl text-white leading-none">Faction Wars</span>
          <span className="w-px h-5 bg-white/10" />
          <span className="text-white/45 text-[11px] uppercase tracking-[0.2em] font-medium">GM Console</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/55">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot} ${game.status === 'round_active' ? 'glow-pulse' : ''}`} />
            {statusLabel}
          </span>
        </div>

        <button
          onClick={copyJoinLink}
          className="card flex items-center gap-3 px-5 py-3 text-left hover:border-white/20 transition-colors"
          title="Copy join link"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-semibold">Code</span>
          <span className="font-mono font-bold text-base tracking-[0.3em] text-white">{gameCode}</span>
          <span className="text-white/40">{copied ? <Check size={14} /> : <Clipboard size={14} />}</span>
        </button>

        <div className="card flex items-center gap-2 px-3 py-3">
          {game.status !== 'lobby' && (
            <span className="text-white/55 text-xs px-2">
              R<span className="font-bold text-white ml-1">{game.currentRound}</span>
              <span className="text-white/30">/{game.settings.maxRounds}</span>
            </span>
          )}
          {pendingBribes.length > 0 && (
            <span className="bg-purple-500/90 text-white text-[11px] font-bold px-2 py-1 rounded-lg animate-pulse">
              {pendingBribes.length} bribe{pendingBribes.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={togglePoints}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
              game.pointsVisible
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60'
                : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'
            }`}
            title="Toggle player visibility of TP / standings"
          >
            {game.pointsVisible ? <><Eye size={13} /> Points: Revealed</> : <><EyeOff size={13} /> Points: Hidden</>}
          </button>
        </div>
      </header>

      {/* Dashboard: scoreboard | (round / logs) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
        {/* Left — Scoreboard */}
        <section className="card p-5 flex flex-col min-h-[600px]">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#E04848] font-semibold mb-0.5">Standings</p>
              <h2 className="font-serif text-2xl text-white">Scoreboard</h2>
            </div>
            <p className="text-white/30 text-[11px]">{game.teams.length} {game.teams.length === 1 ? 'team' : 'teams'}</p>
          </div>
          {game.teams.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center mb-3 text-white/55">
                <Hourglass size={18} />
              </div>
              <p className="text-white/55 text-sm font-medium">Waiting for teams</p>
              <p className="text-white/30 text-xs mt-1">Share the join link to get started.</p>
            </div>
          ) : (
            <>
              <p className="text-white/25 text-[11px] mb-3">Click a team to adjust TP / bribes.</p>
              <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                <Scoreboard />
              </div>
            </>
          )}
        </section>

        {/* Right — Round + Logs */}
        <div className="grid grid-rows-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 min-h-[600px]">
          <section className="card p-5 overflow-y-auto">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#E04848] font-semibold mb-0.5">Game</p>
                <h2 className="font-serif text-2xl text-white">Round</h2>
              </div>
            </div>
            <RoundPanel />
          </section>

          <section className="card p-5 overflow-y-auto">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#E04848] font-semibold mb-0.5">History</p>
                <h2 className="font-serif text-xl text-white">Logs</h2>
              </div>
              <p className="text-white/30 text-[11px]">{game.roundHistory.length} {game.roundHistory.length === 1 ? 'round' : 'rounds'}</p>
            </div>
            <LogPanel />
          </section>
        </div>
      </div>

      <AdjustModal />
    </main>
  );
}
