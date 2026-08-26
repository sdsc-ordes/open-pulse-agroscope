#!/usr/bin/env node
// Run a Cypher query against the Open Pulse hub gateway (HTTPS).
//
// Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
// username ignored, the token is what matters) from the nearest .env
// walking up from the CWD (then from this file), or from process.env,
// and posts to {OPENPULSE_ENDPOINT}/api/databases/cypher/query. Prints
// the rows as JSON to stdout.
//
// Reader tokens get a read-only Neo4j transaction — any write clause
// (CREATE/MERGE/DELETE/SET) returns 403.
//
// Usage:
//   node query.mjs 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n'
//   node query.mjs -                          # read query from stdin
//   node query.mjs -f path/to/query.cypher    # read query from file

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
	const positional = argv.find((a) => !a.startsWith('-'));
	if (positional === '-' || positional === undefined) return await readStdin();
	return positional;
}

// Identifier properties hold FULL GitHub URLs, not bare slugs. Matching
// `full_name:'owner/repo'` is the most common cause of a silent empty result.
function warnBareIdentifiers(cypher) {
	const re = /\b(full_name|login)\b\s*:\s*(['"])([^'"]*)\2/g;
	let m;
	while ((m = re.exec(cypher)) !== null) {
		const value = m[3];
		if (value && !/^https?:\/\//.test(value)) {
			console.error(
				`warning: ${m[1]} matched against '${value}', which is not a full URL — ` +
				`identifiers in this graph are full GitHub URLs ` +
				`(try 'https://github.com/${value.replace(/^\/+/, '')}'). ` +
				`This query will likely return zero rows.`
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
	const cypher = (await readQuery(argv)).trim();
	if (!cypher) {
		console.error('error: empty query');
		process.exit(2);
	}
	warnBareIdentifiers(cypher);

	const url = `${endpoint.replace(/\/$/, '')}/api/databases/cypher/query`;
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
			body: JSON.stringify({ query: cypher })
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
	const rows = payload.rows.map((r) =>
		Object.fromEntries(payload.columns.map((c, i) => [c, r[i]]))
	);
	process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
}

main();
