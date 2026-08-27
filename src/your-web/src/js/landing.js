import * as d3 from 'd3';
import summary from '../data/summary.json';
import { statTile, provenance, fmtNumber, fmtDate } from './components.js';

document.getElementById('lede').textContent =
  `${summary.repoCount} repositories on GitHub (${summary.softwareCount} of them software), built by ` +
  `${summary.contributorCount} contributors across ${summary.disciplineCount} research disciplines. ` +
  `The organisation has been shipping code continuously since ${fmtDate(summary.activitySpan.from)} — ` +
  `${summary.commitCount.toLocaleString()} commits and counting.`;

const tiles = [
  { number: summary.repoCount, label: 'Repositories', takeaway: `${summary.forkCount} forks, ${summary.repoCount - summary.forkCount} original`, href: 'landscape.html' },
  { number: summary.softwareCount, label: 'Software repos', takeaway: 'Everything else is Data / Other', href: 'landscape.html' },
  { number: summary.contributorCount, label: 'Contributors', takeaway: 'Org-wide, deduplicated by identity', href: 'community.html' },
  { number: summary.disciplineCount, label: 'Disciplines covered', takeaway: 'Resolved from Wikidata QIDs', href: 'landscape.html' },
  { number: fmtNumber(summary.commitCount), label: 'Commits', takeaway: `${fmtDate(summary.activitySpan.from)} → ${fmtDate(summary.activitySpan.to)}`, href: 'health.html' },
  { number: summary.publicationLinks, label: 'Publications linked', takeaway: 'A coverage gap — see Impact', href: 'impact.html' },
];
document.getElementById('stat-grid').innerHTML = tiles.map(statTile).join('');

document.getElementById('stat-provenance').innerHTML = provenance({
  source: 'Neo4j + SPARQL (Oxigraph) + OpenSearch',
  method: 'Build-time snapshot script (scripts/fetch-data.mjs)',
  refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
  caveats: 'Scoped to the agroscope-ch GitHub org, resolved via its Open Pulse ROR record.',
});

document.getElementById('highlights').innerHTML = `
  <div class="card">
    <h4>Still actively maintained</h4>
    <p class="small muted mt-8">Last commit ${fmtDate(summary.activitySpan.to)} — five years of continuous
    activity, not a one-off release.</p>
  </div>
  <div class="card">
    <h4>Discipline spread is real</h4>
    <p class="small muted mt-8">${summary.disciplines[0]?.label ?? '—'} leads with
    ${summary.disciplines[0]?.count ?? 0} repos, but agricultural science itself is a minority tag — most
    software is classified by its underlying method, not its domain.</p>
  </div>
  <div class="card">
    <h4>Research impact is unlinked</h4>
    <p class="small muted mt-8">Zero repositories currently resolve to a publication record. See
    <a href="impact.html">Impact</a> and <a href="coverage.html">What's missing</a> for the full picture.</p>
  </div>
`;

/* ---- Treemap: repo count by discipline ---- */
const width = document.getElementById('treemap').clientWidth || 900;
const height = 360;
const data = { name: 'root', children: summary.disciplines.map((d) => ({ name: d.label, value: d.count })) };
const root = d3.hierarchy(data).sum((d) => d.value).sort((a, b) => b.value - a.value);
d3.treemap().size([width, height]).padding(2)(root);

const color = d3.scaleOrdinal(d3.schemeTableau10);

const svg = d3
  .select('#treemap')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('width', '100%')
  .attr('height', height);

const node = svg
  .selectAll('g')
  .data(root.leaves())
  .join('g')
  .attr('class', 'op-treemap-node')
  .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
  .style('cursor', 'pointer')
  .on('click', () => {
    window.location.href = 'landscape.html';
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
  .text((d) => (d.x1 - d.x0 > 70 ? d.data.name : ''));

node
  .append('text')
  .attr('class', 'value')
  .attr('x', 8)
  .attr('y', 38)
  .attr('font-size', 12)
  .text((d) => (d.x1 - d.x0 > 70 && d.y1 - d.y0 > 40 ? `${d.value} repo${d.value === 1 ? '' : 's'}` : ''));

node.append('title').text((d) => `${d.data.name}: ${d.value} repositories`);

document.getElementById('treemap-provenance').innerHTML = provenance({
  source: 'SPARQL (Oxigraph) — op:discipline, resolved against Wikidata',
  method: 'Direct query + Wikidata label lookup at build time',
  refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
  caveats: 'A repository can carry multiple disciplines — the treemap counts each tag, so totals exceed the repo count. 8 of 20 repos have no discipline tag at all.',
});
