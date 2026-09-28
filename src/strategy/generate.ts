import { dealerDist, exposeToBlackjack, fullShoe, rankMoves, splitEV, twoCardConditionedEVs, type MoveEVs } from './ev';
import { DECK_OPTIONS, MAX_SPLIT_OPTIONS, type DoubleRule } from './rules';
import { baseKey, PAIR_ROWS, splitKey, UP_COLUMNS, type BaseTable, type StrategyData } from './layout';

export const DATA_VERSION = '1.0.0';

function weightedAverage(parts: { w: number; ev: MoveEVs }[]): MoveEVs {
  const tw = parts.reduce((a, p) => a + p.w, 0);
  const out: MoveEVs = { H: 0, S: 0, D: 0, R: 0 };
  for (const p of parts) for (const k of ['H', 'S', 'D', 'R'] as const) out[k] += (p.w / tw) * p.ev[k];
  return out;
}

export function generateStrategyData(): StrategyData {
  const base: Record<string, BaseTable> = {};
  const splitGrids: string[] = [];
  const gridIndex = new Map<string, number>();
  const split: Record<string, number> = {};

  for (const decks of DECK_OPTIONS) {
    for (const h17 of [false, true]) {
      const tables = {
        peek: { hard: {}, soft: {}, pair: {} } as BaseTable,
        enhc: { hard: {}, soft: {}, pair: {} } as BaseTable,
      };
      // splitDigits[peek][key] builds 100-char strings
      const splitDigits: Record<string, string[]> = {};

      for (let col = 0; col < UP_COLUMNS.length; col++) {
        const up = UP_COLUMNS[col];
        const shoeAfterUp = fullShoe(decks);
        shoeAfterUp[up]--;
        const compEVs = (a: number, b: number) => {
          const s = fullShoe(decks);
          s[up]--;
          s[a]--;
          s[b]--;
          const dist = dealerDist(s, up, h17);
          const { ev, pbj } = twoCardConditionedEVs(decks, h17, up, a, b, dist);
          return { dist, peek: ev, enhc: exposeToBlackjack(ev, pbj) };
        };
        const weight = (a: number, b: number) => (a === b ? shoeAfterUp[a] * (shoeAfterUp[a] - 1) : 2 * shoeAfterUp[a] * shoeAfterUp[b]);

        // Hard totals from non-pair, ace-free compositions.
        const hardParts: Record<number, { w: number; peek: MoveEVs; enhc: MoveEVs }[]> = {};
        for (let a = 2; a <= 10; a++) {
          for (let b = a + 1; b <= 10; b++) {
            const e = compEVs(a, b);
            (hardParts[a + b] ??= []).push({ w: weight(a, b), peek: e.peek, enhc: e.enhc });
          }
        }
        // Soft totals A,2 … A,9.
        const softEVs: Record<number, { peek: MoveEVs; enhc: MoveEVs }> = {};
        for (let x = 2; x <= 9; x++) softEVs[11 + x] = compEVs(1, x);
        // Pairs.
        const pairEVs: Record<number, ReturnType<typeof compEVs>> = {};
        for (const p of PAIR_ROWS) pairEVs[p] = compEVs(p, p);

        for (const mode of ['peek', 'enhc'] as const) {
          const t = tables[mode];
          for (let total = 4; total <= 21; total++) {
            let ev: MoveEVs | null = null;
            if (hardParts[total]) ev = weightedAverage(hardParts[total].map((p) => ({ w: p.w, ev: p[mode] })));
            else if (total === 4) ev = pairEVs[2][mode];
            else if (total === 20) ev = pairEVs[10][mode];
            const cell = ev ? rankMoves(ev) : 'SHDR'; // hard 21 is terminal; stand.
            (t.hard[total] ??= []).push(cell);
          }
          for (let total = 12; total <= 21; total++) {
            const ev = total === 12 ? pairEVs[1][mode] : total === 21 ? null : softEVs[total][mode];
            (t.soft[total] ??= []).push(ev ? rankMoves(ev) : 'SHDR');
          }
          for (const p of PAIR_ROWS) (t.pair[p] ??= []).push(rankMoves(pairEVs[p][mode]));
        }

        // Split EVs for every split-related rule combination.
        for (const p of PAIR_ROWS) {
          for (const das of [false, true]) {
            for (const hitSplitAces of [false, true]) {
              for (const double of ['any', '9-11', '10-11'] as DoubleRule[]) {
                for (const maxSplitHands of MAX_SPLIT_OPTIONS) {
                  for (const resplitAces of [false, true]) {
                    const opts = { das, hitSplitAces, double, maxSplitHands, resplitAces };
                    for (const mode of ['peek', 'enhc'] as const) {
                      const peek = mode === 'peek';
                      const sev = splitEV(decks, h17, peek, up, p, opts, pairEVs[p].dist);
                      const other = pairEVs[p][mode];
                      const pos = (['H', 'S', 'D', 'R'] as const).filter((k) => other[k] > sev).length;
                      const key = splitKey(baseKey(decks, h17, peek), opts);
                      (splitDigits[key] ??= []).push(String(pos));
                    }
                  }
                }
              }
            }
          }
        }
      }

      base[baseKey(decks, h17, true)] = tables.peek;
      base[baseKey(decks, h17, false)] = tables.enhc;
      // splitDigits were pushed column-major (col loop outside, p loop inside); reorder to row-major.
      for (const [key, digits] of Object.entries(splitDigits)) {
        let grid = '';
        for (let r = 0; r < PAIR_ROWS.length; r++) for (let c = 0; c < UP_COLUMNS.length; c++) grid += digits[c * PAIR_ROWS.length + r];
        let idx = gridIndex.get(grid);
        if (idx === undefined) {
          idx = splitGrids.length;
          splitGrids.push(grid);
          gridIndex.set(grid, idx);
        }
        split[key] = idx;
      }
    }
  }

  return {
    version: DATA_VERSION,
    model:
      'Original EV computation (src/strategy/ev.ts): finite shoe, upcard and first two player cards removed, exact dealer draws with removal, total-dependent averaging over non-pair two-card compositions, resplits by expected hand count.',
    base,
    splitGrids,
    split,
  };
}
