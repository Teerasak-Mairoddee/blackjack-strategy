/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set BASE_PATH to '/<repo-name>/' for a GitHub Pages project site, or '/' for a USERNAME.github.io repo.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/blackjack-strategy/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
