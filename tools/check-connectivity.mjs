#!/usr/bin/env node
/* pulseWebKit connectivity check.
 *
 * Reads the repo-root .env and live-checks every Open Pulse endpoint
 * through the hub HTTPS gateway — Neo4j (Cypher), SPARQL (Oxigraph),
 * OpenSearch, the CHAOSS metrics API, and the Open Pulse hub itself — using
 * OPENPULSE_ENDPOINT/OPENPULSE_AUTH (the per-store *_ENDPOINT/*_AUTH vars
 * only override where a store is derived from). Run it after filling in
 * .env, so bad credentials or an unreachable gateway surface now rather
 * than as empty charts later:
 *
 *   npm run check-connectivity      (repo root)
 *   node tools/check-connectivity.mjs
 *
 * It only reads — it never writes .env or any app file, and nothing ships to
 * the browser. A ✖ is diagnostic, not fatal: fix the value in .env and
 * re-run. Services whose keys are still placeholders are skipped.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- terminal helpers ---------------- */

const useColor = !!process.stdout.isTTY;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');

const rel = (p) => p.slice(ROOT.length + 1);

function ok(name, detail) {
  console.log(`  ${green('✔')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function fail(name, detail) {
  console.log(`  ${red('✖')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function note(msg) {
  console.log(`  ${yellow('•')} ${msg}`);
}

/* ---------------- .env parsing ---------------- */

function parseEnv(text) {
  const map = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

const isPlaceholder = (v) => !v || /xxxx|replace.?me/i.test(v);

/* ---------------- service checks ---------------- */

function basicAuth(pair) {
  const i = pair.indexOf('/');
  const user = i === -1 ? pair : pair.slice(0, i);
  const pass = i === -1 ? '' : pair.slice(i + 1);
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

const fmtCount = (n) => Number(n).toLocaleString('en-US').replace(/,/g, ' ');

const results = { ok: 0, failed: 0, skipped: 0 };

async function checkService(name, envKeys, env, fn) {
  const missing = envKeys.find((k) => isPlaceholder(env[k]));
  if (missing) {
    note(`${name} — skipped (${missing} not filled in).`);
    results.skipped++;
    return;
  }
  try {
    const detail = await fn();
    ok(name, detail);
    results.ok++;
  } catch (e) {
    fail(name, e?.message ?? String(e));
    results.failed++;
  }
}

async function run() {
  console.log(`
${bold('pulseWebKit connectivity check')}
${dim('─'.repeat(64))}
Live-checks every Open Pulse endpoint with the credentials in your .env.`);

  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.log();
    note('No .env at the repo root. Copy .env.example → .env and fill it in,');
    note('then re-run this check.');
    process.exit(0);
  }

  const env = parseEnv(await readFile(envPath, 'utf8'));
  const timeout = () => AbortSignal.timeout(10_000);
  console.log(`\n  Using ${bold(rel(envPath))}\n`);

  // Every store is reached through the one HTTPS hub gateway. *_ENDPOINT /
  // *_AUTH per-store vars only override where a store's URL/token is
  // derived from — they are not separate raw transports.
  const gatewayEndpoint = (env.OPENPULSE_ENDPOINT ?? '').replace(/\/$/, '');
  const gatewayAuth = (key, fallbackKey = 'OPENPULSE_AUTH') =>
    isPlaceholder(env[key]) ? env[fallbackKey] : env[key];

  await checkService('Neo4j (Cypher via gateway)', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const res = await fetch(`${gatewayEndpoint}/api/databases/cypher/query`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(env.OPENPULSE_AUTH),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: 'MATCH (n) RETURN count(n) AS n' }),
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    return `${fmtCount(body.rows[0][0])} nodes`;
  });

  await checkService('SPARQL (Oxigraph via gateway)', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const ep = isPlaceholder(env.SPARQL_ENDPOINT) ? `${gatewayEndpoint}/sparql` : env.SPARQL_ENDPOINT.replace(/\/$/, '');
    const auth = gatewayAuth('SPARQL_AUTH');
    const res = await fetch(`${ep}/query`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(auth),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: `query=${encodeURIComponent('ASK { ?s ?p ?o }')}`,
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    return body.boolean ? 'reachable, graph has triples' : 'reachable (empty default graph)';
  });

  await checkService('OpenSearch (via gateway)', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const res = await fetch(`${gatewayEndpoint}/api/databases/opensearch/query`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(env.OPENPULSE_AUTH),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ mode: 'sql', query: 'SELECT count(*) FROM git_demo_enriched' }),
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    return `${fmtCount(body.rows[0][0])} commit docs`;
  });

  await checkService('CHAOSS metrics API (via gateway)', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const ep = isPlaceholder(env.CHAOSS_ENDPOINT) ? gatewayEndpoint : env.CHAOSS_ENDPOINT.replace(/\/$/, '');
    const auth = gatewayAuth('CHAOSS_AUTH');
    const res = await fetch(`${ep}/api/v1/metrics/chaoss`, {
      headers: { Authorization: basicAuth(auth), Accept: 'application/json' },
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'reachable';
  });

  await checkService('Open Pulse hub', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const res = await fetch(`${gatewayEndpoint}/api/stats/`, {
      headers: { Authorization: basicAuth(env.OPENPULSE_AUTH), Accept: 'application/json' },
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'reachable';
  });

  console.log(
    `\n  ${bold('Result')} — ${green(`${results.ok} ok`)}, ${results.failed ? red(`${results.failed} failed`) : `${results.failed} failed`}, ${dim(`${results.skipped} skipped`)}.`,
  );
  console.log(dim('  A ✖ is diagnostic, not fatal — fix the value in .env and re-run.'));
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node tools/check-connectivity.mjs\nLive-checks the Open Pulse endpoints in .env — see the header comment.');
  process.exit(0);
}

await run();
