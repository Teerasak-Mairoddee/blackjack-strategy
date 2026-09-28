import { handValue, isPair, type Rank } from './cards';
import { eligibleToDoubleTotal, ruleSetId, type Rules } from './rules';
import { pairRanking, pairRankingWithSplit, totalRanking } from './tables';


export type Move = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export type HandStatus = 'open' | 'stood' | 'doubled' | 'surrendered';

export type Hand = {
  cards: Rank[];
  fromSplit: boolean;
  isSplitAce: boolean;
  status: HandStatus;
};

export type Round = {
  dealer: Rank | null;
  hands: Hand[];
  active: number;
};

export type AdviceStatus = 'need-dealer' | 'need-cards' | 'advice' | 'terminal' | 'awaiting-double-card';

export type Advice = {
  status: AdviceStatus;
  move: Move | null;
  /** What to do when `move` is not offered at the table (e.g. double → hit). */
  fallback?: Move;
  total: number;
  softness: 'hard' | 'soft';
  pair: boolean;
  /** e.g. "Hard 13", "Soft 18", "Pair of 8s". */
  handLabel: string;
  reason: string;
  terminal?: 'blackjack' | 'twenty-one' | 'bust' | 'finished';
  ruleSetId: string;
};

/** Per-hand facts the strategy lookup needs; derived from the round, never from UI state. */
export type HandContext = {
  fromSplit: boolean;
  isSplitAce: boolean;
  /** Number of splits made so far in this round (hands − 1). */
  splitCount: number;
  /** Actions after the initial two cards: hits so far on this hand. */
  actionsTaken: number;
  doubleAvailable: boolean;
  splitAvailable: boolean;
  surrenderAvailable: boolean;
};

const LETTER: Record<string, Move> = { H: 'hit', S: 'stand', D: 'double', R: 'surrender', P: 'split' };

export function handContext(round: Round, rules: Rules, index = round.active): HandContext {
  const hand = round.hands[index];
  const splitCount = round.hands.length - 1;
  const two = hand.cards.length === 2 && hand.status === 'open';
  const { total, softness } = handValue(hand.cards);
  const doubleAvailable =
    two && (!hand.fromSplit || rules.das) && !hand.isSplitAce && eligibleToDoubleTotal(rules.double, total, softness);
  const splitAvailable =
    two &&
    isPair(hand.cards) &&
    round.hands.length < rules.maxSplitHands &&
    (hand.cards[0] !== 'A' || !hand.fromSplit || rules.resplitAces);
  const surrenderAvailable = two && rules.lateSurrender && !hand.fromSplit && round.hands.length === 1;
  return {
    fromSplit: hand.fromSplit,
    isSplitAce: hand.isSplitAce,
    splitCount,
    actionsTaken: Math.max(0, hand.cards.length - 2),
    doubleAvailable,
    splitAvailable,
    surrenderAvailable,
  };
}

function rankLabel(r: Rank): string {
  return r;
}

function describeHand(cards: Rank[], total: number, softness: 'hard' | 'soft'): string {
  if (isPair(cards)) return `Pair of ${rankLabel(cards[0])}s`;
  return `${softness === 'soft' ? 'Soft' : 'Hard'} ${total}`;
}

const VERB: Record<Move, string> = {
  hit: 'Hitting',
  stand: 'Standing',
  double: 'Doubling',
  split: 'Splitting',
  surrender: 'Surrendering',
};

const UNAVAILABLE: Record<Move, string> = {
  hit: 'hitting',
  stand: 'standing',
  double: 'doubling',
  split: 'splitting',
  surrender: 'surrender',
};

