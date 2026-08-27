import * as d3 from 'd3';
import health from '../data/health.json';
import summary from '../data/summary.json';
import { statTile, provenance, fmtNumber, fmtDate } from './components.js';

const busiest = [...health.monthlySeries].sort((a, b) => b.count - a.count)[0];

document.getElementById('lede').textContent =
  `${fmtNumber(health.totalCommits)} commits from ${health.uniqueAuthors} authors between ` +
  `${fmtDate(health.activitySpan.from)} and ${fmtDate(health.activitySpan.to)} — still active today.`;

document.getElementById('stat-grid').innerHTML = [
  statTile({ number: fmtNumber(health.totalCommits), label: 'Total commits' }),
  statTile({ number: health.uniqueAuthors, label: 'Distinct authors' }),
  statTile({ number: busiest ? busiest.month : '—', label: 'Busiest month', takeaway: busiest ? `${busiest.count} commits` : '' }),
  statTile({ number: fmtDate(health.activitySpan.to), label: 'Last commit' }),
].join('');

/* ---- Ecosystem activity: monthly commit bars ---- */
{
  const el = document.getElementById('activity-chart');
  const width = el.clientWidth || 900;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 24, left: 36 };

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

  const x = d3
    .scaleBand()
    .domain(health.monthlySeries.map((d) => d.month))
    .range([margin.left, width - margin.right])
    .padding(0.15);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(health.monthlySeries, (d) => d.count) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(x.domain().filter((_, i) => i % Math.ceil(x.domain().length / 8) === 0))
        .tickSizeOuter(0),
    )
    .call((g) => g.selectAll('text').attr('fill', 'var(--op-text-faint)').attr('font-size', 10))
    .call((g) => g.selectAll('path,line').attr('stroke', 'var(--op-border)'));

  svg
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4))
    .call((g) => g.selectAll('text').attr('fill', 'var(--op-text-faint)').attr('font-size', 10))
    .call((g) => g.selectAll('path,line').attr('stroke', 'var(--op-border)'));

  svg
    .append('g')
    .selectAll('rect')
    .data(health.monthlySeries)
    .join('rect')
    .attr('x', (d) => x(d.month))
    .attr('y', (d) => y(d.count))
    .attr('width', x.bandwidth())
    .attr('height', (d) => height - margin.bottom - y(d.count))
    .attr('fill', 'var(--op-blue)')
    .append('title')
    .text((d) => `${d.month}: ${d.count} commits`);
}

document.getElementById('activity-provenance').innerHTML = provenance({
  source: 'OpenSearch (GrimoireLab-enriched commit index)',
  method: 'Direct SQL query, bucketed by calendar month at build time',
  refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
  caveats: 'Scoped to the 20 agroscope-ch repos by explicit URL — not the broader GrimoireLab "agroscope" project tag, which also includes ~26 unrelated EOA-team repos.',
});

/* ---- Per-repo bar chart ---- */
{
  const el = document.getElementById('repo-bar-chart');
  const rows = health.perRepo.filter((r) => r.commits > 0).slice(0, 12);
  const width = el.clientWidth || 900;
  const barHeight = 26;
  const height = rows.length * barHeight + 20;
  const margin = { top: 10, right: 60, bottom: 10, left: 160 };

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

  const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.commits) || 1]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(rows.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(0.25);

  svg
    .append('g')
    .selectAll('rect')
    .data(rows)
    .join('rect')
    .attr('x', margin.left)
    .attr('y', (d) => y(d.name))
    .attr('width', (d) => x(d.commits) - margin.left)
    .attr('height', y.bandwidth())
    .attr('fill', 'var(--op-blue)');

  svg
    .append('g')
    .selectAll('text.label')
    .data(rows)
    .join('text')
    .attr('class', 'label mono')
    .attr('x', margin.left - 10)
    .attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', 12)
    .attr('fill', 'var(--op-text-2)')
    .text((d) => d.name);

  svg
    .append('g')
    .selectAll('text.value')
    .data(rows)
    .join('text')
    .attr('class', 'value mono')
    .attr('x', (d) => x(d.commits) + 8)
    .attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('font-size', 12)
    .attr('fill', 'var(--op-text-faint)')
    .text((d) => d.commits);
}

/* ---- CHAOSS metric cards, grouped by bucket, per repo ---- */
const BUCKET_ORDER = ['Popularity', 'Community', 'Quality'];
const BUCKET_TONE = { Popularity: 'blue', Community: 'success', Quality: 'warning' };

function metricCard(m) {
  return `
    <div class="chaoss-metric">
      <div class="name">${m.name}</div>
      <div class="value">${m.value}</div>
      <div class="secondary">${m.label ?? ''}${m.secondary ? ` — ${m.secondary}` : ''}</div>
    </div>
  `;
}

const repoNames = Object.keys(health.chaoss);
document.getElementById('chaoss-repos').innerHTML = repoNames
  .map((name, i) => {
    const metrics = health.chaoss[name];
    const buckets = BUCKET_ORDER.map((bucket) => {
      const inBucket = Object.values(metrics).filter((m) => m.bucket === bucket);
      if (inBucket.length === 0) return '';
      return `
        <div class="chaoss-bucket">
          <h3>${bucket} ${`<span class="badge badge-${BUCKET_TONE[bucket]}">${bucket}</span>`}</h3>
          <div class="chaoss-metric-grid">${inBucket.map(metricCard).join('')}</div>
        </div>
      `;
    }).join('');
    return `
      <details class="card mt-16" ${i === 0 ? 'open' : ''}>
        <summary style="cursor:pointer;font-family:var(--op-font-heading);font-weight:600;color:var(--op-text);font-size:18px">
          ${name}
        </summary>
        ${buckets}
        ${provenance({
          source: 'Neo4j + SPARQL + OpenSearch, unified',
          method: 'Open Pulse CHAOSS metrics API',
          refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
          caveats: 'Each metric picks the largest non-zero value across the three stores — see the CHAOSS knowledge base link for the official definition.',
        })}
      </details>
    `;
  })
  .join('');
