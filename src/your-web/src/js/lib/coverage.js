// Shared coverage-gap renderer: structural gaps + per-repo metadata to-do
// lists. Used by the global "What's missing" page and any single-org scoped
// page. Gap entries are {org, name} — pass showOrg:false on a scoped page
// where every entry shares the same org and the prefix would be noise.

function entryLabel(entry, showOrg) {
  return showOrg ? `${entry.org}/${entry.name}` : entry.name;
}

export function renderStructuralGaps(elId, structural) {
  document.getElementById(elId).innerHTML = structural
    .map(
      (g) => `
      <div class="gap-item">
        <span class="icon" aria-hidden="true">⚠</span>
        <div>
          <div class="title">${g.title}</div>
          <div class="detail">${g.detail}</div>
        </div>
      </div>
    `,
    )
    .join('');
}

export function renderGapList(elId, entries, { showOrg = true } = {}) {
  const el = document.getElementById(elId);
  el.innerHTML = entries.length
    ? entries.map((e) => `<li class="mono mt-8" style="padding:4px 0;border-bottom:1px solid var(--op-border-subtle)">${entryLabel(e, showOrg)}</li>`).join('')
    : '<li class="muted mt-8">None — fully covered.</li>';
}