export function recommend(round: Round, rules: Rules): Advice {
  const id = ruleSetId(rules);
  const hand = round.hands[round.active] ?? { cards: [], fromSplit: false, isSplitAce: false, status: 'open' as const };
  const { total, softness } = handValue(hand.cards);
  const pair = isPair(hand.cards);
  const handLabel = hand.cards.length ? describeHand(hand.cards, total, softness) : '';
  const base = { total, softness, pair, handLabel, ruleSetId: id, move: null } as const;

  if (!round.dealer) {
    return { ...base, status: 'need-dealer', reason: 'Select dealer upcard' };
  }
  if (hand.cards.length < 2) {
    const reason = hand.fromSplit
      ? 'Select the next card dealt to this hand'
      : hand.cards.length === 0
        ? 'Select your two cards'
        : 'Select your second card';
    return { ...base, status: 'need-cards', reason };
  }
  if (total > 21) {
    return { ...base, status: 'terminal', terminal: 'bust', reason: `Bust with ${total}.` };
  }
  if (total === 21) {
    const natural = hand.cards.length === 2 && !hand.fromSplit && round.hands.length === 1;
    return natural
      ? { ...base, status: 'terminal', terminal: 'blackjack', handLabel: 'Blackjack', reason: 'Two-card natural blackjack.' }
      : { ...base, status: 'terminal', terminal: 'twenty-one', reason: 'Twenty-one. This hand is done.' };
  }
  if (hand.status === 'stood') return { ...base, status: 'terminal', terminal: 'finished', reason: `Stood on ${total}.` };
  if (hand.status === 'surrendered') return { ...base, status: 'terminal', terminal: 'finished', reason: 'Hand surrendered.' };
  if (hand.status === 'doubled') {
    return hand.cards.length >= 3
      ? { ...base, status: 'terminal', terminal: 'finished', reason: `Doubled; finished on ${total}.` }
      : { ...base, status: 'awaiting-double-card', reason: 'Doubled: select the one card dealt to this hand.' };
  }

  const ctx = handContext(round, rules);
  const restrictedAce = hand.isSplitAce && !rules.hitSplitAces;
  if (restrictedAce && !ctx.splitAvailable) {
    return { ...base, status: 'terminal', terminal: 'finished', reason: 'Split aces receive one card each under these rules.' };
  }

  const up = round.dealer;
  let ranking: string;
  if (pair && ctx.splitAvailable) ranking = pairRankingWithSplit(rules, hand.cards[0], up);
  else if (pair) ranking = pairRanking(rules, hand.cards[0], up);
  else ranking = totalRanking(rules, softness, total, up);

  const legal: Record<string, boolean> = {
    H: !restrictedAce,
    S: true,
    D: ctx.doubleAvailable,
    R: ctx.surrenderAvailable,
    P: ctx.splitAvailable,
  };
  const order = ranking.split('');
  const moveLetter = order.find((m) => legal[m]) ?? 'S';
  const move = LETTER[moveLetter];

  let fallback: Move | undefined;
  if (moveLetter === 'D' || moveLetter === 'R' || moveLetter === 'P') {
    const next = order.find((m) => m !== moveLetter && legal[m]);
    if (next) fallback = LETTER[next];
  }

  const upLabel = rankLabel(up);
  const parts: string[] = [];
  const preferred = LETTER[order[0]];
  if (preferred !== move) {
    parts.push(`${cap(UNAVAILABLE[preferred])} isn't available here, so ${move}.`);
  } else {
    parts.push(`${VERB[move]} has the best expected result for ${handLabel.toLowerCase()} against ${upLabel}.`);
  }
  if (ctx.actionsTaken > 0) parts.push('After a hit, only hit or stand remain.');

  return { ...base, status: 'advice', move, fallback, reason: parts.join(' ') };
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function fallbackText(advice: Advice): string | null {
  if (!advice.move || !advice.fallback) return null;
  const f = advice.fallback;
  if (advice.move === 'double') return `Double if allowed; otherwise ${f}.`;
  if (advice.move === 'surrender') return `Surrender if allowed; otherwise ${f}.`;
  if (advice.move === 'split') return `Split if allowed; otherwise ${f}.`;
  return null;
}
