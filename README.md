# Blackjack Basic Strategy

A fast, mobile-first web app that recommends the basic-strategy play for the dealer's upcard and your hand, under the table rules you choose. Tap the dealer card, tap your two cards, and the recommendation appears. Everything runs in the browser: no account, server, API key, or network request after the page loads.

**Live URL:** `https://<USERNAME>.github.io/<REPO>/` (fill in after the first deploy)

## Local development

```bash
npm ci
npm run dev          # http://localhost:5173/blackjack-strategy/
npm run typecheck
npm test             # Vitest: strategy engine, generated data, round state
npm run test:e2e     # Playwright: main mobile flow (first run: npx playwright install chromium)
npm run build        # outputs dist/
```

## How it works

- `src/strategy/cards.ts` – ranks, hand totals (aces as 11 unless that busts), pairs (exactly two cards of the same rank).
- `src/strategy/rules.ts` – table-rule model, defaults, presets, summary line.
- `src/strategy/engine.ts` – pure `recommend(round, rules): Advice`. It never reads UI state or mutates its input. Priority: terminal state, then the best **legal** move from the strategy cell; when the preferred move is not allowed (double after a hit, surrender off, split limit reached) the cell's own ranking gives the fallback.
- `src/strategy/tables.ts` – lookup into the bundled, versioned data file `src/strategy/data/strategy-v1.json`.
- `src/state/round.ts` – round reducer: dealer upcard, hands, splits, stand/double/surrender, card edits, undo, new round.
- `src/components/` – React UI. Rule settings are saved in `localStorage`; hands are not.

## Table-rule scope

| Setting | Values | Default |
| --- | --- | --- |
| Decks | 1, 2, 4, 6, 8 | 6 |
| Dealer soft 17 | S17, H17 | S17 |
| Hole card | US peek, no hole card (no peek) | US peek |
| Double on | any two cards, hard 9–11, hard 10–11 | any two |
| Double after split | yes / no | yes |
| Late surrender | yes / no | no |
| Maximum split hands | 2, 3, 4 | 4 |
| Resplit aces | yes / no | no |
| Hit split aces | yes / no | no |

Every combination has generated data, so no combination is disabled. With no hole card, the model assumes the player loses **every** stake (including doubles and splits) to a dealer blackjack, and a late surrender against A or 10 still loses the full stake to a dealer blackjack.

Ten-value cards keep their entered rank (J stays J). A pair needs the same rank (K,K is a pair; K,Q is not), and all ten-value pairs share one strategy row. Only an unsplit two-card A + ten is blackjack; 21 after a hit or a split is an ordinary 21.

## Strategy data: source and verification

No third-party chart is copied. The decisions are original data produced by the expected-value model in `src/strategy/ev.ts`:

- Finite shoe; the upcard, the player's first two cards and the player's first drawn card (the double card or first hit) are removed; dealer draws are exact (with removal); later player hits use the shoe after that removal. With an A or 10 up, the hole card is known not to complete a blackjack.
- Hard/soft cells are total-dependent: each move's EV is averaged over the two-card compositions that make that total. Pair cells use the exact pair.
- US peek: EVs are conditioned on no dealer blackjack. No hole card: stakes are exposed to dealer blackjack as above.
- Splits use the DAS, doubling-eligibility and hit-split-aces rules; resplits (up to the hand limit, aces only with RSA) are modelled by the expected number of hands.
- Each cell stores the moves in EV order, so fallbacks ("Double if allowed; otherwise hit") come from the same calculation.

Regenerate with `npm run generate`. Verification in `tests/strategy.test.ts`:

1. The committed JSON must equal a fresh run of the generator.
2. Full hard/soft/pair grids (6 decks S17 DAS LS, H17 DAS LS and S17 no DAS; 4 and 8 decks S17 DAS LS), including double and surrender fallbacks, are compared with reference decisions written independently in `tests/reference.ts` from the published rules text of the Wizard of Odds 4–8 deck strategy page. The one difference is 8-deck soft 13 v 5 (hit here, double on the combined 4–8 deck chart), where the two plays differ by less than 0.001 units; the test pins that margin.
3. Rule-sensitive checks: deck count (11 v A, 9 v 2), S17/H17, peek/no peek, DAS, limited doubling, surrender, split and split-ace limits, and a sweep that no illegal move is ever advised.

References used for checking (see the in-app About section):
[Basic Strategy Calculator](https://wizardofodds.com/games/blackjack/strategy/calculator/),
[4–8 deck strategy](https://wizardofodds.com/games/blackjack/strategy/4-decks/),
[European strategy](https://wizardofodds.com/games/blackjack/strategy/european/),
[single-deck](https://wizardofodds.com/games/blackjack/strategy/1-deck/) and
[double-deck](https://wizardofodds.com/games/blackjack/strategy/2-decks/) pages.

Basic strategy is not card counting and cannot predict the next card or guarantee a win.

## Deploying to GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. In the repository, open **Settings → Pages** and set **Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy.yml` runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and deploys `dist/` with `actions/deploy-pages`. Its permissions are `contents: read`, `pages: write`, `id-token: write`.
4. The Vite `base` path is set from the repository name automatically (`/<REPO>/`, or `/` for a `<USERNAME>.github.io` repository). Locally it defaults to `/blackjack-strategy/`; override with `BASE_PATH=/ npm run build`.

The app has no secrets and needs none.
