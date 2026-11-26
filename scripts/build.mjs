import { execFileSync } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
import { build } from 'vite';
import solid from 'vite-plugin-solid';

await rm('dist', { recursive: true, force: true });
const entry = { meta: 'src/meta.tsx', consent: 'src/consent.tsx' };
const external = /^(?:solid-js|@solidjs\/meta)(?:\/|$)/;
for (const ssr of [false, true]) {
  await build({
    configFile: false,
    plugins: [solid({ ssr: true })],
    build: {
      target: 'es2022',
      outDir: ssr ? 'dist/server' : 'dist/browser',
      ssr,
      lib: ssr ? undefined : { entry, formats: ['es'] },
      rollupOptions: { input: entry, external, output: { entryFileNames: '[name].js' } },
    },
  });
}
await copyFile('src/consent.css', 'dist/browser/consent.css');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--declaration', '--emitDeclarationOnly'], { stdio: 'inherit' });
