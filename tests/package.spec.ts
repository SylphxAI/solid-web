import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { build, preview, type PreviewServer } from 'vite';
import solid from 'vite-plugin-solid';

const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

for (const solidVersion of ['1.9.0', '1.9.20']) {
  test(`packed consumer typechecks, server-renders and hydrates with Solid ${solidVersion}`, async ({ page, request }) => {
    test.setTimeout(90_000);
    const root = await mkdtemp(join(tmpdir(), 'solid-web-consumer-'));
    let server: PreviewServer | undefined;
    try {
      const candidate = process.env.SOLID_WEB_TARBALL;
      const [pack] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root,
        ...(candidate ? [resolve(candidate)] : [])], process.cwd()));
      const packed = join(root, pack.filename);
      if (candidate) expect(await readFile(packed)).toEqual(await readFile(candidate));
      const digest = createHash('sha256').update(await readFile(packed)).digest('hex');
      expect(run('tar', ['-xOf', packed, 'package/LICENSE'], root)).toBe(await readFile('LICENSE', 'utf8'));
      expect(JSON.parse(run('tar', ['-xOf', packed, 'package/package.json'], root)).license).toBe('MIT');
      console.log(`Packed Solid ${solidVersion} test input SHA-256: ${digest}`);
      expect(pack.files.map(({ path }: { path: string }) => path)).toEqual(expect.arrayContaining([
        'dist/browser/meta.js', 'dist/browser/consent.js', 'dist/browser/consent.css',
        'dist/server/meta.js', 'dist/server/consent.js', 'dist/meta.d.ts', 'dist/consent.d.ts',
      ]));
      await cp('tests/package-consumer', root, { recursive: true });
      run('npm', ['init', '--yes'], root);
      run('npm', ['pkg', 'set', 'type=module'], root);
      run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund',
        `./${pack.filename}`, `solid-js@${solidVersion}`, '@solidjs/meta@0.29.4'], root);
      run('npm', ['ls', '--all'], root);
      run(process.execPath, [join(process.cwd(), 'node_modules/typescript/bin/tsc'),
        '--noEmit', '--strict', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler',
        '--jsx', 'preserve', '--jsxImportSource', 'solid-js', 'app.tsx', 'browser.tsx'], root);
      await build({ configFile: false, root, plugins: [solid({ ssr: true })], build: { target: 'es2022' } });
      await build({ configFile: false, root, plugins: [solid({ ssr: true })],
        ssr: { external: ['@sylphx/solid-web', '@solidjs/meta', 'solid-js'] },
        build: { ssr: 'server.tsx', outDir: 'server', target: 'node22' },
      });
      run(process.execPath, ['server/server.js'], root);
      const app = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port: 0 } });
      server = app;
      const url = app.resolvedUrls!.local[0];
      const html = await (await request.get(url)).text();
      expect(html).toContain('Fixture title');
      expect(html).toContain('https://example.test/fixture');
      expect(html).toContain('Accept');
      expect(html).toMatch(/<link[^>]*rel="stylesheet"/);
      const css = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/);
      expect(css).not.toBeNull();
      const stylesheet = await request.get(new URL(css![1], url).href);
      expect(stylesheet.ok()).toBe(true);
      expect(stylesheet.headers()['content-type']).toContain('text/css');
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await page.goto(url);
      await expect(page).toHaveTitle('Fixture title');
      await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
      const dock = page.getByRole('button', { name: 'Accept', exact: true });
      await expect(dock).toBeVisible();
      await dock.click();
      await expect(dock).toBeHidden();
      await page.getByRole('button', { name: 'Open choices' }).click();
      await expect(dock).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
