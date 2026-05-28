'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [maxRounds, setMaxRounds] = useState('12');
  const [startingTP, setStartingTP] = useState('10');
  const [startingBribes, setStartingBribes] = useState('5');
  const [geminiKey, setGeminiKey] = useState('');
  const [gameCode, setGameCode] = useState('');

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRounds: Number(maxRounds), startingTP: Number(startingTP), startingBribes: Number(startingBribes), geminiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/gm/${data.gmToken}?code=${data.gameCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const code = gameCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/join/${code}`);
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] rounded-full blur-3xl opacity-[0.18] glow-pulse"
             style={{ background: 'radial-gradient(closest-side, #4F6EF5, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* Hero */}
      <div className="text-center mb-14 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6B7FFF] glow-pulse" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-medium">Live multiplayer</span>
        </div>

        <h1 className="font-serif italic text-7xl md:text-[8.5rem] leading-[0.92] tracking-tight text-white">
          Faction
          <span className="block bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">Wars</span>
        </h1>

        <p className="mt-8 text-white/50 text-base md:text-lg max-w-md mx-auto leading-relaxed">
          A game of diplomacy, deception, and calculated aggression.
        </p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button className="btn-primary text-base py-3.5 rounded-2xl" onClick={() => setView('create')}>
            Create a Game
          </button>
          <button className="btn-secondary text-base py-3.5 rounded-2xl" onClick={() => setView('join')}>
            Join with a code
          </button>
          <p className="text-center text-white/30 text-xs mt-4 tracking-wide">
            No account. No download. Just share the link.
          </p>
        </div>
      )}

      {view === 'create' && (
        <div className="card w-full max-w-md space-y-5 p-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7FFF] font-semibold mb-1">Setup</p>
            <h2 className="font-serif italic text-3xl text-white">New Game</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Rounds</label>
              <input className="input" type="number" min={1} max={20} value={maxRounds} onChange={e => setMaxRounds(e.target.value)} />
            </div>
            <div>
              <label className="label">Start TP</label>
              <input className="input" type="number" min={1} max={50} value={startingTP} onChange={e => setStartingTP(e.target.value)} />
            </div>
            <div>
              <label className="label">Bribes</label>
              <input className="input" type="number" min={0} max={20} value={startingBribes} onChange={e => setStartingBribes(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Gemini API Key <span className="text-white/25 normal-case tracking-normal">— optional, enables AI summaries</span></label>
            <input className="input" type="password" placeholder="AIza…" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button className="btn-secondary flex-1" onClick={() => setView('home')}>Back</button>
            <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create →'}
            </button>
          </div>
        </div>
      )}

      {view === 'join' && (
        <div className="card w-full max-w-sm space-y-5 p-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7FFF] font-semibold mb-1">Join</p>
            <h2 className="font-serif italic text-3xl text-white">Enter your code</h2>
            <p className="text-white/40 text-sm mt-1">Six characters, from your GM.</p>
          </div>
          <input
            className="input text-3xl tracking-[0.4em] uppercase font-bold text-center py-4"
            placeholder="WOLF42"
            maxLength={6}
            value={gameCode}
            onChange={e => setGameCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setView('home')}>Back</button>
            <button className="btn-primary flex-1" onClick={handleJoin} disabled={!gameCode.trim()}>
              Join →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
