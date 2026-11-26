import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig(({ mode }) => ({
  plugins: [solid({ ssr: true })],
  ...(mode === 'fixture' && {
    html: { cspNonce: 'fixture-nonce' },
    build: {
      outDir: 'test-results-fixture',
      rollupOptions: { input: 'tests/consent.fixture.html' },
    },
  }),
}));
