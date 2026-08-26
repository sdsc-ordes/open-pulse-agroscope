#!/usr/bin/env node
// Drive the Open Pulse pipeline ("quests") — run & monitor the git metadata
// extractor and the other pipeline steps. The git metadata extractor is the
// `metadata_extractor` step of a quest.
//
// Reads OPENPULSE_ENDPOINT, OPENPULSE_AUTH (reader) and OPENPULSE_ADMIN_AUTH
// (admin, REQUIRED for run/create/stop) from the nearest .env or process.env.
// Mutating subcommands use admin creds; without them the server returns 403.
//
// Read:    quests | quest <path> | runs | status <run_id> | run-by-job <job_id> | archives
// Mutate:  run --body <json|@file> | create --body <json|@file> | stop <run_id> [--force]
// Generic: get <path> | post <path> --body <json|@file>
// Flags:   --limit --tail --force --body --param k=v --raw
//
// Usage:
//   node query.mjs runs --limit 10
//   node query.mjs status 440f5d1fd999 --tail 20
//   node query.mjs run --body '{"path":"/open-pulse/open-pulse/data/quests/gme-hybrid-all.yml"}'

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
		else if (a === '--force') o.force = true;
		else if (a === '--limit') o.limit = argv[++i];
		else if (a === '--tail') o.tail = argv[++i];
		else if (a === '--body') o.body = argv[++i];
		else if (a === '--param') o.param.push(argv[++i]);
		else pos.push(a);
	}
	return { pos, o };
}

async function readBody(spec) {
	if (spec === undefined) return undefined;
	if (spec.startsWith('@')) return JSON.parse(await readFile(spec.slice(1), 'utf8'));
	return JSON.parse(spec);
}

async function request(method, path, params, body, admin, raw) {
	const endpoint = process.env.OPENPULSE_ENDPOINT;
	const auth = (admin && process.env.OPENPULSE_ADMIN_AUTH) || process.env.OPENPULSE_AUTH;
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
	const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' };
	const init = { method, headers };
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
		init.body = JSON.stringify(body);
	}
	let res;
	try {
		res = await fetch(url, init);
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
	const c = pos.shift();
	const a = pos.shift();
	const extra = {};
	for (const pair of o.param) {
		const i = pair.indexOf('=');
		extra[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
	}
	const body = await readBody(o.body);
	if (c === 'quests') return request('GET', '/api/pipeline/quests', extra, undefined, false, o.raw);
	if (c === 'quest') return request('GET', '/api/pipeline/quest', { path: a, ...extra }, undefined, false, o.raw);
	if (c === 'runs') return request('GET', '/api/pipeline/runs', { limit: o.limit, ...extra }, undefined, false, o.raw);
	if (c === 'status') return request('GET', '/api/pipeline/run-status', { run_id: a, tail: o.tail, ...extra }, undefined, false, o.raw);
	if (c === 'run-by-job') return request('GET', '/api/pipeline/run-by-job', { job_id: a, tail: o.tail, ...extra }, undefined, false, o.raw);
	if (c === 'archives') return request('GET', '/api/pipeline/archives', extra, undefined, false, o.raw);
	if (c === 'run') return request('POST', '/api/pipeline/run', extra, body, true, o.raw);
	if (c === 'create') return request('POST', '/api/pipeline/create', extra, body, true, o.raw);
	if (c === 'stop') return request('POST', '/api/pipeline/run-stop', { run_id: a, force: String(!!o.force), ...extra }, undefined, true, o.raw);
	if (c === 'get') return request('GET', a.startsWith('/') ? a : `/${a}`, extra, undefined, false, o.raw);
	if (c === 'post') return request('POST', a.startsWith('/') ? a : `/${a}`, extra, body, true, o.raw);
	console.error(`error: unknown command '${c}'`);
	process.exit(2);
}

main();
