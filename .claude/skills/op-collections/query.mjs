#!/usr/bin/env node
// Read the Open Pulse hub's indexed collections ("indices") and store stats.
//
// Reads OPENPULSE_ENDPOINT (base URL) and OPENPULSE_AUTH (user/password)
// from the nearest .env walking up, or from process.env. HTTP Basic,
// password-only (username ignored). All read-only.
//
// Subcommands: stats | cstats <name> | rows <name> | export <name> | get <path>
// Flags: --q --sort --page --size --fmt(csv|json) --param k=v --raw
//
// Usage:
//   node query.mjs stats
//   node query.mjs rows github_repos --q "deep learning" --size 20
//   node query.mjs export huggingface_models --fmt json --q epfl > models.json

import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function loadDotenv() {
	for (let dir of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
		for (let i = 0; i < 10; i++) {
			const envPath = join(dir, '.env');
			try {
				await stat(envPath);
				const text = await readFile(envPath, 'utf8');
				for (const line of text.split('\n')) {
					const t = line.trim();
					if (!t || t.startsWith('#') || !t.includes('=')) continue;
					const j = t.indexOf('=');
					const k = t.slice(0, j).trim();
					if (process.env[k] === undefined) process.env[k] = t.slice(j + 1).trim();
				}
				return;
			} catch {
				const parent = dirname(dir);
				if (parent === dir) break;
				dir = parent;
			}
		}
	}
}

function parseArgs(argv) {
	const pos = [];
	const o = { param: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--raw') o.raw = true;
		else if (a === '--q') o.q = argv[++i];
		else if (a === '--sort') o.sort = argv[++i];
		else if (a === '--page') o.page = argv[++i];
		else if (a === '--size') o.size = argv[++i];
		else if (a === '--fmt') o.fmt = argv[++i];
		else if (a === '--param') o.param.push(argv[++i]);
		else pos.push(a);
	}
	return { pos, o };
}

async function httpGet(path, params, raw) {
	const endpoint = process.env.OPENPULSE_ENDPOINT;
	const auth = process.env.OPENPULSE_AUTH;
	if (!endpoint || !auth || !auth.includes('/')) {
		console.error('error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set');
		process.exit(2);
	}
	const [user, ...rest] = auth.split('/');
	const password = rest.join('/');
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
	let url = `${endpoint.replace(/\/$/, '')}${path}`;
	if ([...qs].length) url += `?${qs}`;
	const token = Buffer.from(`${user}:${password}`).toString('base64');
	let res;
	try {
		res = await fetch(url, { headers: { Authorization: `Basic ${token}`, Accept: 'application/json' } });
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	}
	const text = await res.text();
	if (!res.ok) {
		console.error(`http ${res.status}: ${text}`);
		process.exit(1);
	}
	if (raw) {
		process.stdout.write(text.endsWith('\n') ? text : text + '\n');
		return;
	}
	try {
		process.stdout.write(JSON.stringify(JSON.parse(text), null, 2) + '\n');
	} catch {
		process.stdout.write(text.endsWith('\n') ? text : text + '\n');
	}
}

async function main() {
	await loadDotenv();
	const { pos, o } = parseArgs(process.argv.slice(2));
	const cmd = pos.shift();
	const a = pos.shift();
	const extra = {};
	for (const pair of o.param) {
		const i = pair.indexOf('=');
		extra[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
	}
	if (cmd === 'stats') return httpGet('/api/stats/', extra, o.raw);
	if (cmd === 'cstats') return httpGet(`/api/hub/c/${a}/stats`, extra, o.raw);
	if (cmd === 'rows') return httpGet(`/api/hub/c/${a}/rows`, { q: o.q, sort: o.sort, page: o.page, size: o.size, ...extra }, o.raw);
	if (cmd === 'export') return httpGet(`/api/hub/c/${a}/export`, { q: o.q, sort: o.sort, fmt: o.fmt || 'csv', ...extra }, true);
	if (cmd === 'get') return httpGet(a.startsWith('/') ? a : `/${a}`, extra, o.raw);
	console.error(`error: unknown command '${cmd}'`);
	process.exit(2);
}

main();
