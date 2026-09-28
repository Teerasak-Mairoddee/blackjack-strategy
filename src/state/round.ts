import { handValue, type Rank } from '../strategy/cards';
import { handContext, type Hand, type Round } from '../strategy/engine';
import type { Rules } from '../strategy/rules';

export type RoundState = Round & {
  /** Snapshots of player hands for Undo (dealer changes are not undone). */
  history: Pick<Round, 'hands' | 'active'>[];
};

export type RoundAction =
  | { type: 'setDealer'; rank: Rank }
  | { type: 'addCard'; rank: Rank }
  | { type: 'replaceCard'; hand: number; index: number; rank: Rank }
  | { type: 'removeCard'; hand: number; index: number }
  | { type: 'split' }
  | { type: 'stand' }
  | { type: 'double' }
  | { type: 'surrender' }
  | { type: 'selectHand'; hand: number }
  | { type: 'undo' }
  | { type: 'newRound' };

const emptyHand = (): Hand => ({ cards: [], fromSplit: false, isSplitAce: false, status: 'open' });

export function initialRound(): RoundState {
  return { dealer: null, hands: [emptyHand()], active: 0, history: [] };
}

/** A hand needs no more input: bust, 21, stood, surrendered, doubled with its card, or a finished split ace. */
export function isHandDone(hand: Hand, rules: Rules): boolean {
  const { total } = handValue(hand.cards);
  if (hand.cards.length >= 2 && total >= 21) return true;
  if (hand.status === 'stood' || hand.status === 'surrendered') return true;
  if (hand.status === 'doubled') return hand.cards.length >= 3;
  if (hand.isSplitAce && !rules.hitSplitAces && hand.cards.length >= 2) {
    // Done unless a resplit is possible (checked by the caller via handContext).
    return !(rules.resplitAces && hand.cards.length === 2 && hand.cards[1] === 'A');
  }
  return false;
}

function nextOpenHand(hands: Hand[], from: number, rules: Rules): number {
  for (let i = from + 1; i < hands.length; i++) if (!isHandDone(hands[i], rules)) return i;
  return from;
}

function withSnapshot(state: RoundState, hands: Hand[], active: number): RoundState {
  return {
    ...state,
    hands,
    active,
    history: [...state.history, { hands: state.hands, active: state.active }],
  };
}

function advanceIfDone(hands: Hand[], active: number, rules: Rules): number {
  return isHandDone(hands[active], rules) ? nextOpenHand(hands, active, rules) : active;
}

export function roundReducer(state: RoundState, action: RoundAction, rules: Rules): RoundState {
  switch (action.type) {
    case 'setDealer':
      return { ...state, dealer: action.rank };

    case 'addCard': {
      const hand = state.hands[state.active];
      if (isHandDone(hand, rules)) return state;
      const hands = state.hands.map((h, i) => (i === state.active ? { ...h, cards: [...h.cards, action.rank] } : h));
      return withSnapshot(state, hands, advanceIfDone(hands, state.active, rules));
    }

    case 'replaceCard': {
      const hands = state.hands.map((h, i) =>
        i === action.hand ? { ...h, cards: h.cards.map((c, j) => (j === action.index ? action.rank : c)) } : h,
      );
      return withSnapshot(state, hands, state.active);
    }

    case 'removeCard': {
      const hands = state.hands.map((h, i) =>
        i === action.hand ? { ...h, status: 'open' as const, cards: h.cards.filter((_, j) => j !== action.index) } : h,
      );
      return withSnapshot(state, hands, action.hand);
    }

    case 'split': {
      const ctx = handContext(state, rules);
      if (!ctx.splitAvailable) return state;
      const hand = state.hands[state.active];
      const rank = hand.cards[0];
      const child = (): Hand => ({ cards: [rank], fromSplit: true, isSplitAce: rank === 'A', status: 'open' });
      const hands = [...state.hands.slice(0, state.active), child(), child(), ...state.hands.slice(state.active + 1)];
      return withSnapshot(state, hands, state.active);
    }

    case 'stand':
    case 'surrender':
    case 'double': {
      const hand = state.hands[state.active];
      if (hand.cards.length < 2 || isHandDone(hand, rules)) return state;
      const ctx = handContext(state, rules);
      if (action.type === 'double' && !ctx.doubleAvailable) return state;
      if (action.type === 'surrender' && !ctx.surrenderAvailable) return state;
      const status: Hand['status'] = action.type === 'stand' ? 'stood' : action.type === 'double' ? 'doubled' : 'surrendered';
      const hands = state.hands.map((h, i) => (i === state.active ? { ...h, status } : h));
      return withSnapshot(state, hands, advanceIfDone(hands, state.active, rules));
    }

    case 'selectHand':
      if (action.hand < 0 || action.hand >= state.hands.length) return state;
      return { ...state, active: action.hand };

    case 'undo': {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return { ...state, hands: prev.hands, active: prev.active, history: state.history.slice(0, -1) };
    }

    case 'newRound':
      return initialRound();
  }
}
