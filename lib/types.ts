export type ActionType = 'attack' | 'defend' | 'spy' | 'sabotage' | 'trade';
export type GameStatus = 'lobby' | 'round_setup' | 'round_active' | 'round_locked' | 'round_resolved' | 'finished';
export type BribePower =
  | 'learn_last_action'
  | 'switch_action'
  | 'block_sabotage'
  | 'force_reveal'
  | 'steal_token'
  | 'immunity';
export type Declaration = 'offensive' | 'defensive' | 'neutral';

export interface Team {
  id: string;
  token: string;
  name: string;
  color: string;
  tp: number;
  bribes: number;
  eliminated: boolean;
  immune: boolean;           // 5-token bribe immunity (active this round)
  tradePartners: string[];   // team IDs traded with last round
}

export interface Action {
  type: ActionType;
  target?: string;   // teamId
  target2?: string;  // for Double Attack event
  submittedAt: number;
}

export interface BribeRequest {
  id: string;
  teamId: string;
  power: BribePower;
  targetTeamId?: string;
  newAction?: ActionType;    // for switch_action
  newTarget?: string;        // for switch_action — new target (teamId) when the switched-to action needs one
  revealedAction?: { type: ActionType; target?: string }; // for force_reveal — snapshot of target's action at GM approval
  cost: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface SpyResult {
  spyTeamId: string;
  targetTeamId: string;
  actionType: ActionType;
  actionTarget?: string;
  // For counterspy/counter_intel events
  counterspy?: boolean;   // spied-on team learns who spied
  counterIntel?: boolean; // spied-on team knows they were spied (but not who)
  narration?: string;     // Gemini-generated Hinglish intel report (shown to the spy)
}

export interface ResolvedRound {
  roundNumber: number;
  worldEvent: string | null;
  shieldDomeFaction?: string;
  actions: Record<string, Action>;
  bribeRequests: BribeRequest[];
  tpBefore: Record<string, number>;
  tpAfter: Record<string, number>;
  tpDeltas: Record<string, number>;
  spyResults: SpyResult[];
  log: string[];
  geminiSummary?: string;
  resolvedAt: number;
}

export interface Game {
  id: string;          // gameCode e.g. "WOLF42"
  gmToken: string;     // long random token for GM URL
  status: GameStatus;
  settings: {
    maxRounds: number;
    startingTP: number;
    startingBribes: number;
    maxTeams: number;
    geminiKey?: string;
  };
  currentRound: number;
  teams: Team[];
  // Current round state
  currentActions: Record<string, Action>;
  currentBribes: BribeRequest[];
  currentWorldEvent: string | null;
  currentShieldDome?: string;
  currentDeclarations: Record<string, Declaration>; // for Civil Unrest event
  // History
  roundHistory: ResolvedRound[];
  // Undo stack (up to 5 snapshots before last resolutions)
  undoStack: string[]; // JSON-serialized Game snapshots
  // When false, players cannot see TP / standings / deltas — GM reveals on demand
  pointsVisible: boolean;
  createdAt: number;
}

// What the team polling endpoint returns
export interface TeamGameState {
  status: GameStatus;
  currentRound: number;
  maxRounds: number;
  worldEvent: string | null;
  teams: Array<{
    id: string;
    name: string;
    color: string;
    tp: number;
    bribes: number;
    eliminated: boolean;
    isTradePartner: boolean; // relative to this team
  }>;
  myTeam: {
    id: string;
    name: string;
    color: string;
    tp: number;
    bribes: number;
    immune: boolean;
    tradePartners: string[];
  };
  submittedTeamIds: string[];   // who has submitted (not what)
  declarations: Record<string, Declaration>;
  hasSubmitted: boolean;
  spyIntel?: SpyResult;         // shown after round_resolved
  lastRoundLog?: string[];
  lastRoundDeltas?: Record<string, number>;
  exposedActions?: Record<string, Action>; // Exposed Plans event
  counterspyInfo?: { spiedByTeamId: string; spiedByTeamName: string } | null;
  counterIntelInfo?: boolean;   // you were spied on (Counter Intel event)
  pointsVisible: boolean;       // when false, hide all TP / standings / deltas from players
  spyIntelNarration?: string;   // Hinglish narration for the spy
  // Force-reveal intel — only delivered to the team that paid for it, as soon as the GM approves.
  forceRevealResults?: Array<{ targetTeamId: string; actionType: ActionType; actionTarget?: string }>;
}
