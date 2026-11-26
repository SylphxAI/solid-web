import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const suites = ['meta.spec.ts', 'consent.spec.ts', 'package.spec.ts'];
for (const suite of suites) {
  if (!existsSync(new URL(`./tests/${suite}`, import.meta.url))) {
    throw new Error(`Required test suite is missing: ${suite}`);
  }
}

export default defineConfig({
  testDir: './tests',
  testMatch: suites,
  forbidOnly: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: 'npm run fixture',
    url: 'http://127.0.0.1:4173/tests/consent.fixture.html',
  },
});
