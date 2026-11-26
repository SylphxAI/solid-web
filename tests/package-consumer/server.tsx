import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { generateHydrationScript, renderToStringAsync, ssr } from 'solid-js/web';
import { App } from './app';

for (const path of ['', '/dist/server/meta.js', '/consent.tsx']) {
  await assert.rejects(import(`@sylphx/solid-web${path}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
const shell = readFileSync('dist/index.html', 'utf8');
const [before, after] = shell.split('<div id="app"></div>');
const html = await renderToStringAsync(() => ssr([
  before.replace('</head>', () => `${generateHydrationScript()}</head>`) + '<div id="app">',
  `</div>${after}`,
], <App />));
assert.match(html, /<title[^>]*>Fixture title<\/title>/);
assert.match(html, /https:\/\/example\.test\/fixture/);
assert.match(html, /Accept/);
writeFileSync('dist/index.html', html);
