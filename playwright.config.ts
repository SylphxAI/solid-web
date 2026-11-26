import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const projects = [
  { name: 'meta', testMatch: 'meta.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
  { name: 'consent', testMatch: 'consent.spec.ts', use: { baseURL: 'http://127.0.0.1:4174' } },
  { name: 'package', testMatch: 'package.spec.ts' },
];
for (const { testMatch } of projects) {
  if (!existsSync(new URL(`./tests/${testMatch}`, import.meta.url))) {
    throw new Error(`Required test suite is missing: ${testMatch}`);
  }
}

export default defineConfig({
  testDir: './tests',
  projects,
  forbidOnly: true,
  use: { launchOptions: { executablePath: process.env.CHROMIUM_PATH } },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/README.md',
    },
    {
      command: 'npm run fixture',
      url: 'http://127.0.0.1:4174/tests/consent.fixture.html',
    },
  ],
});
