import { DECK_OPTIONS, MAX_SPLIT_OPTIONS, PRESETS, sameRules, type DoubleRule, type Rules } from '../strategy/rules';

type Props = {
  rules: Rules;
  onChange: (rules: Rules) => void;
  midRound: boolean;
};

type Option<T> = { value: T; label: string };

function Segmented<T extends string | number | boolean>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="setting">
      <legend>{label}</legend>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'seg seg-on' : 'seg'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <p className="setting-hint">{hint}</p> : null}
    </fieldset>
  );
}

const yesNo: Option<boolean>[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

export function SettingsPanel({ rules, onChange, midRound }: Props) {
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  const activePreset = PRESETS.find((p) => sameRules(p.rules, rules));

  return (
    <div className="settings" id="settings-panel">
      {midRound ? (
        <p className="warning" role="status">
          Changing rules mid-round recalculates the advice for the current hand.
        </p>
      ) : null}

      <fieldset className="setting">
        <legend>Presets</legend>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={activePreset?.id === p.id ? 'preset preset-on' : 'preset'}
              aria-pressed={activePreset?.id === p.id}
              onClick={() => onChange(p.rules)}
            >
              <span className="preset-label">{p.label}</span>
              <span className="preset-note">{p.note}</span>
            </button>
          ))}
        </div>
        <p className="setting-hint">A preset is a starting configuration, not a statement about any casino. Check the table's posted rules.</p>
      </fieldset>

      <Segmented label="Decks" value={rules.decks} options={DECK_OPTIONS.map((d) => ({ value: d, label: String(d) }))} onChange={(v) => set('decks', v)} />
      <Segmented
        label="Dealer soft 17"
        value={rules.h17}
        options={[
          { value: false, label: 'Stands (S17)' },
          { value: true, label: 'Hits (H17)' },
        ]}
        onChange={(v) => set('h17', v)}
        hint="Usually printed on the felt. If unsure, S17 is assumed."
      />
      <Segmented
        label="Dealer hole card"
        value={rules.peek}
        options={[
          { value: true, label: 'US peek' },
          { value: false, label: 'No hole card' },
        ]}
        onChange={(v) => set('peek', v)}
        hint="With no hole card, doubled and split stakes can also lose to a dealer blackjack, so advice against 10 and A is more cautious."
      />
      <Segmented<DoubleRule>
        label="Double on"
        value={rules.double}
        options={[
          { value: 'any', label: 'Any 2 cards' },
          { value: '9-11', label: 'Hard 9–11' },
          { value: '10-11', label: 'Hard 10–11' },
        ]}
        onChange={(v) => set('double', v)}
      />
      <Segmented label="Double after split" value={rules.das} options={yesNo} onChange={(v) => set('das', v)} />
      <Segmented label="Late surrender" value={rules.lateSurrender} options={yesNo} onChange={(v) => set('lateSurrender', v)} />
      <Segmented
        label="Maximum split hands"
        value={rules.maxSplitHands}
        options={MAX_SPLIT_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        onChange={(v) => set('maxSplitHands', v)}
      />
      <Segmented label="Resplit aces" value={rules.resplitAces} options={yesNo} onChange={(v) => set('resplitAces', v)} />
      <Segmented label="Hit split aces" value={rules.hitSplitAces} options={yesNo} onChange={(v) => set('hitSplitAces', v)} />
    </div>
  );
}
