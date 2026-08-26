#!/usr/bin/env node
// sync-agents.mjs — regenerate the vendor-neutral `.agents/` mirror from the
// canonical `.claude/` sources so the two never drift.
//
// CANONICAL (edit these):           GENERATED (do not edit):
//   CLAUDE.md                  -->    AGENTS.md
//   .claude/PROJECT.md         -->    .agents/PROJECT.md
//   .claude/SKILLS.md          -->    .agents/SKILLS.md
//   .claude/skills/**          -->    .agents/skills/**
//
// Markdown files get dialect substitutions (CLAUDE.md -> AGENTS.md, .claude -> .agents);
// everything else (query.py, query.mjs, ...) is copied byte-for-byte.
//
// Regions wrapped in `<!-- sync:keep -->` ... `<!-- sync:endkeep -->` are copied
// verbatim with NO substitution — use them for text that must read identically in
// both dialects (e.g. "edit .claude/ only").
//
// Usage:
//   node tools/sync-agents.mjs           regenerate .agents/ + AGENTS.md
//   node tools/sync-agents.mjs --check   exit 1 if any generated file is stale (CI gate)

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const MD_EXT = /\.mdx?$/i;

/** Apply CLAUDE -> AGENTS dialect substitutions, skipping sync:keep regions. */
function toAgentsDialect(text) {
  return text
    .split(/(<!-- sync:keep -->[\s\S]*?<!-- sync:endkeep -->)/g)
    .map((chunk) =>
      chunk.startsWith('<!-- sync:keep -->')
        ? chunk
        : chunk.replaceAll('CLAUDE.md', 'AGENTS.md').replaceAll('.claude', '.agents'),
    )
    .join('');
}

/** Recursively collect every file under `dir` as paths relative to `dir`. */
function walk(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, acc);
    else acc.push(relative(base, full));
  }
  return acc;
}

/** One file -> its transformed bytes (string). */
function transform(srcPath, content) {
  return MD_EXT.test(srcPath) ? toAgentsDialect(content) : content;
}

const stale = [];
let written = 0;

/** Write (or check) one generated file. */
function emit(destAbs, content) {
  const exists = existsSync(destAbs);
  const current = exists ? readFileSync(destAbs, 'utf8') : null;
  if (current === content) return;
  stale.push(relative(ROOT, destAbs));
  if (!CHECK) {
    mkdirSync(dirname(destAbs), { recursive: true });
    writeFileSync(destAbs, content);
    written++;
  }
}

// 1. Root + doc files: CLAUDE.md -> AGENTS.md, .claude/<doc> -> .agents/<doc>
const docPairs = [
  ['CLAUDE.md', 'AGENTS.md'],
  ['.claude/PROJECT.md', '.agents/PROJECT.md'],
  ['.claude/SKILLS.md', '.agents/SKILLS.md'],
];
for (const [src, dest] of docPairs) {
  const srcAbs = join(ROOT, src);
  if (!existsSync(srcAbs)) continue;
  emit(join(ROOT, dest), transform(src, readFileSync(srcAbs, 'utf8')));
}

// 2. Skills tree: .claude/skills/** -> .agents/skills/**
const skillsSrc = join(ROOT, '.claude', 'skills');
const skillsDest = join(ROOT, '.agents', 'skills');
const srcFiles = new Set(walk(skillsSrc).map((p) => p.split('\\').join('/')));

for (const rel of srcFiles) {
  const raw = readFileSync(join(skillsSrc, rel), 'utf8');
  emit(join(skillsDest, rel), transform(rel, raw));
}

// 3. Prune files in .agents/skills that no longer exist in .claude/skills
for (const rel of walk(skillsDest).map((p) => p.split('\\').join('/'))) {
  if (!srcFiles.has(rel)) {
    stale.push(`.agents/skills/${rel} (orphan)`);
    if (!CHECK) rmSync(join(skillsDest, rel));
  }
}

if (CHECK) {
  if (stale.length) {
    console.error('✗ .agents/ is out of sync with .claude/. Stale/missing:');
    for (const f of stale) console.error(`    ${f}`);
    console.error('\nRun: node tools/sync-agents.mjs');
    process.exit(1);
  }
  console.log('✓ .agents/ is in sync with .claude/');
} else {
  console.log(written ? `✓ synced ${written} file(s) into .agents/ + AGENTS.md` : '✓ already in sync, nothing to write');
}
