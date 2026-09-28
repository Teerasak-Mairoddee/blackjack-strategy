export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Card value 1–10, where an ace is 1 and every ten-value card is 10. */
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function cardValue(rank: Rank): CardValue {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank) as CardValue;
}

export function isTenValue(rank: Rank): boolean {
  return cardValue(rank) === 10;
}

export type HandValue = {
  total: number;
  softness: 'hard' | 'soft';
};

/** Aces count as 11 when that does not bust the hand, otherwise 1. */
export function handValue(ranks: readonly Rank[]): HandValue {
  let hard = 0;
  let hasAce = false;
  for (const r of ranks) {
    const v = cardValue(r);
    hard += v;
    if (v === 1) hasAce = true;
  }
  if (hasAce && hard + 10 <= 21) return { total: hard + 10, softness: 'soft' };
  return { total: hard, softness: 'hard' };
}

/**
 * A splittable pair is exactly two cards of the same rank. Ten-value cards pair
 * only with the same rank (K,K is a pair; K,Q is not) and share the "10" row.
 */
export function isPair(ranks: readonly Rank[]): boolean {
  return ranks.length === 2 && ranks[0] === ranks[1];
}

export function isNatural(ranks: readonly Rank[]): boolean {
  return ranks.length === 2 && handValue(ranks).total === 21;
}
