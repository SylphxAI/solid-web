import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { data, Evaluator, Lexer, Parser } from '@actions/expressions';
import { parse } from 'yaml';

const yaml = (name) => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
const release = yaml('release');
const sha = 'f'.repeat(40);
const context = {
  github: {
    event_name: 'workflow_dispatch', repository_id: '1473701321',
    event: { repository: { visibility: 'public' } }, ref: 'refs/heads/main', ref_protected: true, sha,
  },
  inputs: { source_sha: sha, version: '0.1.0' },
  needs: { prepare: { result: 'success', outputs: { artifact: '948', sha256: 'f'.repeat(64) } } },
};

function evaluate(expression, env) {
  const source = expression.match(/^\$\{\{\s*(.+?)\s*}}$/)?.[1];
  assert.ok(source);
  const tokens = new Lexer(source).lex().tokens;
  const tree = new Parser(tokens, Object.keys(context), []).parse();
  return new Evaluator(tree, JSON.parse(JSON.stringify(env), data.reviver)).evaluate().coerceString();
}

for (const [job, { if: guard }] of Object.entries(release.jobs)) {
  test(`${job} admits only the exact public protected-main dispatch`, () => {
    const cases = [
      ['allow exact dispatch', () => {}, 'true'],
      ...['pull_request', 'push', 'merge_group'].map((event) => [event, (c) => { c.github.event_name = event; }]),
      ...['private', 'internal'].map((visibility) => [visibility, (c) => { c.github.event.repository.visibility = visibility; }]),
      ['missing visibility', (c) => { delete c.github.event.repository.visibility; }],
      ['missing repo payload', (c) => { delete c.github.event.repository; }],
      ['wrong repo ID', (c) => { c.github.repository_id = '999'; }],
      ['missing repo ID', (c) => { delete c.github.repository_id; }],
      ['unprotected', (c) => { c.github.ref_protected = false; }],
      ['missing protection', (c) => { delete c.github.ref_protected; }],
      ['different ref', (c) => { c.github.ref = 'refs/tags/v0.1.0'; }],
      ['stale source', (c) => { c.inputs.source_sha = 'a'.repeat(40); }],
      ['missing source', (c) => { delete c.inputs.source_sha; }],
      ['empty source and SHA', (c) => { c.inputs.source_sha = c.github.sha = ''; }],
    ];
    if (job === 'publish') cases.push(
      ['no passing preparation', (c) => { c.needs.prepare.result = 'failure'; }],
      ['missing artifact', (c) => { delete c.needs.prepare.outputs.artifact; }],
      ['missing digest', (c) => { delete c.needs.prepare.outputs.sha256; }],
    );
    for (const [label, change, expected = 'false'] of cases) {
      const env = structuredClone(context);
      change(env);
      assert.equal(evaluate(guard, env) === 'true', expected === 'true', label);
    }
  });
}

test('only explicit dispatch can publish and tokens cannot reach test jobs', () => {
  assert.deepEqual(Object.keys(release.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(yaml('ci').on).sort(), ['merge_group', 'pull_request']);
  assert.deepEqual(release.permissions, {});
  assert.deepEqual(release.jobs.prepare.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(release.jobs.publish.permissions, { 'id-token': 'write' });
  assert.equal(release.jobs.publish.needs, 'prepare');
  for (const [job, { steps, 'runs-on': runner }] of Object.entries(release.jobs)) {
    assert.equal(runner, 'ubuntu-latest');
    for (const step of steps) {
      if (step.uses) assert.match(step.uses, /^actions\/[\w-]+@[0-9a-f]{40}$/);
      assert.doesNotMatch(JSON.stringify(step), /NODE_AUTH_TOKEN|registry-url|secrets\./);
      if (job !== 'publish') assert.doesNotMatch(step.run ?? '', /\bnpm publish\b/);
    }
  }
});

test('publish step refuses missing or changed bytes, taken version and moved main', async () => {
  const { spawnSync } = await import('node:child_process');
  const { createHash } = await import('node:crypto');
  const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'solid-web-release-'));
  const bytes = 'synthetic artifact';
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const run = release.jobs.publish.steps.at(-1).run;
  const stubs = `
    function curl() { printf '%s' "$REGISTRY_STATUS"; }
    function git() { printf '%s\\trefs/heads/main\\n' "$MAIN_SHA"; }
    function npm() { printf '%s\\n' 'publish would run'; }
  `;
  try {
    const dir = join(root, 'publish');
    mkdirSync(dir);
    const file = join(dir, 'sylphx-solid-web-0.1.0.tgz');
    const env = { ...process.env, RUNNER_TEMP: root, RELEASE_VERSION: '0.1.0',
      RELEASE_SHA: sha, MAIN_SHA: sha, EXPECTED_SHA256: sha256, REGISTRY_STATUS: '404' };
    const cases = [
      ['missing file', null, {}, false],
      ['changed bytes', 'tampered fixture', {}, false],
      ['missing digest', bytes, { EXPECTED_SHA256: '' }, false],
      ['taken version', bytes, { REGISTRY_STATUS: '200' }, false],
      ['unreadable registry', bytes, { REGISTRY_STATUS: '503' }, false],
      ['main moved', bytes, { MAIN_SHA: 'a'.repeat(40) }, false],
      ['matching artifact', bytes, {}, true],
    ];
    for (const [label, body, overrides, allowed] of cases) {
      if (body === null) rmSync(file, { force: true });
      else writeFileSync(file, body);
      const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', stubs + run], {
        env: { PATH: env.PATH, RUNNER_TEMP: env.RUNNER_TEMP, RELEASE_VERSION: env.RELEASE_VERSION,
          RELEASE_SHA: env.RELEASE_SHA, MAIN_SHA: env.MAIN_SHA, EXPECTED_SHA256: env.EXPECTED_SHA256,
          REGISTRY_STATUS: env.REGISTRY_STATUS, ...overrides }, encoding: 'utf8',
      });
      assert.equal(result.status === 0, allowed, label);
      assert.equal(result.stdout.includes('publish would run'), allowed, label);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
