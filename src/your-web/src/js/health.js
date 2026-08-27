import health from '../data/health.json';
import summary from '../data/summary.json';
import { statTile, provenance, fmtNumber, fmtDate, orgSectionHeading } from './components.js';
import { renderMonthlyChart, renderPerRepoChart } from './lib/activity.js';
import { renderChaoss } from './lib/chaoss.js';

document.getElementById('lede').textContent =
  'Activity and CHAOSS metrics for each org on its own terms — combining two teams of very different size ' +
  'and cadence into one chart would flatten the smaller one to a flat line at the bottom.';

const container = document.getElementById('health-by-org');
container.innerHTML = summary.scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <p class="small muted mt-8" id="${org.slug}-health-lede">Loading…</p>
      <div class="stat-grid mt-16" id="${org.slug}-stat-grid"></div>

      <h3 class="mt-48">Commit activity over time</h3>
      <p class="small muted mt-8" style="max-width:640px">
        Monthly commit volume — an activity measure, not a repo-count growth curve.
      </p>
      <div id="${org.slug}-activity-chart" class="mt-16" style="height:220px"></div>
      <div id="${org.slug}-activity-provenance"></div>

      <h3 class="mt-48">Commit volume by repository</h3>
      <div id="${org.slug}-repo-bar-chart" class="mt-16"></div>

      <h3 class="mt-48">CHAOSS metrics</h3>
      <p class="small muted mt-8" style="max-width:640px">
        Shown for the four most active repositories, grouped into the three official CHAOSS buckets.
      </p>
      <div id="${org.slug}-chaoss-repos" class="mt-16"></div>
    </section>
  `,
  )
  .join('');

for (const org of summary.scope.orgs) {
  const s = summary.perOrg[org.slug];
  const perRepo = health.perRepo.filter((r) => r.org === org.slug);
  const monthlySeries = health.perOrgMonthlySeries[org.slug];
  const busiest = [...monthlySeries].sort((a, b) => b.count - a.count)[0];

  document.getElementById(`${org.slug}-health-lede`).textContent =
    `${fmtNumber(s.commitCount)} commits from ${s.contributorCount} authors` +
    (busiest ? `, busiest month ${busiest.month} (${busiest.count} commits).` : '.');

  document.getElementById(`${org.slug}-stat-grid`).innerHTML = [
    statTile({ number: fmtNumber(s.commitCount), label: 'Total commits' }),
    statTile({ number: s.contributorCount, label: 'Distinct authors' }),
    statTile({ number: busiest ? busiest.month : '—', label: 'Busiest month', takeaway: busiest ? `${busiest.count} commits` : '' }),
    statTile({ number: perRepo.length, label: 'Repositories' }),
  ].join('');

  renderMonthlyChart(`${org.slug}-activity-chart`, monthlySeries);
  document.getElementById(`${org.slug}-activity-provenance`).innerHTML = provenance({
    source: 'OpenSearch (GrimoireLab-enriched commit index)',
    method: 'Direct SQL query, bucketed by calendar month at build time',
    refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
    caveats: 'Forks are excluded (a fork can carry its upstream\'s whole commit history and inflate counts).',
  });

  renderPerRepoChart(`${org.slug}-repo-bar-chart`, perRepo, 16);
  renderChaoss(`${org.slug}-chaoss-repos`, health.chaoss[org.slug] ?? {}, summary.fetchedAt);
}
