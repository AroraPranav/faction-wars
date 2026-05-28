'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage({ params }: { params: { gameCode: string } }) {
  const router = useRouter();
  const gameCode = params.gameCode.toUpperCase();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/game/${gameCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/play/${gameCode}/${data.teamToken}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <p className="text-white/40 text-sm tracking-widest uppercase mb-1">Joining Game</p>
        <div className="text-4xl font-black tracking-widest text-[#4F6EF5]">{gameCode}</div>
      </div>

      <div className="card w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold">Choose your faction name</h2>
        <p className="text-white/40 text-sm">Pick something intimidating. You'll need it.</p>

        <input
          className="input text-xl font-bold"
          placeholder="e.g. Iron Wolves"
          maxLength={20}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          autoFocus
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          className="btn-primary w-full py-3 text-base"
          onClick={handleJoin}
          disabled={!name.trim() || loading}
        >
          {loading ? 'Joining...' : '⚔️ Enter the War'}
        </button>
      </div>
    </main>
  );
}
