export interface WorldEventDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  requiresShieldTarget?: boolean; // Shield Dome needs a faction selection
  addsBribeOption?: boolean;      // Chaos Market enables switch_action bribe
  requiresDeclaration?: boolean;  // Civil Unrest needs a declaration phase
}

export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: 'none',
    name: '— None —',
    description: 'No event this round. Standard rules apply.',
    emoji: '⚖️',
  },
  {
    id: 'reverse_strike',
    name: 'Reverse Strike',
    description: 'If an attacker targets a faction that Defends, the attacker loses 1 TP.',
    emoji: '⚔️',
  },
  {
    id: 'fog_of_war',
    name: 'Fog of War',
    description: 'Spy cards have no effect this round. Espionage is blind.',
    emoji: '🌫️',
  },
  {
    id: 'economic_boom',
    name: 'Economic Boom',
    description: 'Successful Trades give +2 TP to both parties instead of the usual +1.',
    emoji: '💰',
  },
  {
    id: 'defenseless',
    name: 'Defenseless',
    description: 'Defend is nullified. Every attack and sabotage lands — no exceptions.',
    emoji: '💥',
  },
  {
    id: 'sudden_reinforcements',
    name: 'Sudden Reinforcements',
    description: 'The faction(s) with the lowest TP receive +3 TP.',
    emoji: '🪖',
  },
  {
    id: 'double_trouble',
    name: 'Double Trouble',
    description: 'Sabotage also steals 1 TP from the target in addition to blocking their action.',
    emoji: '💣',
  },
  {
    id: 'power_vacuum',
    name: 'Power Vacuum',
    description: 'The current leader loses 2 TP; all other factions gain 1 TP.',
    emoji: '👑',
  },
  {
    id: 'chaos_market',
    name: 'Chaos Market',
    description: 'Teams may switch their submitted action by paying 2 bribe tokens before resolution.',
    emoji: '🎲',
    addsBribeOption: true,
  },
  {
    id: 'double_attack',
    name: 'Double Attack',
    description: 'Each faction may attack two different targets in one round.',
    emoji: '⚡',
  },
  {
    id: 'sudden_death',
    name: 'Sudden Death',
    description: 'Any faction reaching 0 TP or below this round is permanently eliminated.',
    emoji: '💀',
  },
  {
    id: 'shield_dome',
    name: 'Shield Dome',
    description: "One faction (GM's choice) is completely immune to all effects this round.",
    emoji: '🔵',
    requiresShieldTarget: true,
  },
  {
    id: 'counter_intel',
    name: 'Counter Intel',
    description: 'The spied-on team is notified they were spied on (but not who did it).',
    emoji: '🕵️',
  },
  {
    id: 'counterspy',
    name: 'Counterspy',
    description: 'If someone spies on a faction this round, the spied-on faction learns who the spy was.',
    emoji: '🔍',
  },
  {
    id: 'fortify',
    name: 'Fortify',
    description: 'Every faction that plays Defend gains +1 bonus TP at the end of the round.',
    emoji: '🏰',
  },
  {
    id: 'civil_unrest',
    name: 'Civil Unrest',
    description: 'Before submitting actions, each faction must publicly declare: Offensive, Defensive, or Neutral.',
    emoji: '📢',
    requiresDeclaration: true,
  },
  {
    id: 'silent_trade',
    name: 'Silent Trade',
    description: 'Trade details are kept private — only the GM sees the exchanges.',
    emoji: '🤫',
  },
  {
    id: 'saboteurs_echo',
    name: "Saboteur's Echo",
    description: "If your Sabotage is blocked by a Defend, you still steal 1 TP from the target.",
    emoji: '🔊',
  },
  {
    id: 'exposed_plans',
    name: 'Exposed Plans',
    description: 'All actions are publicly revealed to everyone before resolution begins.',
    emoji: '📋',
  },
];

export function getEvent(id: string | null): WorldEventDef {
  return WORLD_EVENTS.find(e => e.id === id) ?? WORLD_EVENTS[0];
}

export function randomEvent(): WorldEventDef {
  // Exclude 'none' from random picks to make it more exciting
  const pool = WORLD_EVENTS.filter(e => e.id !== 'none');
  return pool[Math.floor(Math.random() * pool.length)];
}
