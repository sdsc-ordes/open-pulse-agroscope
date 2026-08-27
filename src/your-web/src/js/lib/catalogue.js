// Shared repo-catalogue renderer: filter bar + card grid. Used by the global
// Landscape page (all orgs) and any single-org scoped page (e.g. EOA Team) —
// pass a pre-filtered `repos` array either way.
import { badge, escapeHtml } from '../components.js';

function typeTone(type) {
  if (type === 'Software') return 'blue';
  if (type === 'Data') return 'success';
  return 'muted';
}

function repoCard(r, { showOrgBadge }) {
  const slug = r.url.replace('https://github.com/', '');
  return `
    <div class="card op-repo-card">
      <div class="top">
        <div class="name mono"><a href="${r.url}" target="_blank" rel="noopener">${slug}</a></div>
        <div class="flex gap-8">
          ${showOrgBadge ? badge(r.org, 'blue') : ''}
          ${r.isFork ? badge('fork', 'muted') : ''}
        </div>
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

/**
 * @param {object} opts
 * @param {Array} opts.repos - pre-scoped repo list (already filtered to the org(s) this page covers)
 * @param {object} opts.ids - DOM element ids: { search, type, license, discipline, grid, count, org? }
 * @param {boolean} [opts.showOrgBadge] - show an org badge per card (on for the multi-org Landscape page)
 */
export function renderCatalogue({ repos, ids, showOrgBadge = false }) {
  const typeSel = document.getElementById(ids.type);
  const licenseSel = document.getElementById(ids.license);
  const discSel = document.getElementById(ids.discipline);
  const orgSel = ids.org ? document.getElementById(ids.org) : null;
  const searchEl = document.getElementById(ids.search);
  const gridEl = document.getElementById(ids.grid);
  const countEl = document.getElementById(ids.count);

  const types = [...new Set(repos.map((r) => r.type).filter(Boolean))].sort();
  const licenses = [...new Set(repos.map((r) => r.license).filter(Boolean))].sort();
  const disciplines = [...new Set(repos.flatMap((r) => r.disciplines))].sort();
  const orgs = [...new Set(repos.map((r) => r.org))].sort();

  for (const t of types) typeSel.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
  for (const l of licenses) licenseSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`);
  for (const d of disciplines) discSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`);
  if (orgSel) for (const o of orgs) orgSel.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`);

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const type = typeSel.value;
    const license = licenseSel.value;
    const discipline = discSel.value;
    const org = orgSel ? orgSel.value : '';

    let filtered = repos.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (type && r.type !== type) return false;
      if (license && r.license !== license) return false;
      if (discipline && !r.disciplines.includes(discipline)) return false;
      if (org && r.org !== org) return false;
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

    gridEl.innerHTML = filtered.map((r) => repoCard(r, { showOrgBadge })).join('') || '<p class="muted">No repositories match these filters.</p>';
    countEl.textContent = `${filtered.length} / ${repos.length} repositories`;
  }

  for (const el of [searchEl, typeSel, licenseSel, discSel, orgSel].filter(Boolean)) el.addEventListener('input', render);
  render();
}
