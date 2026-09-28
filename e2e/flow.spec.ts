import { expect, test, type Page } from '@playwright/test';

const key = (page: Page, rank: string) => page.locator(`.keypad [data-rank="${rank}"]`);
const move = (page: Page) => page.getByTestId('move');

test('dealer K, player K,3 → HIT; add 2 → still HIT on hard 15', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('result')).toContainText('Select dealer upcard');
  await key(page, 'K').click();
  await key(page, 'K').click();
  await key(page, '3').click();
  await expect(move(page)).toHaveText('HIT');
  await expect(page.getByTestId('result')).toContainText('Hard 13');
  await key(page, '2').click();
  await expect(move(page)).toHaveText('HIT');
  await expect(page.getByTestId('result')).toContainText('Hard 15');
  await expect(page.getByTestId('player-cards')).toContainText('K32');
});

test('undo, replace and new round keep rules', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('rules-summary').click();
  await page.getByRole('radiogroup', { name: 'Decks' }).getByRole('radio', { name: '2' }).click();
  await page.getByTestId('rules-summary').click();
  await expect(page.getByTestId('rules-summary')).toContainText('2 decks');

  await key(page, '4').click();
  await key(page, '5').click();
  await key(page, '4').click();
  await expect(move(page)).toHaveText('DOUBLE');
  await expect(page.getByTestId('result')).toContainText('Double if allowed; otherwise hit.');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('result')).toContainText('Select your second card');

  await key(page, '4').click();
  await page.getByRole('button', { name: /Card 2: 4/ }).click();
  await key(page, '9').click(); // replace 4 with 9 → 5,9 = 14
  await expect(page.getByTestId('hand-total')).toHaveText('14');
  await expect(move(page)).toHaveText('STAND');

  await page.getByRole('button', { name: 'New round' }).click();
  await expect(page.getByTestId('result')).toContainText('Select dealer upcard');
  await page.reload();
  await expect(page.getByTestId('rules-summary')).toContainText('2 decks');
});

test('split 8s against 10 and play both hands', async ({ page }) => {
  await page.goto('./');
  await key(page, '10').click();
  await key(page, '8').click();
  await key(page, '8').click();
  await expect(move(page)).toHaveText('SPLIT');
  await page.getByRole('button', { name: 'Split hand' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await key(page, '3').click(); // hand 1: 8,3
  await expect(move(page)).toHaveText('DOUBLE');
  await page.getByRole('button', { name: 'Stood' }).click();
  await expect(page.getByRole('tab', { selected: true })).toContainText('Hand 2');
  await key(page, 'K').click(); // hand 2: 8,K = 18
  await expect(move(page)).toHaveText('STAND');
});

test('blackjack is terminal', async ({ page }) => {
  await page.goto('./');
  await key(page, '5').click();
  await key(page, 'A').click();
  await key(page, 'K').click();
  await expect(move(page)).toHaveText('BLACKJACK');
});
