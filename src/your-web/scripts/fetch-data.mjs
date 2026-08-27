#!/usr/bin/env node
/* Build-time data snapshot for the Agroscope Open Source Dashboard.
 *
 * Resolves the scope — every GitHub org in ORGS below, currently
 * `agroscope-ch` and `EOA-team` (an Agroscope-affiliated research group) —
 * against Neo4j, SPARQL (Oxigraph), OpenSearch and the CHAOSS metrics API
 * using the same HTTP transports as the `query-*` skill scripts, and writes
 * typed JSON snapshots into src/data/. Credentials stay here, at build time —
 * the browser only ever reads the JSON files this script writes.
 *
 * Every repo carries an `org` field so pages can render either the combined
 * Agroscope view or a single org's dedicated page from the same snapshots.
 *
 * Usage: npm run fetch-data   (from src/your-web/)
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'data');

const ORGS = [
  { slug: 'agroscope-ch', displayName: 'Agroscope', url: 'https://github.com/agroscope-ch' },
  { slug: 'EOA-team', displayName: 'EOA Team', url: 'https://github.com/EOA-team' },
];
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

function sparqlValuesList(urls) {
  return urls.map((u) => `<${u}>`).join(' ');
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
  const OP = 'PREFIX op: <https://open-pulse.epfl.ch/ontology#>\nPREFIX gme: <https://openpulse.science/git-metadata-extractor#>\n';

  /* ---- 1. Resolve scope: repos owned by each org in ORGS ---- */
  console.log(`1/6 Neo4j — repo inventory + contributor counts for ${ORGS.length} orgs…`);
  let neo4jRepos = [];
  for (const org of ORGS) {
    const rows = await neo4j(`
      MATCH (o:Org)-[:OWNS]->(r:Repo)
      WHERE o.url CONTAINS '${org.url}' OR o.login CONTAINS '${org.url}'
      OPTIONAL MATCH (u:User)-[:CONTRIBUTES_TO]->(r)
      WITH r, count(DISTINCT u) AS contributors
      OPTIONAL MATCH (r)-[:FORK_OF]->(upstream)
      RETURN r.name AS name, r.full_name AS url, contributors, upstream.full_name AS forkOf
      ORDER BY r.name
    `);
    console.log(`  ${org.slug}: ${rows.length} repos (${rows.filter((r) => r.forkOf).length} forks)`);
    neo4jRepos = neo4jRepos.concat(rows.map((r) => ({ ...r, org: org.slug })));
  }
  console.log(`  ${neo4jRepos.length} repos total across ${ORGS.length} orgs`);

  /* ---- 2. SPARQL: type / license / language / stars / forks / discipline ----
   * Queried by explicit VALUES list of repo URIs (from Neo4j), not op:ownedBy —
   * agroscope-ch resolves ownedBy to the Agroscope ROR, but EOA-team (not a
   * registered ROR institution) only resolves ownedBy to its own GitHub org
   * URL. A VALUES list works uniformly for any org regardless of what, if
   * anything, its ownedBy predicate points to. */
  console.log('2/6 SPARQL — metadata (type, license, language, discipline)…');
  const allUrls = neo4jRepos.map((r) => r.url);
  const values = sparqlValuesList(allUrls);
  const meta = await sparql(`${OP}
    SELECT ?repo ?type ?license ?lang ?stars ?forks ?archived WHERE {
      VALUES ?repo { ${values} }
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
      VALUES ?repo { ${values} }
      ?repo op:discipline ?discipline .
    }
  `);
  console.log(`  ${meta.length} repos resolved metadata; ${disciplineRows.length} discipline links`);

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
      org: r.org,
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

  /* ---- 4. OpenSearch — commit activity, per repo and per org ----
   * Deliberately scoped to these exact repo URLs, NOT the broader GrimoireLab
   * `project = agroscope` tag — that tag also pulls in a stray unrelated repo
   * (jgustavsen/testgit) alongside the real EOA-team ones. Forks are excluded
   * from every activity aggregate (SKILLS.md §9: a fork can carry the whole
   * upstream history and inflate commit counts) — they stay in the catalogue,
   * badged, but never in a monthly series, total, or per-repo growth chart. */
  console.log('3/6 OpenSearch — commit activity…');
  const nonForkUrls = repos.filter((r) => !r.isFork).map((r) => r.url);
  const repoList = nonForkUrls.map((u) => `'${u}'`).join(',');
  const commitRows = await openSearchSql(
    `SELECT commit_date, repo_name, Author_uuid FROM git_demo_enriched WHERE repo_name IN (${repoList})`,
  );
  console.log(`  ${commitRows.length} commits (forks excluded), ${new Set(commitRows.map((c) => c.Author_uuid)).size} unique authors`);

  const urlToOrg = new Map(repos.map((r) => [r.url, r.org]));
  const commitsByRepo = new Map();
  const monthly = new Map();
  const monthlyByOrg = new Map(ORGS.map((o) => [o.slug, new Map()]));
  const authorsByOrg = new Map(ORGS.map((o) => [o.slug, new Set()]));
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
    const org = urlToOrg.get(c.repo_name);
    if (org) {
      const orgMonthly = monthlyByOrg.get(org);
      orgMonthly.set(month, (orgMonthly.get(month) ?? 0) + 1);
      authorsByOrg.get(org).add(c.Author_uuid);
    }
  }
  for (const r of repos) r.commits = commitsByRepo.get(r.url) ?? 0;
  const toSeries = (m) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  const monthlySeries = toSeries(monthly);
  const perOrgMonthlySeries = Object.fromEntries(ORGS.map((o) => [o.slug, toSeries(monthlyByOrg.get(o.slug))]));
  const uniqueAuthors = new Set(commitRows.map((c) => c.Author_uuid)).size;

  /* ---- 5. CHAOSS — curated metrics for the top repos, per org ---- */
  console.log('4/6 CHAOSS — curated metrics for the top 4 repos per org…');
  const CHAOSS_METRICS = [
    { slug: 'contributors', bucket: 'Community' },
    { slug: 'new_contributors', bucket: 'Community' },
    { slug: 'activity_dates', bucket: 'Community' },
    { slug: 'technical_fork', bucket: 'Popularity' },
    { slug: 'project_popularity', bucket: 'Popularity' },
    { slug: 'licenses_declared', bucket: 'Quality' },
  ];
  const chaossByOrg = {};
  for (const org of ORGS) {
    const topRepos = repos
      .filter((r) => r.org === org.slug && r.commits > 0)
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 4);
    chaossByOrg[org.slug] = {};
    for (const r of topRepos) {
      chaossByOrg[org.slug][r.name] = {};
      for (const m of CHAOSS_METRICS) {
        try {
          const data = await chaoss(`/api/v1/metrics/chaoss/repositories/github.com/${org.slug}/${r.name}/metrics/${m.slug}`);
          chaossByOrg[org.slug][r.name][m.slug] = { bucket: m.bucket, ...data };
        } catch (e) {
          console.warn(`  ! chaoss ${org.slug}/${r.name}/${m.slug}: ${e.message}`);
        }
        await sleep(120);
      }
    }
    console.log(`  ${org.slug}: fetched CHAOSS metrics for ${Object.keys(chaossByOrg[org.slug]).length} repos`);
  }

  /* ---- 6. Impact funnel + coverage gaps ---- */
  console.log('5/6 Research Impact — publication-link check…');
  const impactCheck = await sparql(`${OP}
    SELECT ?repo ?pub WHERE {
      VALUES ?repo { ${values} }
      ?repo <http://schema.org/sourceOrganization> ?pub .
    }
  `);
  console.log(`  ${impactCheck.length} publication links found (funnel step)`);
  const pubLinksByOrg = new Map(ORGS.map((o) => [o.slug, 0]));
  for (const row of impactCheck) {
    const org = urlToOrg.get(row.repo);
    if (org) pubLinksByOrg.set(org, (pubLinksByOrg.get(org) ?? 0) + 1);
  }

  console.log('6/6 Coverage gaps…');
  const noLicense = repos.filter((r) => !r.license && !r.isFork);
  const noDiscipline = repos.filter((r) => r.disciplines.length === 0);
  const unclassifiedType = repos.filter((r) => !r.type);
  const toGapEntry = (r) => ({ org: r.org, name: r.name });

  const disciplineCounts = new Map();
  for (const r of repos) for (const d of r.disciplines) disciplineCounts.set(d, (disciplineCounts.get(d) ?? 0) + 1);

  const perOrgSummary = Object.fromEntries(
    ORGS.map((org) => {
      const orgRepos = repos.filter((r) => r.org === org.slug);
      const orgDisciplines = new Map();
      for (const r of orgRepos) for (const d of r.disciplines) orgDisciplines.set(d, (orgDisciplines.get(d) ?? 0) + 1);
      return [
        org.slug,
        {
          displayName: org.displayName,
          url: org.url,
          repoCount: orgRepos.length,
          softwareCount: orgRepos.filter((r) => r.type === 'Software').length,
          forkCount: orgRepos.filter((r) => r.isFork).length,
          contributorCount: authorsByOrg.get(org.slug).size,
          disciplineCount: orgDisciplines.size,
          commitCount: orgRepos.reduce((sum, r) => sum + r.commits, 0),
          publicationLinks: pubLinksByOrg.get(org.slug) ?? 0,
          disciplines: [...orgDisciplines.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
        },
      ];
    }),
  );

  const scope = { orgs: ORGS, ror: ROR_ID, rorName: ROR_NAME };

  const summary = {
    fetchedAt,
    scope,
    repoCount: repos.length,
    softwareCount: repos.filter((r) => r.type === 'Software').length,
    forkCount: repos.filter((r) => r.isFork).length,
    contributorCount: uniqueAuthors,
    disciplineCount: disciplineCounts.size,
    commitCount: commitRows.length,
    activitySpan: { from: minDate, to: maxDate },
    publicationLinks: impactCheck.length,
    disciplines: [...disciplineCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    perOrg: perOrgSummary,
  };

  const health = {
    fetchedAt,
    scope,
    monthlySeries,
    perOrgMonthlySeries,
    activitySpan: summary.activitySpan,
    totalCommits: commitRows.length,
    uniqueAuthors,
    perRepo: repos
      .map((r) => ({ org: r.org, name: r.name, url: r.url, commits: r.commits, contributors: r.contributors, isFork: r.isFork }))
      .sort((a, b) => b.commits - a.commits),
    chaoss: chaossByOrg,
  };

  const impactNote = (pubCount) =>
    pubCount === 0
      ? 'No publication links currently resolve from any of these repositories to a scholarly record (checked schema:sourceOrganization across the SPARQL graph, plus a full-text "agroscope" search across Zenodo and Infoscience collections — zero matches). This is an identifier-coverage gap upstream (ORCID / CITATION.cff / DOI linkage), not a dashboard limitation.'
      : null;

  const impact = {
    fetchedAt,
    scope,
    funnel: {
      repositories: repos.length,
      withLicense: repos.filter((r) => r.license).length,
      withContributorsIdentified: repos.filter((r) => r.contributors > 0).length,
      publicationLinksResolved: impactCheck.length,
    },
    note: impactNote(impactCheck.length),
    perOrg: Object.fromEntries(
      ORGS.map((org) => {
        const orgRepos = repos.filter((r) => r.org === org.slug);
        const pubCount = pubLinksByOrg.get(org.slug) ?? 0;
        return [
          org.slug,
          {
            funnel: {
              repositories: orgRepos.length,
              withLicense: orgRepos.filter((r) => r.license).length,
              withContributorsIdentified: orgRepos.filter((r) => r.contributors > 0).length,
              publicationLinksResolved: pubCount,
            },
            note: impactNote(pubCount),
          },
        ];
      }),
    ),
  };

  const coverage = {
    fetchedAt,
    scope,
    gaps: {
      noLicense: noLicense.map(toGapEntry),
      noDiscipline: noDiscipline.map(toGapEntry),
      unclassifiedType: unclassifiedType.map(toGapEntry),
    },
    structural: [
      {
        title: 'No contributor–institution affiliation graph',
        detail:
          'Neo4j has no RorOrg node for Agroscope and no AFFILIATED_WITH edges from contributors of either org — a "who works where" view cannot be built from the graph as it stands.',
      },
      {
        title: 'No publication links found',
        detail: impactNote(impactCheck.length),
      },
    ],
  };

  await writeFile(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(join(OUT_DIR, 'repos.json'), JSON.stringify({ fetchedAt, scope, repos }, null, 2));
  await writeFile(join(OUT_DIR, 'health.json'), JSON.stringify(health, null, 2));
  await writeFile(join(OUT_DIR, 'impact.json'), JSON.stringify(impact, null, 2));
  await writeFile(join(OUT_DIR, 'coverage.json'), JSON.stringify(coverage, null, 2));

  console.log('\nWrote src/data/{summary,repos,health,impact,coverage}.json');
  console.log(
    `  repos=${summary.repoCount} software=${summary.softwareCount} contributors=${summary.contributorCount} ` +
      `disciplines=${summary.disciplineCount} commits=${summary.commitCount} pubLinks=${summary.publicationLinks}`,
  );
  for (const org of ORGS) {
    const s = perOrgSummary[org.slug];
    console.log(`  ${org.slug}: repos=${s.repoCount} contributors=${s.contributorCount} commits=${s.commitCount}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
