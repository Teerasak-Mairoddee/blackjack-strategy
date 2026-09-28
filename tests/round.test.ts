import { describe, expect, it } from 'vitest';
import { initialRound, roundReducer, type RoundAction, type RoundState } from '../src/state/round';
import { recommend } from '../src/strategy/engine';
import { DEFAULT_RULES, type Rules } from '../src/strategy/rules';

function play(actions: RoundAction[], rules: Rules = DEFAULT_RULES, start: RoundState = initialRound()): RoundState {
  return actions.reduce((s, a) => roundReducer(s, a, rules), start);
}

describe('round state', () => {
  it('recomputes after a hit: K v K,3 → K,3,2', () => {
    const s1 = play([{ type: 'setDealer', rank: 'K' }, { type: 'addCard', rank: 'K' }, { type: 'addCard', rank: '3' }]);
    expect(recommend(s1, DEFAULT_RULES)).toMatchObject({ move: 'hit', total: 13 });
    const s2 = roundReducer(s1, { type: 'addCard', rank: '2' }, DEFAULT_RULES);
    expect(s2.hands[0].cards).toEqual(['K', '3', '2']);
    expect(recommend(s2, DEFAULT_RULES)).toMatchObject({ move: 'hit', total: 15 });
  });

  it('undo removes the last entered player card and keeps the dealer', () => {
    const s = play([{ type: 'setDealer', rank: '9' }, { type: 'addCard', rank: '5' }, { type: 'addCard', rank: '6' }, { type: 'undo' }]);
    expect(s.hands[0].cards).toEqual(['5']);
    expect(s.dealer).toBe('9');
  });

  it('replaces and removes a card while keeping the rest of the round', () => {
    let s = play([{ type: 'setDealer', rank: '6' }, { type: 'addCard', rank: 'K' }, { type: 'addCard', rank: '3' }, { type: 'addCard', rank: '2' }]);
    s = roundReducer(s, { type: 'replaceCard', hand: 0, index: 1, rank: '4' }, DEFAULT_RULES);
    expect(s.hands[0].cards).toEqual(['K', '4', '2']);
    s = roundReducer(s, { type: 'removeCard', hand: 0, index: 2 }, DEFAULT_RULES);
    expect(s.hands[0].cards).toEqual(['K', '4']);
    s = roundReducer(s, { type: 'setDealer', rank: '7' }, DEFAULT_RULES);
    expect(s.dealer).toBe('7');
    expect(s.hands[0].cards).toEqual(['K', '4']);
  });

  it('keeps the entered rank of ten-value cards', () => {
    const s = play([{ type: 'addCard', rank: 'Q' }, { type: 'addCard', rank: 'J' }]);
    expect(s.hands[0].cards).toEqual(['Q', 'J']);
  });

  it('New round clears cards and dealer (rules live outside round state)', () => {
    const rules: Rules = { ...DEFAULT_RULES, decks: 2, h17: true };
    const s = play([{ type: 'setDealer', rank: '6' }, { type: 'addCard', rank: '8' }, { type: 'addCard', rank: '8' }, { type: 'split' }, { type: 'newRound' }], rules);
    expect(s).toEqual(initialRound());
    expect(rules).toEqual({ ...DEFAULT_RULES, decks: 2, h17: true });
  });

  it('splits into two hands, tracks split state and advances between hands', () => {
    let s = play([{ type: 'setDealer', rank: '6' }, { type: 'addCard', rank: '8' }, { type: 'addCard', rank: '8' }]);
    expect(recommend(s, DEFAULT_RULES).move).toBe('split');
    s = roundReducer(s, { type: 'split' }, DEFAULT_RULES);
    expect(s.hands).toHaveLength(2);
    expect(s.hands.every((h) => h.fromSplit && h.cards.length === 1)).toBe(true);
    expect(recommend(s, DEFAULT_RULES).status).toBe('need-cards');

    s = roundReducer(s, { type: 'addCard', rank: '3' }, DEFAULT_RULES); // hand 1: 8,3 = 11
    expect(recommend(s, DEFAULT_RULES).move).toBe('double'); // DAS
    s = roundReducer(s, { type: 'double' }, DEFAULT_RULES);
    expect(recommend(s, DEFAULT_RULES).status).toBe('awaiting-double-card');
    s = roundReducer(s, { type: 'addCard', rank: '9' }, DEFAULT_RULES); // 20, done → hand 2
    expect(s.active).toBe(1);

    s = roundReducer(s, { type: 'addCard', rank: 'K' }, DEFAULT_RULES); // hand 2: 8,K = 18
    expect(recommend(s, DEFAULT_RULES).move).toBe('stand');

    // correct a card on hand 1
    s = roundReducer(s, { type: 'replaceCard', hand: 0, index: 2, rank: '7' }, DEFAULT_RULES);
    expect(s.hands[0].cards).toEqual(['8', '3', '7']);
    expect(s.hands[1].cards).toEqual(['8', 'K']);
  });

  it('split aces get one card and move on', () => {
    let s = play([{ type: 'setDealer', rank: '9' }, { type: 'addCard', rank: 'A' }, { type: 'addCard', rank: 'A' }, { type: 'split' }]);
    expect(s.hands.every((h) => h.isSplitAce)).toBe(true);
    s = roundReducer(s, { type: 'addCard', rank: '7' }, DEFAULT_RULES);
    expect(s.active).toBe(1);
    const back = roundReducer(s, { type: 'selectHand', hand: 0 }, DEFAULT_RULES);
    expect(recommend(back, DEFAULT_RULES).terminal).toBe('finished');
    // no extra cards accepted on a finished split ace
    expect(roundReducer(back, { type: 'addCard', rank: '2' }, DEFAULT_RULES).hands[0].cards).toEqual(['A', '7']);
  });

  it('ignores illegal actions', () => {
    const s = play([{ type: 'setDealer', rank: '6' }, { type: 'addCard', rank: '9' }, { type: 'addCard', rank: '7' }]);
    expect(roundReducer(s, { type: 'split' }, DEFAULT_RULES)).toBe(s);
    expect(roundReducer(s, { type: 'surrender' }, DEFAULT_RULES)).toBe(s);
  });
});
