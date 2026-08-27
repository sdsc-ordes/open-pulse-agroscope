import { repos, scope } from '../data/repos.json';
import { badge, provenance, fmtDate, escapeHtml } from './components.js';
import summaryData from '../data/summary.json';

document.getElementById('lede').textContent =
  `The full catalogue of ${repos.length} repositories owned by ${scope.org} on GitHub, filterable by ` +
  `type, license and discipline.`;

const types = [...new Set(repos.map((r) => r.type).filter(Boolean))].sort();
const licenses = [...new Set(repos.map((r) => r.license).filter(Boolean))].sort();
const disciplines = [...new Set(repos.flatMap((r) => r.disciplines))].sort();

const typeSel = document.getElementById('f-type');
for (const t of types) typeSel.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
const licenseSel = document.getElementById('f-license');
for (const l of licenses) licenseSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`);
const discSel = document.getElementById('f-discipline');
for (const d of disciplines) discSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`);

function typeTone(type) {
  if (type === 'Software') return 'blue';
  if (type === 'Data') return 'success';
  return 'muted';
}

function repoCard(r) {
  const slug = r.url.replace('https://github.com/', '');
  return `
    <div class="card op-repo-card">
      <div class="top">
        <div class="name mono"><a href="${r.url}" target="_blank" rel="noopener">${slug}</a></div>
        ${r.isFork ? badge('fork', 'muted') : ''}
      </div>
      <div class="tags">
        ${r.type ? badge(r.type, typeTone(r.type)) : badge('unclassified', 'warning')}
        ${r.license ? badge(r.license, 'muted') : badge('no license', 'warning')}
      </div>
      <div class="meta">
        ${r.language ? `<span>${r.language}</span>` : ''}
        <span>${r.contributors} contributor${r.contributors === 1 ? '' : 's'}</span>
        <span>${r.commits} commits</span>
        ${r.stars ? `<span>★ ${r.stars}</span>` : ''}
      </div>
      ${r.disciplines.length ? `<div class="micro faint">${r.disciplines.join(' · ')}</div>` : '<div class="micro faint">no discipline tagged</div>'}
    </div>
  `;
}

function render() {
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  const type = typeSel.value;
  const license = licenseSel.value;
  const discipline = discSel.value;

  let filtered = repos.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (type && r.type !== type) return false;
    if (license && r.license !== license) return false;
    if (discipline && !r.disciplines.includes(discipline)) return false;
    return true;
  });

  // Software-emphasized default sort: Software first, then by commit volume.
  filtered = filtered.sort((a, b) => {
    if (!type) {
      const aSoft = a.type === 'Software' ? 0 : 1;
      const bSoft = b.type === 'Software' ? 0 : 1;
      if (aSoft !== bSoft) return aSoft - bSoft;
    }
    return b.commits - a.commits;
  });

  document.getElementById('repo-grid').innerHTML = filtered.map(repoCard).join('') || '<p class="muted">No repositories match these filters.</p>';
  document.getElementById('f-count').textContent = `${filtered.length} / ${repos.length} repositories`;
}

for (const el of [document.getElementById('f-search'), typeSel, licenseSel, discSel]) {
  el.addEventListener('input', render);
}
render();

document.getElementById('landscape-provenance').innerHTML = provenance({
  source: 'Neo4j (inventory) + SPARQL / Oxigraph (type, license, language, discipline)',
  method: 'Neo4j Org→OWNS→Repo traversal; SPARQL op:ownedBy against the Agroscope ROR record',
  refresh: `Snapshot taken ${fmtDate(summaryData.fetchedAt)}`,
  caveats: 'Discipline is classifier-inferred from repository content and may be incomplete or wrong; 8 of 20 repos carry no discipline tag at all.',
});
