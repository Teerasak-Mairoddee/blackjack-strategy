import { describe, expect, it } from 'vitest';
import stored from '../src/strategy/data/strategy-v1.json';
import { handValue, isPair, RANKS, type Rank } from '../src/strategy/cards';
import { recommend, type Hand, type Round } from '../src/strategy/engine';
import { twoCardEVs } from '../src/strategy/ev';
import { generateStrategyData } from '../src/strategy/generate';
import { DEFAULT_RULES, PRESETS, type Rules } from '../src/strategy/rules';
import { pairRankingWithSplit, totalRanking } from '../src/strategy/tables';
import { MULTI_DECK_S17_DAS_LS, multiDeckH17DasLs, multiDeckS17NoDas, type Grid } from './reference';

const UPS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

function hand(cards: Rank[], extra: Partial<Hand> = {}): Hand {
  return { cards, fromSplit: false, isSplitAce: false, status: 'open', ...extra };
}

function round(dealer: Rank | null, cards: Rank[], extra: Partial<Round> = {}): Round {
  return { dealer, hands: [hand(cards)], active: 0, ...extra };
}

/** Collapse a ranking into the reference chart's code (preferred move + fallback). */
function code(ranking: string): string {
  const [first] = ranking;
  if (first === 'D' || first === 'R') {
    const next = ranking.slice(1).replace(/[DRP]/g, '')[0];
    return first + next.toLowerCase();
  }
  return first;
}

function pairCode(ranking: string): string {
  if (ranking[0] === 'P') return 'P';
  if (ranking[0] === 'R' && ranking[1] === 'P') return 'Rp';
  return '-';
}

function compareGrid(rules: Rules, ref: { hard: Grid; soft: Grid; pairs: Grid }) {
  const diffs: string[] = [];
  for (const [total, cells] of Object.entries(ref.hard)) {
    UPS.forEach((up, i) => {
      const got = code(totalRanking(rules, 'hard', Number(total), up));
      if (got !== cells[i]) diffs.push(`hard ${total} v ${up}: got ${got}, want ${cells[i]}`);
    });
  }
  for (const [total, cells] of Object.entries(ref.soft)) {
    UPS.forEach((up, i) => {
      const got = code(totalRanking(rules, 'soft', Number(total), up));
      if (got !== cells[i]) diffs.push(`soft ${total} v ${up}: got ${got}, want ${cells[i]}`);
    });
  }
  for (const [p, cells] of Object.entries(ref.pairs)) {
    UPS.forEach((up, i) => {
      const got = pairCode(pairRankingWithSplit(rules, p as Rank, up));
      if (got !== cells[i]) diffs.push(`pair ${p} v ${up}: got ${got}, want ${cells[i]}`);
    });
  }
  return diffs;
}

describe('cards', () => {
  it('counts aces as 11 unless that busts', () => {
    expect(handValue(['A', '7'])).toEqual({ total: 18, softness: 'soft' });
    expect(handValue(['A', '7', '5'])).toEqual({ total: 13, softness: 'hard' });
    expect(handValue(['A', 'A', '9'])).toEqual({ total: 21, softness: 'soft' });
  });
  it('recognises pairs only as exactly two cards of one rank', () => {
    expect(isPair(['8', '8'])).toBe(true);
    expect(isPair(['K', 'K'])).toBe(true);
    expect(isPair(['K', 'Q'])).toBe(false);
    expect(isPair(['8', '8', 'K'])).toBe(false);
  });
});

