import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173/blackjack-strategy/' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/blackjack-strategy/',
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: '/blackjack-strategy/' },
  },
});
