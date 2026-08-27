// Shared render helpers — plain functions returning HTML strings. Keeps every
// page's provenance disclosure and stat tile identical (frontend-dev §7).

export function provenance({ source, method, refresh, caveats }) {
  return `
    <details class="op-provenance">
      <summary><span aria-hidden="true">ⓘ</span> How is this computed?</summary>
      <dl>
        <div><dt>Source</dt><dd class="mono">${source}</dd></div>
        <div><dt>Method</dt><dd class="mono">${method}</dd></div>
        <div><dt>Refresh</dt><dd>${refresh}</dd></div>
        <div><dt>Caveats</dt><dd>${caveats}</dd></div>
      </dl>
    </details>
  `;
}

export function statTile({ number, label, takeaway, href }) {
  return `
    <div class="stat-tile">
      <div class="number">${number}</div>
      <div class="label">${label}</div>
      ${takeaway ? `<div class="takeaway">${takeaway}</div>` : ''}
      ${href ? `<a class="drill" href="${href}">Drill in →</a>` : ''}
    </div>
  `;
}

export function badge(text, tone = 'muted') {
  return `<span class="badge badge-${tone}">${text}</span>`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function fmtNumber(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
