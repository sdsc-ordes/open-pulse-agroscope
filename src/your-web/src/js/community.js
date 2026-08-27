import health from '../data/health.json';
import summary from '../data/summary.json';
import { provenance, fmtDate, orgSectionHeading } from './components.js';
import { renderCommunity } from './lib/community.js';

document.getElementById('lede').textContent =
  'Who commits code, per org — shown separately because the two teams have very different shapes: a ' +
  'blended count would flatten that difference rather than reveal it.';

const container = document.getElementById('community-by-org');
container.innerHTML = summary.scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <div class="gap-item mt-24">
        <span class="icon" aria-hidden="true">ⓘ</span>
        <div>
          <div class="title">Why no collaboration graph here</div>
          <div class="detail" id="${org.slug}-community-note">Loading…</div>
        </div>
      </div>
      <div class="stat-grid mt-32" id="${org.slug}-community-stat-grid"></div>
      <h3 class="mt-48">Contributors by repository</h3>
      <div class="op-table-wrap mt-16">
        <table class="op-table">
          <thead><tr><th>Repository</th><th>Contributors</th><th>Commits</th><th>Fork</th></tr></thead>
          <tbody id="${org.slug}-contrib-table-body"></tbody>
        </table>
      </div>
      <div id="${org.slug}-community-provenance"></div>
    </section>
  `,
  )
  .join('');

for (const org of summary.scope.orgs) {
  const perRepo = health.perRepo.filter((r) => r.org === org.slug);
  const s = summary.perOrg[org.slug];

  renderCommunity({
    perRepo,
    contributorCount: s.contributorCount,
    scopeLabel: org.displayName,
    ids: {
      note: `${org.slug}-community-note`,
      statGrid: `${org.slug}-community-stat-grid`,
      tableBody: `${org.slug}-contrib-table-body`,
    },
    showOrgColumn: false,
  });

  document.getElementById(`${org.slug}-community-provenance`).innerHTML = provenance({
    source: 'Neo4j — User -[:CONTRIBUTES_TO]-> Repo',
    method: 'Graph crawler (all-time edge count, not windowed)',
    refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
    caveats: 'Counts distinct GitHub accounts, not deduplicated identities across accounts (no SortingHat merge at this layer, unlike the OpenSearch-backed CHAOSS Contributors metric).',
  });
}
