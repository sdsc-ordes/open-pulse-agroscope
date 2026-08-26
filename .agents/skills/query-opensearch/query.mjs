#!/usr/bin/env node
// Query the Open Pulse OpenSearch cluster through the hub gateway (HTTPS).
//
// Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
// username ignored, the token is what matters) from the nearest .env
// walking up from this file, or from process.env, and posts to
// {OPENPULSE_ENDPOINT}/api/databases/opensearch/query.
//
// Two modes:
//
//   SQL (default) — OpenSearch SQL plugin dialect; queries must start
//   with SELECT, SHOW or DESCRIBE. Index names are the FROM targets.
//
//   DSL (--dsl <index>) — the query argument is a JSON search body sent
//   to that index. Use this for aggregations, filters, and anything the
//   SQL dialect can't express.
//
// The gateway returns {columns, rows, row_count, raw}; rows are
// flattened to a JSON array of objects. For DSL aggregations the full
// response envelope is in `raw` — print it with --raw.
//
// Usage:
//   node query.mjs 'SELECT hash, author_date FROM git ORDER BY author_date DESC LIMIT 5'
//   node query.mjs -                        # query from stdin
//   node query.mjs -f path/to/query.sql     # query from file
//   node query.mjs --dsl git_demo_enriched '{"size":0,"aggs":{"repos":{"terms":{"field":"repo_name","size":10}}}}'

import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
	const positional = argv.find((a, i) => !a.startsWith('-') && argv[i - 1] !== '--dsl');
	if (positional === '-' || positional === undefined) return await readStdin();
	return positional;
}

// `repo_name` is a clone URL and the .git suffix is NOT guaranteed — an exact
// term match on the wrong form returns 0 hits with no error.
function repoNameValues(node) {
	let found = [];
	if (Array.isArray(node)) {
		for (const item of node) found = found.concat(repoNameValues(item));
	} else if (node && typeof node === 'object') {
		for (const [key, val] of Object.entries(node)) {
			if (key === 'repo_name') {
				if (typeof val === 'string') found.push(val);
				else if (Array.isArray(val)) found = found.concat(val.filter((v) => typeof v === 'string'));
				else if (val && typeof val.value === 'string') found.push(val.value);
			} else {
				found = found.concat(repoNameValues(val));
			}
		}
	}
	return found;
}

function warnRepoName(values) {
	for (const v of values) {
		if (v.includes('*') || v.includes('?')) continue;
		if (!/^https?:\/\//.test(v)) {
			console.error(
				`warning: repo_name matched against '${v}', which is not a clone URL — ` +
				`values look like 'https://github.com/owner/repo' (the '.git' suffix varies). ` +
				`Discover the real key with a wildcard + terms agg first.`
			);
		}
	}
}

async function main() {
	const argv = process.argv.slice(2);
	await loadDotenv();

	const endpoint = process.env.OPENPULSE_ENDPOINT;
	const auth = process.env.OPENPULSE_AUTH;
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

	const dslFlag = argv.indexOf('--dsl');
	let body;
	if (dslFlag !== -1) {
		const index = argv[dslFlag + 1];
		if (!index || index.startsWith('-')) {
			console.error('error: --dsl requires an index name');
			process.exit(2);
		}
		let dslBody;
		try {
			dslBody = JSON.parse(query);
		} catch (e) {
			console.error(`error: DSL body is not valid JSON: ${e.message}`);
			process.exit(2);
		}
		if (typeof dslBody !== 'object' || dslBody === null || Array.isArray(dslBody)) {
			console.error(`error: DSL body must be a JSON object, got ${Array.isArray(dslBody) ? 'array' : typeof dslBody}`);
			process.exit(2);
		}
		if ('index' in dslBody) {
			console.error(`warning: DSL body already sets "index": '${dslBody.index}' — overriding it with --dsl '${index}'`);
		}
		warnRepoName(repoNameValues(dslBody));
		body = { mode: 'dsl', query: { ...dslBody, index } };
	} else {
		if (!/^\s*(SELECT|SHOW|DESCRIBE)\b/i.test(query)) {
			const verb = query.trim().split(/\s+/)[0];
			console.error(
				`error: SQL mode accepts SELECT / SHOW / DESCRIBE, got '${verb}'. ` +
				`For aggregations or filters use DSL mode: --dsl <index> '<json body>'`
			);
			process.exit(2);
		}
		for (const m of query.matchAll(/repo_name\s*(?:=|LIKE)\s*'([^']*)'/gi)) warnRepoName([m[1]]);
		body = { mode: 'sql', query };
	}

	const url = `${endpoint.replace(/\/$/, '')}/api/databases/opensearch/query`;
	const token = Buffer.from(`${user}:${password}`).toString('base64');

	let res;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${token}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(body)
		});
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	}

	if (!res.ok) {
		console.error(`http ${res.status}: ${await res.text()}`);
		process.exit(1);
	}

	const payload = await res.json();
	if (argv.includes('--raw')) {
		process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
		return;
	}
	const rows = payload.rows.map((r) =>
		Object.fromEntries(payload.columns.map((c, i) => [c, r[i]]))
	);
	process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
}

main();
