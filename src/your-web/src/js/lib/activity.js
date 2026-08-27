// Shared D3 activity charts: the org-wide monthly commit bar chart, and the
// per-repo commit-volume comparison. Used by the global Health page and any
// single-org scoped page.
import * as d3 from 'd3';

/* A real calendar time scale, NOT a band scale keyed by the list of months
 * that happen to have commits — a band scale spaces every bucket equally
 * regardless of the real calendar distance between them, which silently
 * hides multi-year gaps (e.g. one old imported commit sitting years before
 * the real activity starts would render as if it were the adjacent month).
 * A time scale draws that gap as genuine empty space instead. */
export function renderMonthlyChart(elId, monthlySeries) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  if (monthlySeries.length === 0) {
    el.innerHTML = '<div class="not-computable">No dated commits in this scope.</div>';
    return;
  }
  const width = el.clientWidth || 900;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 24, left: 36 };

  const parsed = monthlySeries.map((d) => ({ date: new Date(`${d.month}-01T00:00:00Z`), count: d.count }));
  const [minDate, maxDate] = d3.extent(parsed, (d) => d.date);
  const monthMs = 30.44 * 24 * 3600 * 1000;

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

  const x = d3
    .scaleUtc()
    .domain([minDate, new Date(maxDate.getTime() + monthMs)])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(parsed, (d) => d.count) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const spanYears = (maxDate - minDate) / (365.25 * 24 * 3600 * 1000);
  const axis = spanYears > 4 ? d3.axisBottom(x).ticks(d3.utcYear.every(Math.ceil(spanYears / 8) || 1)) : d3.axisBottom(x).ticks(8);

  svg
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(axis.tickSizeOuter(0))
    .call((g) => g.selectAll('text').attr('fill', 'var(--op-text-faint)').attr('font-size', 10))
    .call((g) => g.selectAll('path,line').attr('stroke', 'var(--op-border)'));

  svg
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4))
    .call((g) => g.selectAll('text').attr('fill', 'var(--op-text-faint)').attr('font-size', 10))
    .call((g) => g.selectAll('path,line').attr('stroke', 'var(--op-border)'));

  const barWidth = (d) => Math.max(1, x(new Date(d.date.getTime() + monthMs)) - x(d.date) - 1);

  svg
    .append('g')
    .selectAll('rect')
    .data(parsed)
    .join('rect')
    .attr('x', (d) => x(d.date))
    .attr('y', (d) => y(d.count))
    .attr('width', barWidth)
    .attr('height', (d) => height - margin.bottom - y(d.count))
    .attr('fill', 'var(--op-blue)')
    .append('title')
    .text((d) => `${d.date.toISOString().slice(0, 7)}: ${d.count} commits`);
}

export function renderPerRepoChart(elId, perRepo, limit = 12) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const rows = perRepo.filter((r) => r.commits > 0).slice(0, limit);
  if (rows.length === 0) {
    el.innerHTML = '<div class="not-computable">No commits in this scope.</div>';
    return;
  }
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
