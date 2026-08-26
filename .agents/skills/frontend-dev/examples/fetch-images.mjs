#!/usr/bin/env node
/* Build-time image snapshot — reference implementation of the frontend-dev
 * §6 image rule: every image the app renders is baked at build time into
 * src/data/images.json as a WebP data URI. The site stays fully static and
 * the browser never fetches an image from a third party.
 *
 * Three sections, each optional — keep what your dashboard renders, delete
 * the rest, and keep the payload bounded (only snapshot images that actually
 * appear on a page):
 *   1. partner/institution logos  (hand-picked public URLs + local files)
 *   2. GitHub org avatars         (one per organisation in repos.json)
 *   3. repo card thumbnails       (GitHub social-preview, scoped to one feed)
 *
 * No credentials needed. Run after your fetch-data script (section 2 and 3
 * read src/data/repos.json to know which orgs/repos to fetch).
 * Requires `sharp` (npm i -D sharp).
 *
 * Usage:  node scripts/fetch-images.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'data');
const STATIC_LOGOS_DIR = join(HERE, '..', 'src', 'static', 'logos');
const UA = 'pulseWebKit/1.0 (build-time image fetch)';
/* Some institutional sites block anything that doesn't look like a browser,
 * regardless of how descriptive the UA string is. */
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* Partner/institution logos — public brand-asset URLs. Prefer SVG sources
 * with a transparent background and a single wordmark (no embedded colour
 * plate), so `filter: brightness(0) invert(1)` renders them cleanly in
 * white on a dark header/footer regardless of source colour. e.g.
 *   epfl: { url: 'https://…/logo_epfl_footer.svg', height: 100 },
 */
const LOGOS = {};

/* Logo files shipped in the repo (src/static/logos/) rather than fetched —
 * e.g. a finished dark-background lockup that must be used as-is:
 *   myOrgWhite: { file: 'my-org-logo-white.png', height: 100 },
 */
const LOCAL_LOGOS = {};

async function fetchBuffer(url, ua = UA) {
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toWebpDataUri(buffer, { height, width, quality = 82 } = {}) {
  const img = sharp(buffer, { density: 300 });
  if (height || width) img.resize({ height, width, fit: 'inside' });
  const webp = await img.webp({ quality }).toBuffer();
  return `data:image/webp;base64,${webp.toString('base64')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Retry-then-skip: a failed image is a warning, never a build failure —
 * the markup falls back to its no-image variant (design skill §6.7). */
async function safe(label, fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === retries;
      console.warn(`  ! ${label}: ${err.message}${isLast ? ' (giving up)' : ' (retrying…)'}`);
      if (isLast) return null;
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

/* ---------------- 1. partner/institution logos ---------------- */

console.log('1/3 Logos…');
const logos = {};
for (const [key, { url, height }] of Object.entries(LOGOS)) {
  const uri = await safe(key, async () => toWebpDataUri(await fetchBuffer(url, BROWSER_UA), { height, quality: 90 }));
  if (uri) logos[key] = uri;
}
for (const [key, { file, height }] of Object.entries(LOCAL_LOGOS)) {
  const uri = await safe(key, async () =>
    toWebpDataUri(await readFile(join(STATIC_LOGOS_DIR, file)), { height, quality: 90 }),
  );
  if (uri) logos[key] = uri;
}
console.log(
  `  ${Object.keys(logos).length}/${Object.keys(LOGOS).length + Object.keys(LOCAL_LOGOS).length} fetched`,
);

/* ---------------- 2. GitHub org avatars ---------------- */

console.log('2/3 GitHub org avatars…');
const repos = JSON.parse(await readFile(join(OUT_DIR, 'repos.json'), 'utf8'));
const orgAvatars = {};
for (const org of repos.orgs) {
  const uri = await safe(org.slug, async () =>
    toWebpDataUri(await fetchBuffer(`https://github.com/${org.slug}.png?size=128`), { height: 96, quality: 82 }),
  );
  if (uri) orgAvatars[org.slug] = uri;
}
console.log(`  ${Object.keys(orgAvatars).length}/${repos.orgs.length} fetched`);

/* ---------------- 3. repo card thumbnails ---------------- */
/* Scope this to the one feed that renders repo-level images — here, the 8
 * newest original repos — to keep the base64 payload bounded. GitHub's
 * social-preview image is the repo's custom preview (often a README
 * banner/logo) when the maintainer set one, else GitHub's auto-generated
 * card. */

console.log('3/3 Repo card thumbnails…');
const latest = repos.repos
  .filter((r) => !r.isFork && r.created)
  .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
  .slice(0, 8);
const repoCards = {};
for (const r of latest) {
  const uri = await safe(r.slug, async () =>
    toWebpDataUri(await fetchBuffer(`https://opengraph.githubassets.com/1/${r.slug}`), {
      width: 640,
      height: 320,
      quality: 68,
    }),
  );
  if (uri) repoCards[r.slug] = uri;
  await sleep(400);
}
console.log(`  ${Object.keys(repoCards).length}/${latest.length} fetched`);

/* ---------------- write ---------------- */

const out = { generatedAt: new Date().toISOString(), logos, orgAvatars, repoCards };
await writeFile(join(OUT_DIR, 'images.json'), JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(`Wrote src/data/images.json (${kb} kB)`);
