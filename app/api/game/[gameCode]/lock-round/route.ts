import { NextRequest, NextResponse } from 'next/server';
import { getGameByGmToken, saveGame } from '@/lib/kv';

// Phase 1 of the two-phase resolve: the GM locks submitted actions. No new
// first-time submissions are accepted after this; the only change still possible
// is a paid Chaos Market switch. The GM then reviews and clicks Resolve.
export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  const { gmToken, unlock = false } = await req.json();
  const gameCode = params.gameCode.toUpperCase();

  const game = await getGameByGmToken(gmToken);
  if (!game || game.id !== gameCode) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (unlock) {
    // Reopen the round so teams can keep submitting.
    if (game.status !== 'round_locked') {
      return NextResponse.json({ error: 'Round is not locked' }, { status: 400 });
    }
    await saveGame({ ...game, status: 'round_active' });
    return NextResponse.json({ ok: true, status: 'round_active' });
  }

  if (game.status !== 'round_active') {
    return NextResponse.json({ error: 'Round is not active' }, { status: 400 });
  }

  await saveGame({ ...game, status: 'round_locked' });
  return NextResponse.json({ ok: true, status: 'round_locked' });
}
