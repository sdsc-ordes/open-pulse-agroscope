import health from '../data/health.json';
import summary from '../data/summary.json';
import { statTile, badge, provenance, fmtDate } from './components.js';

document.getElementById('lede').textContent =
  `${summary.contributorCount} people have committed code to Agroscope's repositories. Most repos are ` +
  `maintained by a single person — collaboration is concentrated in a handful of projects.`;

const multiContributor = health.perRepo.filter((r) => r.contributors > 1).length;
const soloRepos = health.perRepo.filter((r) => r.contributors === 1).length;

const tiles = [
  { number: summary.contributorCount, label: 'Unique contributors', takeaway: 'Org-wide, deduplicated' },
  { number: multiContributor, label: 'Repos with 2+ contributors', takeaway: `Out of ${health.perRepo.length}` },
  { number: soloRepos, label: 'Single-contributor repos', takeaway: 'Most of the catalogue' },
];
document.getElementById('stat-grid').innerHTML = tiles.map(statTile).join('');

const tbody = document.querySelector('#contrib-table tbody');
tbody.innerHTML = health.perRepo
  .map(
    (r) => `
    <tr>
      <td class="mono"><a href="${r.url}" target="_blank" rel="noopener">${r.name}</a></td>
      <td>${r.contributors}</td>
      <td>${r.commits}</td>
      <td>${r.isFork ? badge('fork', 'muted') : ''}</td>
    </tr>
  `,
  )
  .join('');

document.getElementById('community-provenance').innerHTML = provenance({
  source: 'Neo4j — User -[:CONTRIBUTES_TO]-> Repo',
  method: 'Graph crawler (all-time edge count, not windowed)',
  refresh: `Snapshot taken ${fmtDate(summary.fetchedAt)}`,
  caveats: 'Counts distinct GitHub accounts, not deduplicated identities across accounts (no SortingHat merge at this layer, unlike the OpenSearch-backed CHAOSS Contributors metric).',
});
