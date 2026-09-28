import type { Rank } from '../strategy/cards';

type Props = {
  label: string;
  onPick: (rank: Rank) => void;
  disabled?: boolean;
  selected?: Rank | null;
};

// Three columns of numbers and faces, with the ace as a full-width key underneath.
const LAYOUT: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function Keypad({ label, onPick, disabled, selected }: Props) {
  return (
    <section className="keypad" aria-label={label}>
      <p className="keypad-label" aria-live="polite">
        {label}
      </p>
      <div className="keypad-grid">
        {LAYOUT.map((r) => (
          <button
            key={r}
            type="button"
            className={`key${r === 'A' ? ' key-wide' : ''}${selected === r ? ' key-selected' : ''}`}
            onClick={() => onPick(r)}
            disabled={disabled}
            aria-pressed={selected === r ? true : undefined}
            aria-label={r === 'A' ? 'Ace' : undefined}
            data-rank={r}
          >
            {r}
          </button>
        ))}
      </div>
    </section>
  );
}
