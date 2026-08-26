#!/usr/bin/env node
// Send a SPARQL query to the Open Pulse hub gateway (HTTPS).
//
// Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
// username ignored) from the nearest .env walking up, or from process.env,
// and posts to {OPENPULSE_ENDPOINT}/sparql/query. Set SPARQL_ENDPOINT /
// SPARQL_AUTH to override the derived values.
//
// Usage:
//   node query.mjs 'SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }'
//   node query.mjs -                              # stdin
//   node query.mjs -f path/to/query.rq
//   node query.mjs --accept turtle 'CONSTRUCT ...'
//
// Updates (/update) are deliberately not supported — use curl if you
// need to mutate.

import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACCEPT_MAP = {
	json: 'application/sparql-results+json',
	csv: 'text/csv',
	xml: 'application/sparql-results+xml',
	turtle: 'text/turtle'
};

async function loadDotenv() {
	for (let dir of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
		for (let i = 0; i < 10; i++) {
			const envPath = join(dir, '.env');
			try {
				await stat(envPath);
				const text = await readFile(envPath, 'utf8');
				for (const line of text.split('\n')) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
					const idx = trimmed.indexOf('=');
					const key = trimmed.slice(0, idx).trim();
					const value = trimmed.slice(idx + 1).trim();
					if (process.env[key] === undefined) process.env[key] = value;
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

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

async function readQuery(argv) {
	const fileFlag = argv.indexOf('-f');
	if (fileFlag !== -1 && argv[fileFlag + 1]) {
		return await readFile(resolve(argv[fileFlag + 1]), 'utf8');
	}
	const positional = argv.find((a, i) => !a.startsWith('-') && argv[i - 1] !== '--accept');
	if (positional === '-' || positional === undefined) return await readStdin();
	return positional;
}

function flag(argv, name) {
	const i = argv.indexOf(name);
	return i === -1 ? null : argv[i + 1];
}

async function main() {
	const argv = process.argv.slice(2);
	await loadDotenv();

	const base = process.env.OPENPULSE_ENDPOINT;
	const endpoint = process.env.SPARQL_ENDPOINT || (base && `${base.replace(/\/$/, '')}/sparql`);
	const auth = process.env.SPARQL_AUTH || process.env.OPENPULSE_AUTH;
	if (!endpoint || !auth || !auth.includes('/')) {
		console.error('error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set');
		process.exit(2);
	}

	const [user, ...passwordParts] = auth.split('/');
	const password = passwordParts.join('/');
	const query = (await readQuery(argv)).trim();
	if (!query) {
		console.error('error: empty query');
		process.exit(2);
	}

	const acceptKey = flag(argv, '--accept') || 'json';
	if (!ACCEPT_MAP[acceptKey]) {
		console.error(`error: unknown --accept value '${acceptKey}'`);
		process.exit(2);
	}
	const raw = argv.includes('--raw');

	const token = Buffer.from(`${user}:${password}`).toString('base64');
	const url = `${endpoint.replace(/\/$/, '')}/query`;
	const body = new URLSearchParams({ query }).toString();

	let res;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${token}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: ACCEPT_MAP[acceptKey]
			},
			body
		});
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	}

	if (!res.ok) {
		console.error(`http ${res.status}: ${await res.text()}`);
		process.exit(1);
	}

	const text = await res.text();
	if (raw || acceptKey !== 'json') {
		process.stdout.write(text.endsWith('\n') ? text : text + '\n');
		return;
	}

	const payload = JSON.parse(text);
	const bindings = payload.results?.bindings;
	if (bindings) {
		const rows = bindings.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.value])));
		process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
	} else {
		process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
	}
}

main();
