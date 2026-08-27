#!/usr/bin/env node
/* Build-time data snapshot for the Agroscope Open Source Dashboard.
 *
 * Resolves the scope (GitHub org `agroscope-ch`, ROR https://ror.org/04d8ztx87)
 * against Neo4j, SPARQL (Oxigraph), OpenSearch and the CHAOSS metrics API using
 * the same HTTP transports as the `query-*` skill scripts, and writes typed
 * JSON snapshots into src/data/. Credentials stay here, at build time — the
 * browser only ever reads the JSON files this script writes.
 *
 * Usage: npm run fetch-data   (from src/your-web/)
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'data');

const ORG_SLUG = 'agroscope-ch';
const ORG_URL = `https://github.com/${ORG_SLUG}`;
const ROR_ID = 'https://ror.org/04d8ztx87';
const ROR_NAME = 'Agroscope';

/* ---------------- .env + transports (mirrors the query-* skill scripts) ---------------- */

async function loadDotenv() {
  for (let dir of [process.cwd(), HERE]) {
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

function basicAuth(auth) {
  const [user, ...rest] = auth.split('/');
  const password = rest.join('/');
  return Buffer.from(`${user}:${password}`).toString('base64');
}

let ENDPOINT, AUTH;

async function neo4j(cypher) {
  const res = await fetch(`${ENDPOINT}/api/databases/cypher/query`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(AUTH)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: cypher }),
  });
  if (!res.ok) throw new Error(`neo4j ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  return payload.rows.map((r) => Object.fromEntries(payload.columns.map((c, i) => [c, r[i]])));
}

async function sparql(query) {
  const res = await fetch(`${ENDPOINT}/sparql/query`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(AUTH)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!res.ok) throw new Error(`sparql ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  return payload.results.bindings.map((b) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])),
  );
}

async function openSearchSql(sql) {
  const res = await fetch(`${ENDPOINT}/api/databases/opensearch/query`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(AUTH)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ mode: 'sql', query: sql }),
  });
  if (!res.ok) throw new Error(`opensearch ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  return payload.rows.map((r) => Object.fromEntries(payload.columns.map((c, i) => [c, r[i]])));
}

async function chaoss(path) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    headers: { Authorization: `Basic ${basicAuth(AUTH)}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`chaoss ${res.status}: ${await res.text()}`);
  return res.json();
}

async function wikidataLabels(qids) {
  if (qids.length === 0) return {};
  const labels = {};
  for (let i = 0; i < qids.length; i += 45) {
    const batch = qids.slice(i, i + 45);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=labels&languages=en&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'pulseWebKit/1.0 (build-time snapshot)' } });
    if (!res.ok) continue;
    const payload = await res.json();
    for (const [qid, ent] of Object.entries(payload.entities ?? {})) {
      labels[qid] = ent.labels?.en?.value ?? qid;
    }
  }
  return labels;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- main ---------------- */