describe('spec examples (6 decks, S17, peek, DAS, no surrender)', () => {
  const r = DEFAULT_RULES;
  const cases: [Rank, Rank[], string][] = [
    ['K', ['K', '3'], 'hit'],
    ['K', ['K', '3', '2'], 'hit'],
    ['4', ['5', '4'], 'double'],
    ['4', ['9', '9'], 'split'],
    ['10', ['8', '8'], 'split'],
    ['6', ['A', '7'], 'double'],
    ['6', ['A', '7', '2'], 'stand'],
    ['10', ['10', '10'], 'stand'],
  ];
  it.each(cases)('dealer %s, player %j → %s', (up, cards, move) => {
    const a = recommend(round(up, cards), r);
    expect(a.status).toBe('advice');
    expect(a.move).toBe(move);
  });

  it('K,3,2 is hard 15 and cannot double or split', () => {
    const a = recommend(round('K', ['K', '3', '2']), r);
    expect(a.total).toBe(15);
    expect(a.softness).toBe('hard');
    expect(a.pair).toBe(false);
  });

  it('A,K on an initial hand is blackjack', () => {
    const a = recommend(round('5', ['A', 'K']), r);
    expect(a.status).toBe('terminal');
    expect(a.terminal).toBe('blackjack');
  });

  it('10,6,8 is bust', () => {
    const a = recommend(round('10', ['10', '6', '8']), r);
    expect(a.terminal).toBe('bust');
    expect(a.total).toBe(24);
  });

  it('a three-card 16 containing two 8s is not a pair', () => {
    const a = recommend(round('10', ['8', '8']), r);
    expect(a.pair).toBe(true);
    expect(a.move).toBe('split');
    // A three-card hand containing two 8s is scored as a total, never as a pair.
    const c = recommend(round('7', ['8', 'A', '8']), r);
    expect(c.total).toBe(17);
    expect(c.pair).toBe(false);
    expect(c.move).toBe('stand');
  });

  it('A,7,2 soft 20 stands with no double offered', () => {
    const a = recommend(round('6', ['A', '7', '2']), r);
    expect(a.total).toBe(20);
    expect(a.softness).toBe('soft');
    expect(a.fallback).toBeUndefined();
  });

  it('gives an explicit fallback for doubles', () => {
    const a = recommend(round('6', ['A', '7']), r);
    expect(a.fallback).toBe('stand');
    const b = recommend(round('4', ['5', '4']), r);
    expect(b.fallback).toBe('hit');
  });

  it('asks for the dealer upcard first', () => {
    expect(recommend(round(null, ['K', '3']), r).status).toBe('need-dealer');
    expect(recommend(round('K', ['K']), r).status).toBe('need-cards');
  });
});

describe('generated data', () => {
  it('matches a fresh run of the EV generator', () => {
    expect(generateStrategyData()).toEqual(stored);
  }, 600_000);

  it('has a table for every rules combination in settings', () => {
    for (const decks of [1, 2, 4, 6, 8] as const)
      for (const h17 of [false, true])
        for (const peek of [false, true])
          for (const double of ['any', '9-11', '10-11'] as const)
            for (const das of [false, true])
              for (const maxSplitHands of [2, 3, 4] as const)
                for (const resplitAces of [false, true])
                  for (const hitSplitAces of [false, true]) {
                    const rules: Rules = { decks, h17, peek, double, das, lateSurrender: true, maxSplitHands, resplitAces, hitSplitAces };
                    for (const up of UPS) {
                      expect(() => totalRanking(rules, 'hard', 12, up)).not.toThrow();
                      expect(() => pairRankingWithSplit(rules, '8', up)).not.toThrow();
                    }
                  }
  });
});

describe('full grid comparison against reference decisions', () => {
  it('6 decks S17 DAS late surrender', () => {
    const rules: Rules = { ...DEFAULT_RULES, lateSurrender: true };
    expect(compareGrid(rules, MULTI_DECK_S17_DAS_LS)).toEqual([]);
  });

  it('6 decks H17 DAS late surrender', () => {
    const rules: Rules = { ...DEFAULT_RULES, h17: true, lateSurrender: true };
    expect(compareGrid(rules, multiDeckH17DasLs())).toEqual([]);
  });

  it('6 decks S17 without DAS', () => {
    const rules: Rules = { ...DEFAULT_RULES, das: false, lateSurrender: true };
    expect(compareGrid(rules, multiDeckS17NoDas())).toEqual([]);
  });

  it('4 decks S17 DAS matches the 4–8 deck reference', () => {
    const rules: Rules = { ...DEFAULT_RULES, decks: 4, lateSurrender: true };
    expect(compareGrid(rules, MULTI_DECK_S17_DAS_LS)).toEqual([]);
  });

  it('8 decks S17 DAS matches the combined 4–8 deck reference except one documented near-tie', () => {
    const rules: Rules = { ...DEFAULT_RULES, decks: 8, lateSurrender: true };
    expect(compareGrid(rules, MULTI_DECK_S17_DAS_LS)).toEqual(['soft 13 v 5: got H, want Dh']);
    // The combined chart is not specific to 8 decks; here hit and double differ by < 0.001 units.
    const ev = twoCardEVs(8, false, true, 5, 1, 2);
    expect(Math.abs(ev.H - ev.D)).toBeLessThan(0.001);
  });
});

