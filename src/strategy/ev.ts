/**
 * Expected-value model used to generate the bundled basic-strategy data.
 *
 * This module is only run at data-generation time (scripts/generate-tables.ts)
 * and in tests. The app itself ships the generated data, not this calculator.
 *
 * Model scope (documented in README "Strategy data"):
 * - Finite shoe of `decks` decks. The dealer upcard and the player's first two
 *   cards are removed from the shoe. The dealer's own draws remove cards as they
 *   are dealt (exact dealer probabilities for that shoe). The player's first
 *   drawn card (double or first hit) is also removed; later hits are not.
 * - Hard/soft cells are total-dependent: the EV of each move is averaged over
 *   every non-pair two-card composition that makes the total, weighted by how
 *   likely that composition is to be dealt.
 * - US peek: EVs are conditioned on the dealer not holding blackjack.
 *   No-hole-card: the player loses every stake (including doubles and splits)
 *   to a dealer blackjack.
 * - Splits: each split hand's EV is computed with the DAS, hit-split-aces and
 *   double-eligibility rules; resplits up to the hand limit are modelled by the
 *   expected number of hands that start with a pair card.
 */
import type { DoubleRule } from './rules';

export type Shoe = number[]; // index 1..10 (1 = ace, 10 = ten-values); index 0 unused
export type MoveCode = 'H' | 'S' | 'D' | 'R' | 'P';

export function fullShoe(decks: number): Shoe {
  const s = new Array(11).fill(0);
  for (let v = 1; v <= 9; v++) s[v] = 4 * decks;
  s[10] = 16 * decks;
  return s;
}

function best(hard: number, ace: boolean): { total: number; soft: boolean } {
  if (ace && hard + 10 <= 21) return { total: hard + 10, soft: true };
  return { total: hard, soft: false };
}

/** Index 0..4 = dealer finishes on 17..21, 5 = bust, 6 = blackjack. Unconditioned. */
export type DealerDist = number[];

export function dealerDist(shoe: Shoe, up: number, h17: boolean): DealerDist {
  const counts = shoe.slice();
  let left = counts.reduce((a, b) => a + b, 0);
  const memo = new Map<number, number[]>();
  const MUL = [0, 1, 32, 32 ** 2, 32 ** 3, 32 ** 4, 32 ** 5, 32 ** 6, 32 ** 7, 32 ** 8, 32 ** 9];

  function rec(hard: number, ace: boolean, n: number, key: number): number[] {
    const b = best(hard, ace);
    if (n === 2 && b.total === 21) return [0, 0, 0, 0, 0, 0, 1];
    if (b.total > 21) return [0, 0, 0, 0, 0, 1, 0];
    if (b.total >= 17 && !(b.total === 17 && b.soft && h17)) {
      const out = [0, 0, 0, 0, 0, 0, 0];
      out[b.total - 17] = 1;
      return out;
    }
    const cached = memo.get(key);
    if (cached) return cached;
    const out = [0, 0, 0, 0, 0, 0, 0];
    for (let c = 1; c <= 10; c++) {
      if (counts[c] === 0) continue;
      const p = counts[c] / left;
      counts[c]--;
      left--;
      const r = rec(hard + c, ace || c === 1, n + 1, key + MUL[c]);
      counts[c]++;
      left++;
      for (let i = 0; i < 7; i++) out[i] += p * r[i];
    }
    memo.set(key, out);
    return out;
  }

  return rec(up, up === 1, 1, 0);
}

/** The dealer's final-total distribution given no dealer blackjack (index 0..4 = 17..21, 5 = bust). */
function conditioned(d: DealerDist): number[] {
  const nb = 1 - d[6];
  return d.slice(0, 6).map((x) => x / nb);
}

export class PlayerModel {
  private q: number[];
  private cond: number[];
  private optMemo = new Map<number, number>();

  /**
   * Player draw probabilities come from the shoe given that the dealer's hole card
   * does not complete a blackjack (with an A or 10 up, the hole card is known not to
   * be the matching card once the round continues).
   */
  constructor(shoe: Shoe, dist: DealerDist, up: number) {
    const n = shoe.reduce((a, b) => a + b, 0);
    const bjCard = up === 1 ? 10 : up === 10 ? 1 : 0;
    if (bjCard === 0) {
      this.q = shoe.map((x) => x / n);
    } else {
      const q = new Array(11).fill(0);
      const holeTotal = n - shoe[bjCard];
      for (let h = 1; h <= 10; h++) {
        if (h === bjCard || shoe[h] === 0) continue;
        const ph = shoe[h] / holeTotal;
        for (let c = 1; c <= 10; c++) q[c] += (ph * (shoe[c] - (c === h ? 1 : 0))) / (n - 1);
      }
      this.q = q;
    }
    this.cond = conditioned(dist);
  }

  stand(total: number): number {
    if (total > 21) return -1;
    const d = this.cond;
    let ev = d[5];
    for (let i = 0; i < 5; i++) {
      const t = 17 + i;
      ev += d[i] * (total > t ? 1 : total === t ? 0 : -1);
    }
    return ev;
  }

  /** EV of standing or hitting optimally from this hand (no double). */
  optimal(hard: number, ace: boolean): number {
    const b = best(hard, ace);
    if (b.total > 21) return -1;
    const key = hard * 2 + (ace ? 1 : 0);
    const cached = this.optMemo.get(key);
    if (cached !== undefined) return cached;
    const v = Math.max(this.stand(b.total), this.hit(hard, ace));
    this.optMemo.set(key, v);
    return v;
  }

