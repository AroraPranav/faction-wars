export function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateToken(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const TEAM_COLORS = [
  '#EF4444', // red
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function getTeamColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

export const ACTION_META: Record<string, { label: string; color: string; border: string; bg: string; desc: string; needsTarget: boolean }> = {
  attack:    { label: 'ATTACK',    color: 'text-red-400',    border: 'border-red-500',    bg: 'bg-red-950/40',    desc: 'Steal 2 TP from a target faction.',              needsTarget: true  },
  defend:    { label: 'DEFEND',    color: 'text-green-400',  border: 'border-green-500',  bg: 'bg-green-950/40',  desc: 'Protect yourself from all attacks.',     needsTarget: false },
  spy:       { label: 'SPY',       color: 'text-blue-400',   border: 'border-blue-500',   bg: 'bg-blue-950/40',   desc: 'Learn what action a target faction submitted.',   needsTarget: true  },
  sabotage:  { label: 'SABOTAGE',  color: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-950/40', desc: "Disrupt a target faction's action, cancelling it.", needsTarget: true  },
  trade:     { label: 'TRADE',     color: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-950/40', desc: 'Cooperate — both factions gain +1 TP (must be mutual).', needsTarget: true  },
};

export const BRIBE_MENU = [
  { power: 'learn_last_action', cost: 1, label: "Learn a team's last action",           desc: 'GM privately reveals what the target did last round.' },
  { power: 'switch_action',     cost: 2, label: 'Switch your action last minute',        desc: 'Change your submitted action before resolution.' },
  { power: 'block_sabotage',    cost: 2, label: 'Block a Sabotage on you',               desc: 'Nullify one Sabotage targeting you this round.' },
  { power: 'force_reveal',      cost: 3, label: "Force a team to reveal their action",   desc: "Target faction's action is announced to all before resolution." },
  { power: 'steal_token',       cost: 4, label: 'Steal 1 token from another team',       desc: 'Directly take 1 bribe token from any faction.' },
  { power: 'immunity',          cost: 5, label: 'Immunity from attacks next round',      desc: 'Your faction cannot be targeted by Attack or Sabotage next round.' },
] as const;
