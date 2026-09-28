import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardChip } from './components/CardChip';
import { Keypad } from './components/Keypad';
import { ResultPanel } from './components/ResultPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { About } from './components/About';
import { initialRound, isHandDone, roundReducer, type RoundAction, type RoundState } from './state/round';
import { handValue, type Rank } from './strategy/cards';
import { handContext, recommend } from './strategy/engine';
import { DEFAULT_RULES, parseRules, rulesSummary, type Rules } from './strategy/rules';

const STORAGE_KEY = 'bj-strategy.rules.v1';

function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (raw && parseRules(JSON.parse(raw))) || DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

type Target = { kind: 'auto' } | { kind: 'dealer' } | { kind: 'replace'; hand: number; index: number };

const KEY_TO_RANK: Record<string, Rank> = {
  a: 'A', '1': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '0': '10', t: '10', j: 'J', q: 'Q', k: 'K',
};

export default function App() {
  const [rules, setRules] = useState<Rules>(loadRules);
  const [round, setRound] = useState<RoundState>(initialRound);
  const [target, setTarget] = useState<Target>({ kind: 'auto' });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const dispatch = useCallback((a: RoundAction) => setRound((s) => roundReducer(s, a, rulesRef.current)), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
      /* storage unavailable: preferences just won't persist */
    }
  }, [rules]);

  const advice = useMemo(() => recommend(round, rules), [round, rules]);
  const activeHand = round.hands[round.active];
  const ctx = round.dealer && activeHand.cards.length >= 2 ? handContext(round, rules) : null;
  const multi = round.hands.length > 1;
  const allDone = round.hands.every((h) => isHandDone(h, rules));
  const midRound = round.dealer !== null || activeHand.cards.length > 0;

  const mode: 'dealer' | 'replace' | 'player' =
    target.kind === 'replace' ? 'replace' : target.kind === 'dealer' || !round.dealer ? 'dealer' : 'player';

  const pick = useCallback(
    (rank: Rank) => {
      if (mode === 'replace' && target.kind === 'replace') {
        dispatch({ type: 'replaceCard', hand: target.hand, index: target.index, rank });
        setTarget({ kind: 'auto' });
      } else if (mode === 'dealer') {
        dispatch({ type: 'setDealer', rank });
        setTarget({ kind: 'auto' });
      } else {
        dispatch({ type: 'addCard', rank });
      }
    },
    [mode, target, dispatch],
  );

  const newRound = useCallback(() => {
    dispatch({ type: 'newRound' });
    setTarget({ kind: 'auto' });
  }, [dispatch]);

  const undo = useCallback(() => {
    dispatch({ type: 'undo' });
    setTarget({ kind: 'auto' });
  }, [dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
      const rank = KEY_TO_RANK[e.key.toLowerCase()];
      if (rank) {
        pick(rank);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        undo();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setTarget({ kind: 'auto' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, undo]);

  let keypadLabel: string;
  if (mode === 'replace' && target.kind === 'replace') {
    keypadLabel = `Replace card ${target.index + 1}${multi ? ` in hand ${target.hand + 1}` : ''}`;
  } else if (mode === 'dealer') {
    keypadLabel = 'Dealer upcard';
  } else if (allDone && activeHand.cards.length >= 2) {
    keypadLabel = 'Round complete · tap New round';
  } else {
    keypadLabel = multi ? `Player card · hand ${round.active + 1}` : 'Player card';
  }
  const keypadDisabled = mode === 'player' && isHandDone(activeHand, rules);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Basic Strategy</h1>
        <button
          type="button"
          className="rules-chip"
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          onClick={() => setSettingsOpen((o) => !o)}
          data-testid="rules-summary"
        >
          <span className="rules-text">{rulesSummary(rules)}</span>
          <span className="rules-edit">{settingsOpen ? 'Done' : 'Rules'}</span>
        </button>
      </header>

      {settingsOpen ? (
        <SettingsPanel rules={rules} onChange={setRules} midRound={midRound} />
      ) : null}

      <main className="table">
        <div className="row">
          <span className="row-label">Dealer</span>
          <div className="cards">
            <CardChip
              rank={round.dealer}
              label={round.dealer ? `Dealer upcard ${round.dealer}. Tap to replace.` : 'Dealer upcard, not selected'}
              selected={mode === 'dealer'}
              onClick={() => setTarget(target.kind === 'dealer' ? { kind: 'auto' } : { kind: 'dealer' })}
            />
          </div>
        </div>

        <div className="row">
          <span className="row-label">{multi ? `Hand ${round.active + 1}` : 'You'}</span>
          <div className="cards" data-testid="player-cards">
            {activeHand.cards.map((c, i) => (
              <CardChip
                key={i}
                rank={c}
                label={`Card ${i + 1}: ${c}. Tap to replace or remove.`}
                selected={target.kind === 'replace' && target.hand === round.active && target.index === i}
                onClick={() =>
                  setTarget(
                    target.kind === 'replace' && target.hand === round.active && target.index === i
                      ? { kind: 'auto' }
                      : { kind: 'replace', hand: round.active, index: i },
                  )
                }
              />
            ))}
            {activeHand.cards.length < 2 ? <span className="card card-slot" aria-hidden="true" /> : null}
            {activeHand.cards.length ? (
              <span className="hand-total" data-testid="hand-total">
                {handValue(activeHand.cards).total}
              </span>
            ) : null}
          </div>
        </div>

        {multi ? (
          <div className="hand-tabs" role="tablist" aria-label="Split hands">
            {round.hands.map((h, i) => {
              const v = handValue(h.cards);
              const done = isHandDone(h, rules);
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === round.active}
                  className={`hand-tab${i === round.active ? ' hand-tab-on' : ''}${done ? ' hand-tab-done' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'selectHand', hand: i });
                    setTarget({ kind: 'auto' });
                  }}
                >
                  Hand {i + 1}
                  <span className="hand-tab-cards">{h.cards.join(' ') || '—'}</span>
                  <span className="hand-tab-total">{h.cards.length ? `${v.total}${done ? ' ✓' : ''}` : ''}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <ResultPanel
          advice={advice}
          ctx={ctx}
          dealerLabel={round.dealer}
          onSplit={() => dispatch({ type: 'split' })}
          onStand={() => dispatch({ type: 'stand' })}
          onDouble={() => dispatch({ type: 'double' })}
          onSurrender={() => dispatch({ type: 'surrender' })}
        />

        <Keypad label={keypadLabel} onPick={pick} disabled={keypadDisabled} selected={mode === 'dealer' ? round.dealer : null} />

        {mode === 'replace' && target.kind === 'replace' ? (
          <div className="edit-bar">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'removeCard', hand: target.hand, index: target.index });
                setTarget({ kind: 'auto' });
              }}
            >
              Remove card
            </button>
            <button type="button" className="btn" onClick={() => setTarget({ kind: 'auto' })}>
              Cancel
            </button>
          </div>
        ) : null}

        <About />
      </main>

      <nav className="bottombar" aria-label="Round controls">
        <button type="button" className="btn btn-bar" onClick={undo} disabled={round.history.length === 0}>
          Undo
        </button>
        <button type="button" className="btn btn-bar btn-primary" onClick={newRound}>
          New round
        </button>
      </nav>
    </div>
  );
}