async function main() {
  await loadDotenv();
  ENDPOINT = (process.env.OPENPULSE_ENDPOINT ?? '').replace(/\/$/, '');
  AUTH = process.env.OPENPULSE_AUTH;
  if (!ENDPOINT || !AUTH || !AUTH.includes('/')) {
    console.error('error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH must be set in .env');
    process.exit(2);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();

  /* ---- 1. Resolve scope: repos owned by the agroscope-ch GitHub org ---- */
  console.log('1/6 Neo4j — repo inventory + contributor counts…');
  const neo4jRepos = await neo4j(`
    MATCH (o:Org)-[:OWNS]->(r:Repo)
    WHERE o.url CONTAINS '${ORG_URL}' OR o.login CONTAINS '${ORG_URL}'
    OPTIONAL MATCH (u:User)-[:CONTRIBUTES_TO]->(r)
    WITH r, count(DISTINCT u) AS contributors
    OPTIONAL MATCH (r)-[:FORK_OF]->(upstream)
    RETURN r.name AS name, r.full_name AS url, contributors, upstream.full_name AS forkOf
    ORDER BY r.name
  `);
  console.log(`  ${neo4jRepos.length} repos in Neo4j (${neo4jRepos.filter((r) => r.forkOf).length} forks)`);

  /* ---- 2. SPARQL: type / license / language / stars / forks / discipline ---- */
  console.log('2/6 SPARQL — metadata (type, license, language, discipline)…');
  const OP = 'PREFIX op: <https://open-pulse.epfl.ch/ontology#>\nPREFIX gme: <https://openpulse.science/git-metadata-extractor#>\n';
  const meta = await sparql(`${OP}
    SELECT ?repo ?type ?license ?lang ?stars ?forks ?archived WHERE {
      ?repo op:ownedBy <${ROR_ID}> .
      OPTIONAL { ?repo op:repositoryType ?type }
      OPTIONAL { ?repo gme:license_name ?license }
      OPTIONAL { ?repo gme:primary_language ?lang }
      OPTIONAL { ?repo op:githubRepoStars ?stars }
      OPTIONAL { ?repo op:githubRepoForks ?forks }
      OPTIONAL { ?repo gme:archived ?archived }
    }
  `);
  const disciplineRows = await sparql(`${OP}
    SELECT ?repo ?discipline WHERE {
      ?repo op:ownedBy <${ROR_ID}> .
      ?repo op:discipline ?discipline .
    }
  `);
  console.log(`  ${meta.length} repos resolve op:ownedBy the Agroscope ROR; ${disciplineRows.length} discipline links`);

  const disciplinesByRepo = new Map();
  for (const row of disciplineRows) {
    const qid = row.discipline.split('/').pop();
    if (!disciplinesByRepo.has(row.repo)) disciplinesByRepo.set(row.repo, new Set());
    disciplinesByRepo.get(row.repo).add(qid);
  }
  const allQids = [...new Set(disciplineRows.map((r) => r.discipline.split('/').pop()))];
  const qidLabels = await wikidataLabels(allQids);
  console.log(`  resolved ${Object.keys(qidLabels).length}/${allQids.length} Wikidata discipline labels`);

  const metaByUrl = new Map(meta.map((m) => [m.repo, m]));

  /* ---- 3. Assemble repos.json ---- */
  const repos = neo4jRepos.map((r) => {
    const m = metaByUrl.get(r.url) ?? {};
    const disciplines = [...(disciplinesByRepo.get(r.url) ?? [])].map((qid) => qidLabels[qid] ?? qid);
    return {
      name: r.name,
      url: r.url,
      org: ORG_SLUG,
      type: m.type ? m.type.split('#').pop() : null,
      license: m.license ?? null,
      language: m.lang ?? null,
      stars: m.stars ? Number(m.stars) : 0,
      forks: m.forks ? Number(m.forks) : 0,
      archived: m.archived === 'true',
      isFork: Boolean(r.forkOf),
      forkOf: r.forkOf ?? null,
      contributors: Number(r.contributors ?? 0),
      disciplines,
    };
  });

  /* ---- 4. OpenSearch — commit activity for these exact repos ----
   * Deliberately scoped to the 20 agroscope-ch repos by explicit URL, NOT the
   * GrimoireLab `project = agroscope` tag — that tag also pulls in ~26 repos
   * from the unrelated `EOA-team` GitHub org (a different scope), which would
   * silently inflate every activity number. See DASHBOARD.md's reconnaissance
   * table for this trap. */
  console.log('3/6 OpenSearch — commit activity for the 20 agroscope-ch repos…');
  const repoList = repos.map((r) => `'${r.url}'`).join(',');
  const commitRows = await openSearchSql(
    `SELECT commit_date, repo_name, Author_uuid FROM git_demo_enriched WHERE repo_name IN (${repoList})`,
  );
  console.log(`  ${commitRows.length} commits, ${new Set(commitRows.map((c) => c.Author_uuid)).size} unique authors`);

  const commitsByRepo = new Map();
  const monthly = new Map();
  let minDate = null;
  let maxDate = null;
  for (const c of commitRows) {
    const date = c.commit_date?.slice(0, 10);
    if (!date) continue;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    const month = date.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
    commitsByRepo.set(c.repo_name, (commitsByRepo.get(c.repo_name) ?? 0) + 1);
  }
  for (const r of repos) r.commits = commitsByRepo.get(r.url) ?? 0;
  const monthlySeries = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  const uniqueAuthors = new Set(commitRows.map((c) => c.Author_uuid)).size;

  /* ---- 5. CHAOSS — curated metrics for the top repos by commit volume ---- */
  console.log('4/6 CHAOSS — curated metrics for the 6 most active repos…');
  const CHAOSS_METRICS = [
    { slug: 'contributors', bucket: 'Community' },
    { slug: 'new_contributors', bucket: 'Community' },
    { slug: 'activity_dates', bucket: 'Community' },
    { slug: 'technical_fork', bucket: 'Popularity' },
    { slug: 'project_popularity', bucket: 'Popularity' },
    { slug: 'licenses_declared', bucket: 'Quality' },
  ];
  const topRepos = [...repos].sort((a, b) => b.commits - a.commits).slice(0, 6).filter((r) => r.commits > 0);
  const chaossByRepo = {};
  for (const r of topRepos) {
    chaossByRepo[r.name] = {};
    for (const m of CHAOSS_METRICS) {
      try {
        const data = await chaoss(`/api/v1/metrics/chaoss/repositories/github.com/${ORG_SLUG}/${r.name}/metrics/${m.slug}`);
        chaossByRepo[r.name][m.slug] = { bucket: m.bucket, ...data };
      } catch (e) {
        console.warn(`  ! chaoss ${r.name}/${m.slug}: ${e.message}`);
      }
      await sleep(120);
    }
  }
  console.log(`  fetched CHAOSS metrics for ${Object.keys(chaossByRepo).length} repos`);

  /* ---- 6. Impact funnel + coverage gaps ---- */
  console.log('5/6 Research Impact — publication-link check…');
  const impactCheck = await sparql(`${OP}
    SELECT ?repo ?pub WHERE {
      ?repo op:ownedBy <${ROR_ID}> .
      ?repo <http://schema.org/sourceOrganization> ?pub .
    }
  `);
  console.log(`  ${impactCheck.length} publication links found (funnel step)`);

  console.log('6/6 Coverage gaps…');
  const noLicense = repos.filter((r) => !r.license && !r.isFork);
  const noDiscipline = repos.filter((r) => r.disciplines.length === 0);
  const unclassifiedType = repos.filter((r) => !r.type);

  const disciplineCounts = new Map();
  for (const r of repos) for (const d of r.disciplines) disciplineCounts.set(d, (disciplineCounts.get(d) ?? 0) + 1);

  const summary = {
    fetchedAt,
    scope: { org: ORG_SLUG, orgUrl: ORG_URL, ror: ROR_ID, rorName: ROR_NAME },
    repoCount: repos.length,
    softwareCount: repos.filter((r) => r.type === 'Software').length,
    forkCount: repos.filter((r) => r.isFork).length,
    contributorCount: uniqueAuthors,
    disciplineCount: disciplineCounts.size,
    commitCount: commitRows.length,
    activitySpan: { from: minDate, to: maxDate },
    publicationLinks: impactCheck.length,
    disciplines: [...disciplineCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
  };

  const health = {
    fetchedAt,
    scope: summary.scope,
    monthlySeries,
    activitySpan: summary.activitySpan,
    totalCommits: commitRows.length,
    uniqueAuthors,
    perRepo: repos
      .map((r) => ({ name: r.name, url: r.url, commits: r.commits, contributors: r.contributors, isFork: r.isFork }))
      .sort((a, b) => b.commits - a.commits),
    chaoss: chaossByRepo,
  };

  const impact = {
    fetchedAt,
    scope: summary.scope,
    funnel: {
      repositories: repos.length,
      withLicense: repos.filter((r) => r.license).length,
      withContributorsIdentified: repos.filter((r) => r.contributors > 0).length,
      publicationLinksResolved: impactCheck.length,
    },
    note:
      impactCheck.length === 0
        ? 'No publication links currently resolve from any Agroscope repository to a scholarly record (checked schema:sourceOrganization against the Agroscope ROR across the SPARQL graph, plus a full-text "agroscope" search across Zenodo and Infoscience collections — zero matches). This is an identifier-coverage gap upstream (ORCID / CITATION.cff / DOI linkage), not a dashboard limitation.'
        : null,
  };

  const coverage = {
    fetchedAt,
    scope: summary.scope,
    gaps: {
      noLicense: noLicense.map((r) => r.name),
      noDiscipline: noDiscipline.map((r) => r.name),
      unclassifiedType: unclassifiedType.map((r) => r.name),
    },
    structural: [
      {
        title: 'No contributor–institution affiliation graph',
        detail:
          'Neo4j has no RorOrg node for Agroscope and no AFFILIATED_WITH edges from its contributors — a "who works where" view cannot be built from the graph as it stands.',
      },
      {
        title: 'No publication links to the Agroscope ROR',
        detail: impact.note,
      },
    ],
  };

  await writeFile(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(join(OUT_DIR, 'repos.json'), JSON.stringify({ fetchedAt, scope: summary.scope, repos }, null, 2));
  await writeFile(join(OUT_DIR, 'health.json'), JSON.stringify(health, null, 2));
  await writeFile(join(OUT_DIR, 'impact.json'), JSON.stringify(impact, null, 2));
  await writeFile(join(OUT_DIR, 'coverage.json'), JSON.stringify(coverage, null, 2));

  console.log('\nWrote src/data/{summary,repos,health,impact,coverage}.json');
  console.log(
    `  repos=${summary.repoCount} software=${summary.softwareCount} contributors=${summary.contributorCount} ` +
      `disciplines=${summary.disciplineCount} commits=${summary.commitCount} pubLinks=${summary.publicationLinks}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
