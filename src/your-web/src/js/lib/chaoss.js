// Shared CHAOSS metric-card renderer: an accordion per repo, metrics grouped
// into their three official buckets. Used by the global Health page and any
// single-org scoped page.
import { provenance, fmtDate } from '../components.js';

const BUCKET_ORDER = ['Popularity', 'Community', 'Quality'];
const BUCKET_TONE = { Popularity: 'blue', Community: 'success', Quality: 'warning' };

function metricCard(m) {
  return `
    <div class="chaoss-metric">
      <div class="name">${m.name}</div>
      <div class="value">${m.value}</div>
      <div class="secondary">${m.label ?? ''}${m.secondary ? ` — ${m.secondary}` : ''}</div>
    </div>
  `;
}

export function renderChaoss(elId, chaossByRepo, fetchedAt) {
  const repoNames = Object.keys(chaossByRepo);
  const el = document.getElementById(elId);
  if (repoNames.length === 0) {
    el.innerHTML = '<div class="not-computable">No CHAOSS metrics computed for this scope yet.</div>';
    return;
  }
  el.innerHTML = repoNames
    .map((name, i) => {
      const metrics = chaossByRepo[name];
      const buckets = BUCKET_ORDER.map((bucket) => {
        const inBucket = Object.values(metrics).filter((m) => m.bucket === bucket);
        if (inBucket.length === 0) return '';
        return `
          <div class="chaoss-bucket">
            <h3>${bucket} ${`<span class="badge badge-${BUCKET_TONE[bucket]}">${bucket}</span>`}</h3>
            <div class="chaoss-metric-grid">${inBucket.map(metricCard).join('')}</div>
          </div>
        `;
      }).join('');
      return `
        <details class="card mt-16" ${i === 0 ? 'open' : ''}>
          <summary style="cursor:pointer;font-family:var(--op-font-heading);font-weight:600;color:var(--op-text);font-size:18px">
            ${name}
          </summary>
          ${buckets}
          ${provenance({
            source: 'Neo4j + SPARQL + OpenSearch, unified',
            method: 'Open Pulse CHAOSS metrics API',
            refresh: `Snapshot taken ${fmtDate(fetchedAt)}`,
            caveats: 'Each metric picks the largest non-zero value across the three stores — see the CHAOSS knowledge base link for the official definition.',
          })}
        </details>
      `;
    })
    .join('');
}
