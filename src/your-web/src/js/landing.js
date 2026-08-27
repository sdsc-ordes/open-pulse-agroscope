import * as d3 from 'd3';
import summary from '../data/summary.json';
import { statTile, provenance, fmtNumber, fmtDate, orgSectionHeading } from './components.js';

document.getElementById('lede').textContent =
  `Agroscope publishes open source through ${summary.scope.orgs.length} separate GitHub orgs. Each has its ` +
  `own shape and cadence, so the numbers below are shown per org rather than blended into one total.`;

const container = document.getElementById('landing-by-org');
container.innerHTML = summary.scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <p class="small muted mt-8" id="${org.slug}-lede">Loading…</p>
      <div class="stat-grid mt-24" id="${org.slug}-stat-grid"></div>
      <div id="${org.slug}-stat-provenance"></div>

      <h3 class="mt-48">What ${org.displayName} builds, by discipline</h3>
      <div id="${org.slug}-treemap" class="op-treemap mt-16" style="height:280px"></div>
      <div id="${org.slug}-treemap-provenance"></div>

      <p class="small mt-24">
        <a href="landscape.html#${org.slug}">Landscape →</a> ·
        <a href="community.html#${org.slug}">Community →</a> ·
        <a href="health.html#${org.slug}">Health →</a> ·
        <a href="impact.html#${org.slug}">Impact →</a> ·
        <a href="coverage.html#${org.slug}">What's missing →</a>
      </p>
    </section>
  `,
  )
  .join('');

function renderTreemap(elId, disciplines) {
  const el = document.getElementById(elId);
  if (disciplines.length === 0) {
    el.innerHTML = '<div class="not-computable">No discipline tags resolved for this org yet.</div>';
    return;
  }
  const width = el.clientWidth || 900;
  const height = 280;
  const data = { name: 'root', children: disciplines.map((d) => ({ name: d.label, value: d.count })) };
  const root = d3.hierarchy(data).sum((d) => d.value).sort((a, b) => b.value - a.value);
  d3.treemap().size([width, height]).padding(2)(root);

  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

  const node = svg
    .selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
    .style('cursor', 'pointer')
    .on('click', () => {
      window.location.href = `landscape.html#${elId.replace('-treemap', '')}`;
    });

  node
    .append('rect')
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0))
    .attr('fill', (d, i) => color(i));

  node
    .append('text')
    .attr('x', 8)
    .attr('y', 20)
    .attr('font-size', 13)
    .attr('font-weight', 600)
    .attr('fill', '#fff')
    .text((d) => (d.x1 - d.x0 > 70 ? d.data.name : ''));

  node
    .append('text')
    .attr('x', 8)
    .attr('y', 38)
    .attr('font-size', 12)
    .attr('fill', 'rgba(255,255,255,0.7)')
    .text((d) => (d.x1 - d.x0 > 70 && d.y1 - d.y0 > 40 ? `${d.value} repo${d.value === 1 ? '' : 's'}` : ''));

  node.append('title').text((d) => `${d.data.name}: ${d.value} repositories`);
}

for (const org of summary.scope.orgs) {
  const s = summary.perOrg[org.slug];

  document.getElementById(`${org.slug}-lede`).textContent =
    `${s.repoCount} repositories on GitHub (${s.softwareCount} of them software), built by ${s.contributorCount} ` +
    `contributors across ${s.disciplineCount} research disciplines — ${fmtNumber(s.commitCount)} commits so far.`;

  document.getElementById(`${org.slug}-stat-grid`).innerHTML = [
    statTile({ number: s.repoCount, label: 'Repositories', takeaway: `${s.forkCount} forks, ${s.repoCount - s.forkCount} original` }),
    statTile({ number: s.softwareCount, label: 'Software repos' }),
    statTile({ number: s.contributorCount, label: 'Contributors' }),
    statTile({ number: s.disciplineCount, label: 'Disciplines' }),
    statTile({ number: fmtNumber(s.commitCount), label: 'Commits' }),
    statTile({ number: s.publicationLinks, label: 'Publications linked' }),
  ].join('');

  document.getElementById(`${org.slug}-stat-provenance`).innerHTML = provenance({
    source: 'Neo4j + SPARQL (Oxigraph) + OpenSearch',
    method: 'Build-time snapshot script (scripts/fetch-data.mjs)',
    refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
    caveats: `Scoped to the ${org.slug} GitHub org via Neo4j Org→OWNS→Repo.`,
  });

  renderTreemap(`${org.slug}-treemap`, s.disciplines);
  document.getElementById(`${org.slug}-treemap-provenance`).innerHTML = provenance({
    source: 'SPARQL (Oxigraph) — op:discipline, resolved against Wikidata',
    method: 'Direct query + Wikidata label lookup at build time',
    refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
    caveats: 'A repository can carry multiple disciplines — the treemap counts each tag, so totals exceed the repo count.',
  });
}
