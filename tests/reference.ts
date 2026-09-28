/**
 * Independent reference decisions for checking the generated strategy data.
 *
 * Written by hand from the published rules text (not copied from a chart image) of
 * Wizard of Odds, "4-Deck to 8-Deck Blackjack Strategy" (S17, DAS, late surrender,
 * with the listed H17 modifications):
 * https://wizardofodds.com/games/blackjack/strategy/4-decks/
 *
 * Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, 10, A.
 * Codes: H hit, S stand, Dh double else hit, Ds double else stand,
 *        Rh surrender else hit, Rs surrender else stand, Rp surrender else split,
 *        P split, - do not split.
 */
export type Grid = Record<number | string, string[]>;

const row = (s: string) => s.trim().split(/\s+/);

export const MULTI_DECK_S17_DAS_LS: { hard: Grid; soft: Grid; pairs: Grid } = {
  hard: {
    5: row('H  H  H  H  H  H  H  H  H  H'),
    6: row('H  H  H  H  H  H  H  H  H  H'),
    7: row('H  H  H  H  H  H  H  H  H  H'),
    8: row('H  H  H  H  H  H  H  H  H  H'),
    9: row('H  Dh Dh Dh Dh H  H  H  H  H'),
    10: row('Dh Dh Dh Dh Dh Dh Dh Dh H  H'),
    11: row('Dh Dh Dh Dh Dh Dh Dh Dh Dh H'),
    12: row('H  H  S  S  S  H  H  H  H  H'),
    13: row('S  S  S  S  S  H  H  H  H  H'),
    14: row('S  S  S  S  S  H  H  H  H  H'),
    15: row('S  S  S  S  S  H  H  H  Rh H'),
    16: row('S  S  S  S  S  H  H  Rh Rh Rh'),
    17: row('S  S  S  S  S  S  S  S  S  S'),
    18: row('S  S  S  S  S  S  S  S  S  S'),
    19: row('S  S  S  S  S  S  S  S  S  S'),
    20: row('S  S  S  S  S  S  S  S  S  S'),
  },
  soft: {
    13: row('H  H  H  Dh Dh H  H  H  H  H'),
    14: row('H  H  H  Dh Dh H  H  H  H  H'),
    15: row('H  H  Dh Dh Dh H  H  H  H  H'),
    16: row('H  H  Dh Dh Dh H  H  H  H  H'),
    17: row('H  Dh Dh Dh Dh H  H  H  H  H'),
    18: row('S  Ds Ds Ds Ds S  S  H  H  H'),
    19: row('S  S  S  S  S  S  S  S  S  S'),
    20: row('S  S  S  S  S  S  S  S  S  S'),
  },
  pairs: {
    A: row('P  P  P  P  P  P  P  P  P  P'),
    2: row('P  P  P  P  P  P  -  -  -  -'),
    3: row('P  P  P  P  P  P  -  -  -  -'),
    4: row('-  -  -  P  P  -  -  -  -  -'),
    5: row('-  -  -  -  -  -  -  -  -  -'),
    6: row('P  P  P  P  P  -  -  -  -  -'),
    7: row('P  P  P  P  P  P  -  -  -  -'),
    8: row('P  P  P  P  P  P  P  P  P  P'),
    9: row('P  P  P  P  P  -  P  P  -  -'),
    10: row('-  -  -  -  -  -  -  -  -  -'),
  },
};

/** H17 modifications listed on the same page. */
export function multiDeckH17DasLs(): typeof MULTI_DECK_S17_DAS_LS {
  const g = structuredClone(MULTI_DECK_S17_DAS_LS);
  g.hard[11][9] = 'Dh';
  g.hard[15][9] = 'Rh';
  g.hard[17][9] = 'Rs';
  g.soft[18][0] = 'Ds';
  g.soft[19][4] = 'Ds';
  g.pairs[8][9] = 'Rp';
  return g;
}

/** Same page, rules text for splitting without DAS. */
export function multiDeckS17NoDas(): typeof MULTI_DECK_S17_DAS_LS {
  const g = structuredClone(MULTI_DECK_S17_DAS_LS);
  g.pairs[2] = row('-  -  P  P  P  P  -  -  -  -');
  g.pairs[3] = row('-  -  P  P  P  P  -  -  -  -');
  g.pairs[4] = row('-  -  -  -  -  -  -  -  -  -');
  g.pairs[6] = row('-  P  P  P  P  -  -  -  -  -');
  return g;
}
