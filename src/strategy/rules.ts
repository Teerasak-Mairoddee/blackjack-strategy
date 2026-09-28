export type Decks = 1 | 2 | 4 | 6 | 8;
export type DoubleRule = 'any' | '9-11' | '10-11';

export type Rules = {
  decks: Decks;
  /** Dealer hits soft 17. */
  h17: boolean;
  /** US peek (true) or European no-hole-card / no-peek (false). */
  peek: boolean;
  double: DoubleRule;
  /** Double after split. */
  das: boolean;
  lateSurrender: boolean;
  maxSplitHands: 2 | 3 | 4;
  resplitAces: boolean;
  hitSplitAces: boolean;
};

export const DECK_OPTIONS: readonly Decks[] = [1, 2, 4, 6, 8];
export const MAX_SPLIT_OPTIONS: readonly Rules['maxSplitHands'][] = [2, 3, 4];

export const DEFAULT_RULES: Rules = {
  decks: 6,
  h17: false,
  peek: true,
  double: 'any',
  das: true,
  lateSurrender: false,
  maxSplitHands: 4,
  resplitAces: false,
  hitSplitAces: false,
};

export type Preset = { id: string; label: string; note: string; rules: Rules };

// A preset is a fully specified starting configuration, not a claim about any casino.
export const PRESETS: readonly Preset[] = [
  {
    id: 'us-6d-s17',
    label: '6 decks · S17 · US peek · DAS',
    note: 'Double any two, no surrender, split to 4 hands, no resplit or hitting split aces.',
    rules: DEFAULT_RULES,
  },
  {
    id: 'us-6d-h17-ls',
    label: '6 decks · H17 · US peek · DAS · Late surrender',
    note: 'Double any two, split to 4 hands, no resplit or hitting split aces.',
    rules: { ...DEFAULT_RULES, h17: true, lateSurrender: true },
  },
  {
    id: 'us-2d-h17',
    label: '2 decks · H17 · US peek · DAS',
    note: 'Double any two, no surrender, split to 4 hands, no resplit or hitting split aces.',
    rules: { ...DEFAULT_RULES, decks: 2, h17: true },
  },
  {
    id: 'us-1d-h17',
    label: '1 deck · H17 · US peek · No DAS',
    note: 'Double any two, no surrender, split to 2 hands, no resplit or hitting split aces.',
    rules: { ...DEFAULT_RULES, decks: 1, h17: true, das: false, maxSplitHands: 2 },
  },
  {
    id: 'eu-enhc',
    label: 'UK/European no-hole-card · 6 decks · S17',
    note: 'No peek (doubled and split stakes lose to a dealer blackjack), double hard 9–11 only, DAS, no surrender, split to 4 hands, no resplit or hitting split aces.',
    rules: { ...DEFAULT_RULES, peek: false, double: '9-11' },
  },
];

export function sameRules(a: Rules, b: Rules): boolean {
  return (Object.keys(a) as (keyof Rules)[]).every((k) => a[k] === b[k]);
}

export function ruleSetId(r: Rules): string {
  return [
    `${r.decks}d`,
    r.h17 ? 'h17' : 's17',
    r.peek ? 'peek' : 'enhc',
    `dbl${r.double}`,
    r.das ? 'das' : 'nodas',
    r.lateSurrender ? 'ls' : 'nols',
    `sp${r.maxSplitHands}`,
    r.resplitAces ? 'rsa' : 'norsa',
    r.hitSplitAces ? 'hsa' : 'nohsa',
  ].join('-');
}

const DOUBLE_LABEL: Record<DoubleRule, string> = { any: 'Double any 2', '9-11': 'Double 9–11', '10-11': 'Double 10–11' };

export function rulesSummary(r: Rules): string {
  const parts = [
    `${r.decks} deck${r.decks === 1 ? '' : 's'}`,
    r.h17 ? 'H17' : 'S17',
    r.peek ? 'US peek' : 'No hole card',
    DOUBLE_LABEL[r.double],
    r.das ? 'DAS' : 'No DAS',
    r.lateSurrender ? 'Late surrender' : 'No surrender',
    `Split to ${r.maxSplitHands}`,
  ];
  if (r.resplitAces) parts.push('RSA');
  if (r.hitSplitAces) parts.push('Hit split aces');
  return parts.join(' · ');
}

/** Returns null when the combination is supported, or an explanation when it is not. */
export function unsupportedReason(r: Rules): string | null {
  // Every combination exposed in settings has generated strategy data (see tables.ts).
  if (!DECK_OPTIONS.includes(r.decks)) return `No strategy data for ${r.decks} decks.`;
  if (!MAX_SPLIT_OPTIONS.includes(r.maxSplitHands)) return `No strategy data for splitting to ${r.maxSplitHands} hands.`;
  return null;
}

export function parseRules(value: unknown): Rules | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const r: Rules = {
    decks: v.decks as Decks,
    h17: v.h17 as boolean,
    peek: v.peek as boolean,
    double: v.double as DoubleRule,
    das: v.das as boolean,
    lateSurrender: v.lateSurrender as boolean,
    maxSplitHands: v.maxSplitHands as Rules['maxSplitHands'],
    resplitAces: v.resplitAces as boolean,
    hitSplitAces: v.hitSplitAces as boolean,
  };
  const bools = [r.h17, r.peek, r.das, r.lateSurrender, r.resplitAces, r.hitSplitAces];
  if (bools.some((b) => typeof b !== 'boolean')) return null;
  if (!['any', '9-11', '10-11'].includes(r.double)) return null;
  if (unsupportedReason(r)) return null;
  return r;
}

/** Whether the table's doubling rule allows doubling on this two-card total. */
export function eligibleToDoubleTotal(rule: DoubleRule, total: number, softness: 'hard' | 'soft'): boolean {
  if (rule === 'any') return true;
  if (softness === 'soft') return false;
  return rule === '9-11' ? total >= 9 && total <= 11 : total >= 10 && total <= 11;
}
