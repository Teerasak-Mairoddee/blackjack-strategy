// Shared layout of the bundled strategy data (used by the generator and the runtime lookup).
import type { DoubleRule } from './rules';

/** Dealer upcard column order used by every grid: 2, 3, …, 10, A. */
export const UP_COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] as const;
/** Pair row order used by split grids: A, 2, …, 10. */
export const PAIR_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type BaseTable = {
  /** hard[total][col] = moves ordered best-first from H, S, D, R. Totals 4–21. */
  hard: Record<string, string[]>;
  /** soft[total][col], totals 12–21. */
  soft: Record<string, string[]>;
  /** pair[pairValue][col] = non-split moves ordered for that exact pair composition. */
  pair: Record<string, string[]>;
};

export type StrategyData = {
  version: string;
  model: string;
  base: Record<string, BaseTable>;
  /** Each grid is 100 digits: row-major over PAIR_ROWS × UP_COLUMNS; digit = position of P in the pair ranking. */
  splitGrids: string[];
  split: Record<string, number>;
};

export function baseKey(decks: number, h17: boolean, peek: boolean): string {
  return `${decks}-${h17 ? 'h17' : 's17'}-${peek ? 'peek' : 'enhc'}`;
}

export function splitKey(base: string, o: { das: boolean; hitSplitAces: boolean; double: DoubleRule; maxSplitHands: number; resplitAces: boolean }): string {
  return [base, o.das ? 'das' : 'nodas', o.hitSplitAces ? 'hsa' : 'nohsa', o.double, `sp${o.maxSplitHands}`, o.resplitAces ? 'rsa' : 'norsa'].join('-');
}