  hit(hard: number, ace: boolean): number {
    let ev = 0;
    for (let c = 1; c <= 10; c++) ev += this.q[c] * this.optimal(hard + c, ace || c === 1);
    return ev;
  }

  double(hard: number, ace: boolean): number {
    let ev = 0;
    for (let c = 1; c <= 10; c++) ev += this.q[c] * this.stand(best(hard + c, ace || c === 1).total);
    return 2 * ev;
  }

  prob(c: number): number {
    return this.q[c];
  }
}

export type MoveEVs = { H: number; S: number; D: number; R: number };

/** Conditioned EVs for an untouched two-card hand, then adjusted for no-peek exposure. */
export function twoCardEVs(decks: number, h17: boolean, peek: boolean, up: number, a: number, b: number, dist?: DealerDist): MoveEVs {
  const { ev, pbj } = twoCardConditionedEVs(decks, h17, up, a, b, dist);
  return peek ? ev : exposeToBlackjack(ev, pbj);
}

/**
 * EVs given no dealer blackjack. The player's first drawn card (the double card,
 * or the first hit) is also removed from the dealer's shoe; later hits use the
 * shoe after that removal.
 */
export function twoCardConditionedEVs(decks: number, h17: boolean, up: number, a: number, b: number, dist?: DealerDist): { ev: MoveEVs; pbj: number } {
  const shoe = fullShoe(decks);
  shoe[up]--;
  shoe[a]--;
  shoe[b]--;
  const d = dist ?? dealerDist(shoe, up, h17);
  const m = new PlayerModel(shoe, d, up);
  const hard = a + b;
  const ace = a === 1 || b === 1;
  let H = 0;
  let D = 0;
  for (let c = 1; c <= 10; c++) {
    const qc = m.prob(c);
    if (qc === 0) continue;
    const next = shoe.slice();
    next[c]--;
    const m2 = new PlayerModel(next, dealerDist(next, up, h17), up);
    D += qc * m2.stand(best(hard + c, ace || c === 1).total);
    H += qc * m2.optimal(hard + c, ace || c === 1);
  }
  const ev: MoveEVs = { S: m.stand(best(hard, ace).total), H, D: 2 * D, R: -0.5 };
  return { ev, pbj: d[6] };
}

export function exposeToBlackjack(ev: MoveEVs, pbj: number): MoveEVs {
  if (pbj === 0) return ev;
  const f = (x: number, stake: number) => -stake * pbj + (1 - pbj) * x;
  return { S: f(ev.S, 1), H: f(ev.H, 1), D: f(ev.D, 2), R: f(ev.R, 1) };
}

export function eligibleToDouble(rule: DoubleRule, hard: number, ace: boolean): boolean {
  if (rule === 'any') return true;
  const b = best(hard, ace);
  if (b.soft) return false;
  return rule === '9-11' ? b.total >= 9 && b.total <= 11 : b.total >= 10 && b.total <= 11;
}

export type SplitOptions = {
  das: boolean;
  hitSplitAces: boolean;
  double: DoubleRule;
  maxSplitHands: number;
  resplitAces: boolean;
};

/** Expected number of final hands that did not / did start with a second pair card. */
export function expectedSplitHands(q: number, maxHands: number): { np: number; pp: number } {
  const memo = new Map<string, [number, number]>();
  function e(h: number, pending: number): [number, number] {
    if (pending === 0) return [0, 0];
    const key = `${h},${pending}`;
    const c = memo.get(key);
    if (c) return c;
    let out: [number, number];
    if (h < maxHands) {
      const a = e(h + 1, pending + 1);
      const b = e(h, pending - 1);
      out = [q * a[0] + (1 - q) * (1 + b[0]), q * a[1] + (1 - q) * b[1]];
    } else {
      const b = e(h, pending - 1);
      out = [1 - q + b[0], q + b[1]];
    }
    memo.set(key, out);
    return out;
  }
  const [np, pp] = e(2, 2);
  return { np, pp };
}

/** EV of splitting a pair of `p` (card value) against `up`. */
export function splitEV(decks: number, h17: boolean, peek: boolean, up: number, p: number, opts: SplitOptions, dist?: DealerDist): number {
  const shoe = fullShoe(decks);
  shoe[up]--;
  shoe[p] -= 2;
  const d = dist ?? dealerDist(shoe, up, h17);
  const m = new PlayerModel(shoe, d, up);
  const isAce = p === 1;

  const handValue = (c: number): number => {
    const hard = p + c;
    const ace = isAce || c === 1;
    const total = best(hard, ace).total;
    if (isAce && !opts.hitSplitAces) return m.stand(total);
    let v = Math.max(m.stand(total), m.hit(hard, ace));
    if (!isAce && opts.das && eligibleToDouble(opts.double, hard, ace)) v = Math.max(v, m.double(hard, ace));
    return v;
  };

  const qp = m.prob(p);
  let npSum = 0;
  for (let c = 1; c <= 10; c++) if (c !== p) npSum += m.prob(c) * handValue(c);
  const vNp = npSum / (1 - qp);
  const vP = handValue(p);
  const maxHands = !isAce || opts.resplitAces ? opts.maxSplitHands : 2;
  const { np, pp } = expectedSplitHands(qp, maxHands);
  const ev = np * vNp + pp * vP;
  if (peek) return ev;
  return -(np + pp) * d[6] + (1 - d[6]) * ev;
}

export function rankMoves(ev: Partial<Record<MoveCode, number>>): string {
  return (Object.keys(ev) as MoveCode[]).sort((a, b) => (ev[b] as number) - (ev[a] as number)).join('');
}
