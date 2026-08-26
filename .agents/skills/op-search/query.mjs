#!/usr/bin/env node
// Semantic / vector search over the Open Pulse extractor indices (RAG).
//
// The Git Metadata Extractor service (GME API v3) indexes every source into a
// per-provider vector store and serves semantic search with reranking — each
// hit carries a vector_score (embedding similarity) and rerank_score
// (cross-encoder). Distinct from op-collections (exact DuckDB lookups).
//
// Reads OPENPULSE_ENDPOINT (base host) and OPENPULSE_AUTH (user/password) from
// the nearest .env or process.env; appends /api/extractor. Read-only.
//
// Subcommands: search <provider> <query> | stats <provider> | manifest | freshness | get <path>
// Flags: --top-k --candidate-k --target --filter <json> --sources --param k=v --raw
//
// Usage:
//   node query.mjs search github_repos "protein structure prediction" --top-k 5
//   node query.mjs search orcid "machine learning EPFL" --target persons
//   node query.mjs manifest

import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTRACTOR_BASE = '/api/extractor';

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
		else if (a === '--sources') o.sources = true;
		else if (a === '--top-k') o.top_k = Number(argv[++i]);
		else if (a === '--candidate-k') o.candidate_k = Number(argv[++i]);
		else if (a === '--target') o.target = argv[++i];
		else if (a === '--filter') o.filter = argv[++i];
		else if (a === '--param') o.param.push(argv[++i]);
		else pos.push(a);
	}
	return { pos, o };
}

async function request(method, path, params, body, raw) {
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
	let url = `${endpoint.replace(/\/$/, '')}${EXTRACTOR_BASE}${path}`;
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
	if (c === 'search') {
		const query = pos.join(' ').trim();
		if (!a || !query) {
			console.error('error: usage: search <provider> <query>');
			process.exit(2);
		}
		const body = { query, top_k: o.top_k, candidate_k: o.candidate_k, target: o.target };
		if (o.filter) body.filter_payload = JSON.parse(o.filter);
		for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
		return request('POST', `/v2/indices/${a}/search`, extra, body, o.raw);
	}
	if (c === 'stats') return request('GET', `/v2/indices/${a}/stats`, extra, undefined, o.raw);
	if (c === 'manifest') return request('GET', '/v2/manifest', { sources: o.sources ? 'true' : undefined, ...extra }, undefined, o.raw);
	if (c === 'freshness') return request('GET', '/v2/indices/freshness', extra, undefined, o.raw);
	if (c === 'get') return request('GET', a.startsWith('/') ? a : `/${a}`, extra, undefined, o.raw);
	console.error(`error: unknown command '${c}'`);
	process.exit(2);
}

main();
