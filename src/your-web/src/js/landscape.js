import { repos as allRepos, scope } from '../data/repos.json';
import { provenance, fmtDate, orgSectionHeading } from './components.js';
import summaryData from '../data/summary.json';
import { renderCatalogue } from './lib/catalogue.js';

document.getElementById('lede').textContent =
  `Agroscope publishes open source through ${scope.orgs.length} separate GitHub orgs. Each is shown here on ` +
  `its own terms — filterable by type, license and discipline — rather than blended into one combined catalogue.`;

const container = document.getElementById('landscape-by-org');
container.innerHTML = scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <div class="filter-bar mt-24">
        <input type="search" id="${org.slug}-f-search" placeholder="Search repositories…" aria-label="Search repositories" />
        <select id="${org.slug}-f-type" aria-label="Filter by type"><option value="">All types</option></select>
        <select id="${org.slug}-f-license" aria-label="Filter by license"><option value="">All licenses</option></select>
        <select id="${org.slug}-f-discipline" aria-label="Filter by discipline"><option value="">All disciplines</option></select>
        <span class="filter-count" id="${org.slug}-f-count"></span>
      </div>
      <div class="card-grid" id="${org.slug}-repo-grid"></div>
      <div id="${org.slug}-provenance"></div>
    </section>
  `,
  )
  .join('');

for (const org of scope.orgs) {
  const repos = allRepos.filter((r) => r.org === org.slug);
  renderCatalogue({
    repos,
    ids: {
      search: `${org.slug}-f-search`,
      type: `${org.slug}-f-type`,
      license: `${org.slug}-f-license`,
      discipline: `${org.slug}-f-discipline`,
      grid: `${org.slug}-repo-grid`,
      count: `${org.slug}-f-count`,
    },
    showOrgBadge: false,
  });

  document.getElementById(`${org.slug}-provenance`).innerHTML = provenance({
    source: 'Neo4j (inventory) + SPARQL / Oxigraph (type, license, language, discipline)',
    method: 'Neo4j Org→OWNS→Repo traversal; SPARQL metadata queried by explicit repo-URL list',
    refresh: `Snapshot taken ${fmtDate(summaryData.fetchedAt)}`,
    caveats: 'Discipline is classifier-inferred from repository content and may be incomplete or wrong.',
  });
}
