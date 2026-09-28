import { SOURCES, STRATEGY_VERSION } from '../strategy/tables';

export function About() {
  return (
    <details className="about">
      <summary>About this advice</summary>
      <p>
        Recommendations are <strong>basic strategy</strong> for the rules shown at the top: the best play for your hand total (or pair)
        against the dealer's upcard. Basic strategy reduces expected mistakes for the configured rules; it cannot predict the next card or
        guarantee a winning hand. It is not card counting.
      </p>
      <p>
        Strategy data v{STRATEGY_VERSION} was generated from an original expected-value calculation for every rule combination in
        settings and checked against published basic-strategy rules. No third-party chart is reproduced.
      </p>
      <p>Reference material used for checking:</p>
      <ul>
        {SOURCES.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="muted">Runs entirely in your browser. Only your rule settings are saved on this device; hands are not stored.</p>
    </details>
  );
}
