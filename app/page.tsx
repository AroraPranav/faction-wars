'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create game form
  const [maxRounds, setMaxRounds] = useState('12');
  const [startingTP, setStartingTP] = useState('10');
  const [startingBribes, setStartingBribes] = useState('5');
  const [geminiKey, setGeminiKey] = useState('');

  // Join form
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-block border-t-2 border-b-2 border-[#4F6EF5] py-3 px-8 mb-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-widest text-white">
            FACTION<br />WARS
          </h1>
        </div>
        <p className="text-white/40 italic mt-3 text-sm tracking-wider">
          A game of diplomacy, deception, and calculated aggression.
        </p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button className="btn-primary text-lg py-4 rounded-xl" onClick={() => setView('create')}>
            ⚔️ Create Game
          </button>
          <button className="btn-secondary text-lg py-4 rounded-xl" onClick={() => setView('join')}>
            🚩 Join a Game
          </button>
        </div>
      )}

      {view === 'create' && (
        <div className="card w-full max-w-md space-y-4">
          <h2 className="text-xl font-bold text-[#4F6EF5] mb-2">Game Setup</h2>

          <div>
            <label className="label">Max Rounds</label>
            <input className="input" type="number" min={1} max={20} value={maxRounds} onChange={e => setMaxRounds(e.target.value)} />
          </div>
          <div>
            <label className="label">Starting TP per team</label>
            <input className="input" type="number" min={1} max={50} value={startingTP} onChange={e => setStartingTP(e.target.value)} />
          </div>
          <div>
            <label className="label">Starting Bribe Tokens per team</label>
            <input className="input" type="number" min={0} max={20} value={startingBribes} onChange={e => setStartingBribes(e.target.value)} />
          </div>
          <div>
            <label className="label">Gemini API Key <span className="text-white/30">(optional — enables AI summaries)</span></label>
            <input className="input" type="password" placeholder="AIza..." value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setView('home')}>Back</button>
            <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create Game →'}
            </button>
          </div>
        </div>
      )}

      {view === 'join' && (
        <div className="card w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-[#4F6EF5]">Join a Game</h2>
          <p className="text-white/50 text-sm">Enter the 6-character game code from your GM.</p>
          <input
            className="input text-2xl tracking-widest uppercase font-bold text-center"
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
