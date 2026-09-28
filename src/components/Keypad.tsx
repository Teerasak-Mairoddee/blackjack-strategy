import { RANKS, type Rank } from '../strategy/cards';

type Props = {
  label: string;
  onPick: (rank: Rank) => void;
  disabled?: boolean;
  selected?: Rank | null;
};

export function Keypad({ label, onPick, disabled, selected }: Props) {
  return (
    <section className="keypad" aria-label={label}>
      <p className="keypad-label" aria-live="polite">
        {label}
      </p>
      <div className="keypad-grid">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            className={`key${selected === r ? ' key-selected' : ''}`}
            onClick={() => onPick(r)}
            disabled={disabled}
            aria-pressed={selected === r ? true : undefined}
            data-rank={r}
          >
            {r}
          </button>
        ))}
      </div>
    </section>
  );
}
