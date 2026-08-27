import impact from '../data/impact.json';
import { provenance, fmtDate, orgSectionHeading } from './components.js';
import { renderFunnel } from './lib/funnel.js';

document.getElementById('lede').textContent =
  'Whether each team\'s open-source software is recognised in scholarly output — shown per org, since the ' +
  'funnel shape (repo counts, license coverage) differs enough between them that a blended funnel would ' +
  'misrepresent both.';

const container = document.getElementById('impact-by-org');
container.innerHTML = impact.scope.orgs
  .map(
    (org) => `
    <section class="org-section" id="${org.slug}">
      ${orgSectionHeading(org)}
      <div id="${org.slug}-funnel" class="mt-32"></div>
      <div id="${org.slug}-impact-provenance"></div>
    </section>
  `,
  )
  .join('');

for (const org of impact.scope.orgs) {
  const orgImpact = impact.perOrg[org.slug];
  renderFunnel(`${org.slug}-funnel`, orgImpact.funnel, orgImpact.note);

  document.getElementById(`${org.slug}-impact-provenance`).innerHTML = provenance({
    source: 'SPARQL / Oxigraph (schema:sourceOrganization), Zenodo + Infoscience collections',
    method: 'Direct query against this org\'s explicit repo-URL list, plus a full-text "agroscope" search across publication collections',
    refresh: `Snapshot taken ${fmtDate(impact.fetchedAt)}`,
    caveats: 'Absence of a link does not mean absence of publications — it means no ORCID / DOI / CITATION.cff chain currently connects the two in the data Open Pulse has extracted.',
  });
}
