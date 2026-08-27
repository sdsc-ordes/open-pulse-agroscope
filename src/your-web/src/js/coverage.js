import coverage from '../data/coverage.json';
import { orgSectionHeading } from './components.js';
import { renderStructuralGaps, renderGapList } from './lib/coverage.js';

const totalGaps = coverage.gaps.noLicense.length + coverage.gaps.noDiscipline.length + coverage.gaps.unclassifiedType.length;
document.getElementById('lede').textContent =
  `${totalGaps} per-repository metadata gaps and ${coverage.structural.length} structural gaps across ` +
  `Agroscope's ${coverage.scope.orgs.length} GitHub orgs — an actionable to-do list per team, not a footnote.`;

renderStructuralGaps('structural-gaps', coverage.structural);

const container = document.getElementById('coverage-by-org');
container.innerHTML = coverage.scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <div class="grid-3 mt-24">
        <div class="card">
          <h4>No license declared</h4>
          <ul class="mt-16 small" id="${org.slug}-gap-license"></ul>
        </div>
        <div class="card">
          <h4>No discipline tagged</h4>
          <ul class="mt-16 small" id="${org.slug}-gap-discipline"></ul>
        </div>
        <div class="card">
          <h4>Unclassified type</h4>
          <ul class="mt-16 small" id="${org.slug}-gap-type"></ul>
        </div>
      </div>
    </section>
  `,
  )
  .join('');

for (const org of coverage.scope.orgs) {
  renderGapList(`${org.slug}-gap-license`, coverage.gaps.noLicense.filter((e) => e.org === org.slug), { showOrg: false });
  renderGapList(`${org.slug}-gap-discipline`, coverage.gaps.noDiscipline.filter((e) => e.org === org.slug), { showOrg: false });
  renderGapList(`${org.slug}-gap-type`, coverage.gaps.unclassifiedType.filter((e) => e.org === org.slug), { showOrg: false });
}
