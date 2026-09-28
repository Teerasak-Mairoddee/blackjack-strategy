import type { Rank } from '../strategy/cards';

type Props = {
  rank: Rank | null;
  onClick?: () => void;
  selected?: boolean;
  label: string;
  placeholder?: string;
};

export function CardChip({ rank, onClick, selected, label, placeholder = '?' }: Props) {
  return (
    <button
      type="button"
      className={`card${rank ? '' : ' card-empty'}${selected ? ' card-selected' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected || undefined}
    >
      {rank ?? placeholder}
    </button>
  );
}
