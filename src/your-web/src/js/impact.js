import impact from '../data/impact.json';
import { provenance, fmtDate } from './components.js';

document.getElementById('lede').textContent =
  'Whether Agroscope\'s open-source software is recognised in scholarly output — right now, the honest ' +
  'answer is "not yet linked". Here is exactly where that chain breaks.';

const steps = [
  { label: 'Repositories', value: impact.funnel.repositories },
  { label: 'With a declared license', value: impact.funnel.withLicense },
  { label: 'With contributors identified', value: impact.funnel.withContributorsIdentified },
  { label: 'Linked to a publication', value: impact.funnel.publicationLinksResolved },
];
const max = Math.max(...steps.map((s) => s.value), 1);

document.getElementById('funnel').innerHTML = `
  <div style="display:flex;flex-direction:column;gap:12px;max-width:640px">
    ${steps
      .map(
        (s) => `
      <div>
        <div class="flex-between micro muted"><span>${s.label}</span><span class="mono">${s.value}</span></div>
        <div style="height:28px;background:var(--op-surface-2);border:1px solid var(--op-border);margin-top:4px">
          <div style="height:100%;width:${Math.max(2, (s.value / max) * 100)}%;background:${s.value === 0 ? 'var(--op-error)' : 'var(--op-blue)'}"></div>
        </div>
      </div>
    `,
      )
      .join('')}
  </div>
  ${impact.note ? `<p class="small mt-24" style="max-width:640px;color:var(--op-text-2)">${impact.note}</p>` : ''}
`;

document.getElementById('impact-provenance').innerHTML = provenance({
  source: 'SPARQL / Oxigraph (schema:sourceOrganization), Zenodo + Infoscience collections',
  method: 'Direct query against the Agroscope ROR record, plus a full-text "agroscope" search across publication collections',
  refresh: `Snapshot taken ${fmtDate(impact.fetchedAt)}`,
  caveats: 'Absence of a link does not mean absence of publications — it means no ORCID / DOI / CITATION.cff chain currently connects the two in the data Open Pulse has extracted.',
});
