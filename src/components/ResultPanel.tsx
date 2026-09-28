import { fallbackText, type Advice, type HandContext } from '../strategy/engine';

type Props = {
  advice: Advice;
  ctx: HandContext | null;
  dealerLabel: string | null;
  onSplit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSurrender: () => void;
};

const TERMINAL_LABEL = {
  blackjack: 'BLACKJACK',
  'twenty-one': '21',
  bust: 'BUST',
  finished: 'DONE',
} as const;

export function ResultPanel({ advice, ctx, dealerLabel, onSplit, onStand, onDouble, onSurrender }: Props) {
  if (advice.status === 'need-dealer' || advice.status === 'need-cards') {
    return (
      <section className="result result-idle" aria-live="polite" data-testid="result">
        <p className="result-prompt">{advice.reason}</p>
      </section>
    );
  }

  const fb = fallbackText(advice);
  const headline =
    advice.status === 'terminal'
      ? TERMINAL_LABEL[advice.terminal ?? 'finished']
      : advice.status === 'awaiting-double-card'
        ? 'ONE CARD'
        : (advice.move ?? '').toUpperCase();
  const tone = advice.status === 'advice' ? advice.move : 'terminal';

  const canAct = advice.status === 'advice' && ctx;
  return (
    <section className={`result result-${tone}`} aria-live="polite" data-testid="result">
      <p className="result-move" data-testid="move">
        {headline}
      </p>
      <p className="result-hand">
        {advice.handLabel}
        {dealerLabel ? <span className="muted"> vs dealer {dealerLabel}</span> : null}
      </p>
      {fb ? <p className="result-fallback">{fb}</p> : null}
      <p className="result-reason">{advice.reason}</p>
      {canAct ? (
        <div className="result-actions">
          {ctx.splitAvailable ? (
            <button type="button" className={advice.move === 'split' ? 'btn btn-primary' : 'btn'} onClick={onSplit}>
              Split hand
            </button>
          ) : null}
          {ctx.doubleAvailable ? (
            <button type="button" className={advice.move === 'double' ? 'btn btn-primary' : 'btn'} onClick={onDouble}>
              Doubled
            </button>
          ) : null}
          {ctx.surrenderAvailable ? (
            <button type="button" className={advice.move === 'surrender' ? 'btn btn-primary' : 'btn'} onClick={onSurrender}>
              Surrendered
            </button>
          ) : null}
          <button type="button" className={advice.move === 'stand' ? 'btn btn-primary' : 'btn'} onClick={onStand}>
            Stood
          </button>
        </div>
      ) : null}
    </section>
  );
}
