#!/usr/bin/env node
// Monitor and control the Open Pulse crawler.
//
// A crawl is launched as the `crawler` step of a pipeline quest (see the
// op-extractor skill); each launch registers a job here, which this skill
// lists, inspects, and controls (pause / resume / cancel / delete).
//
// Reads OPENPULSE_ENDPOINT, OPENPULSE_AUTH (reader) and OPENPULSE_ADMIN_AUTH
// (admin, REQUIRED for control) from the nearest .env or process.env.
//
// Read:    jobs | job <id> | frontier-preview | run <id>
// Control: pause <id> | resume <id> | cancel <id> | delete <id>
// Generic: get <path>
// Flags:   --input-dir --input-filename --sample --tail --param k=v --raw
//
// Usage:
//   node query.mjs jobs
//   node query.mjs job 8f1c2a9b
//   node query.mjs pause 8f1c2a9b

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
		else if (a === '--input-dir') o.input_dir = argv[++i];
		else if (a === '--input-filename') o.input_filename = argv[++i];
		else if (a === '--sample') o.sample = argv[++i];
		else if (a === '--tail') o.tail = argv[++i];
		else if (a === '--param') o.param.push(argv[++i]);
		else pos.push(a);
	}
	return { pos, o };
}

async function request(method, path, params, admin, raw) {
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
	let res;
	try {
		res = await fetch(url, { method, headers: { Authorization: `Basic ${token}`, Accept: 'application/json' } });
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
	if (c === 'jobs') return request('GET', '/api/crawler/jobs', extra, false, o.raw);
	if (c === 'job') return request('GET', `/api/crawler/jobs/${a}`, extra, false, o.raw);
	if (c === 'frontier-preview')
		return request('GET', '/api/pipeline/frontier-preview', { input_dir: o.input_dir, input_filename: o.input_filename, sample: o.sample, ...extra }, false, o.raw);
	if (c === 'run') return request('GET', '/api/pipeline/run-by-job', { job_id: a, tail: o.tail, ...extra }, false, o.raw);
	if (c === 'pause' || c === 'resume' || c === 'cancel') return request('POST', `/api/crawler/jobs/${a}/${c}`, extra, true, o.raw);
	if (c === 'delete') return request('DELETE', `/api/crawler/jobs/${a}`, extra, true, o.raw);
	if (c === 'get') return request('GET', a.startsWith('/') ? a : `/${a}`, extra, false, o.raw);
	console.error(`error: unknown command '${c}'`);
	process.exit(2);
}

main();