describe('rule-sensitive decisions', () => {
  const move = (rules: Rules, up: Rank, cards: Rank[]) => recommend(round(up, cards), rules).move;

  it('deck count: hard 11 v A and hard 9 v 2 double in 1–2 decks but not 6 (S17)', () => {
    for (const decks of [1, 2] as const) {
      expect(move({ ...DEFAULT_RULES, decks }, 'A', ['6', '5'])).toBe('double');
      expect(move({ ...DEFAULT_RULES, decks }, '2', ['6', '3'])).toBe('double');
    }
    expect(move(DEFAULT_RULES, 'A', ['6', '5'])).toBe('hit');
    expect(move(DEFAULT_RULES, '2', ['6', '3'])).toBe('hit');
  });

  it('S17 vs H17: hard 11 v A', () => {
    expect(move({ ...DEFAULT_RULES, h17: true }, 'A', ['7', '4'])).toBe('double');
    expect(move(DEFAULT_RULES, 'A', ['7', '4'])).toBe('hit');
  });

  it('peek vs no hole card: hard 11 v 10 and A,A v A', () => {
    const enhc: Rules = { ...DEFAULT_RULES, peek: false };
    expect(move(DEFAULT_RULES, '10', ['7', '4'])).toBe('double');
    expect(move(enhc, '10', ['7', '4'])).toBe('hit');
    expect(move(DEFAULT_RULES, 'A', ['A', 'A'])).toBe('split');
    expect(move(enhc, 'A', ['A', 'A'])).toBe('hit');
  });

  it('DAS: 4,4 v 5 splits only with DAS', () => {
    expect(move(DEFAULT_RULES, '5', ['4', '4'])).toBe('split');
    expect(move({ ...DEFAULT_RULES, das: false }, '5', ['4', '4'])).not.toBe('split');
  });

  it('limited doubling uses the cell fallback', () => {
    const r: Rules = { ...DEFAULT_RULES, double: '10-11' };
    expect(move(r, '4', ['5', '4'])).toBe('hit');
    expect(move(r, '6', ['A', '7'])).toBe('stand');
    expect(move(r, '6', ['7', '3'])).toBe('double');
    const a = recommend(round('6', ['A', '7']), r);
    expect(a.reason).toMatch(/Doubling isn't available/);
  });

  it('surrender appears only when the rules allow it', () => {
    expect(move(DEFAULT_RULES, '10', ['10', '6'])).toBe('hit');
    expect(move({ ...DEFAULT_RULES, lateSurrender: true }, '10', ['10', '6'])).toBe('surrender');
    expect(recommend(round('10', ['10', '6']), { ...DEFAULT_RULES, lateSurrender: true }).fallback).toBe('hit');
    // not after a hit
    expect(move({ ...DEFAULT_RULES, lateSurrender: true }, '10', ['10', '4', '2'])).not.toBe('surrender');
  });

  it('never offers an illegal move for any preset, hand and upcard', () => {
    for (const p of PRESETS) {
      for (const up of UPS) {
        for (const a of RANKS) {
          for (const b of RANKS) {
            const adv = recommend(round(up, [a, b]), p.rules);
            if (adv.move === 'surrender') expect(p.rules.lateSurrender).toBe(true);
            if (adv.move === 'split') expect(a).toBe(b);
            const three = recommend(round(up, [a, b, '2']), p.rules);
            if (three.status === 'advice') expect(['hit', 'stand']).toContain(three.move);
          }
        }
      }
    }
  });
});

describe('split hands', () => {
  const r = DEFAULT_RULES;
  it('uses DAS for split hands and blocks doubling without DAS', () => {
    const split: Round = { dealer: '6', hands: [hand(['9', '2'], { fromSplit: true }), hand(['9'], { fromSplit: true })], active: 0 };
    expect(recommend(split, r).move).toBe('double');
    expect(recommend(split, { ...r, das: false }).move).toBe('hit');
  });

  it('a 21 after a split is not blackjack', () => {
    const split: Round = { dealer: '6', hands: [hand(['A', 'K'], { fromSplit: true, isSplitAce: true }), hand(['A'], { fromSplit: true, isSplitAce: true })], active: 0 };
    expect(recommend(split, r).terminal).toBe('twenty-one');
  });

  it('split aces finish after one card unless hitting split aces is allowed', () => {
    const split: Round = { dealer: '6', hands: [hand(['A', '5'], { fromSplit: true, isSplitAce: true }), hand(['A'], { fromSplit: true, isSplitAce: true })], active: 0 };
    expect(recommend(split, r).terminal).toBe('finished');
    const adv = recommend(split, { ...r, hitSplitAces: true });
    expect(adv.status).toBe('advice');
    expect(adv.move).not.toBe('double');
  });

  it('resplits aces only when allowed', () => {
    const split: Round = { dealer: '6', hands: [hand(['A', 'A'], { fromSplit: true, isSplitAce: true }), hand(['A'], { fromSplit: true, isSplitAce: true })], active: 0 };
    expect(recommend(split, r).terminal).toBe('finished');
    expect(recommend(split, { ...r, resplitAces: true }).move).toBe('split');
  });

  it('stops splitting at the maximum number of hands', () => {
    const hands = [hand(['8', '8'], { fromSplit: true }), hand(['8', '3'], { fromSplit: true })];
    const split: Round = { dealer: '6', hands, active: 0 };
    expect(recommend(split, { ...r, maxSplitHands: 2 }).move).not.toBe('split');
    expect(recommend(split, { ...r, maxSplitHands: 3 }).move).toBe('split');
  });
});
