// Shared People & Community renderer: the "why no collaboration graph" note,
// stat tiles, and per-repo contributor table — text is computed from the
// actual data so it stays accurate for any scope (global or single-org).
import { statTile, badge } from '../components.js';

/**
 * @param {object} opts
 * @param {Array} opts.perRepo - [{org, name, url, commits, contributors, isFork}], pre-scoped
 * @param {number} opts.contributorCount - unique contributors for this scope
 * @param {string} opts.scopeLabel - e.g. "Agroscope" or "the EOA Team"
 * @param {object} opts.ids - { note, statGrid, tableBody }
 * @param {boolean} [opts.showOrgColumn] - include an Org column in the table (on for the combined Community page)
 */
export function renderCommunity({ perRepo, contributorCount, scopeLabel, ids, showOrgColumn = false }) {
  const multiContributor = perRepo.filter((r) => r.contributors > 1).length;
  const soloRepos = perRepo.filter((r) => r.contributors === 1).length;
  const total = perRepo.length;

  const noteEl = document.getElementById(ids.note);
  if (noteEl) {
    const concentrated = soloRepos / Math.max(total, 1) >= 0.5;
    noteEl.innerHTML = concentrated
      ? `The reference dashboard structure leads this theme with a force-directed collaboration graph.
         For ${scopeLabel} that graph would show limited signal: only ${contributorCount} unique contributors
         exist across ${total} repositories, and ${soloRepos} of ${total} have exactly one contributor — there's
         not much cross-repo collaboration to visualise yet. We show a contributor table instead. Neo4j also has
         no institutional-affiliation graph for Agroscope (no <code class="mono">RorOrg</code> node, no
         <code class="mono">AFFILIATED_WITH</code> edges), so a "who works in which group" view isn't buildable
         from the graph as it stands — tracked in <a href="coverage.html">What's missing</a>.`
      : `${scopeLabel} has ${contributorCount} unique contributors across ${total} repositories, with real
         collaboration in ${multiContributor} of them — a contributor table still gives the clearest read here.
         Neo4j has no institutional-affiliation graph for Agroscope (no <code class="mono">RorOrg</code> node, no
         <code class="mono">AFFILIATED_WITH</code> edges), so a "who works in which group" view isn't buildable
         from the graph as it stands — tracked in <a href="coverage.html">What's missing</a>.`;
  }

  const tiles = [
    { number: contributorCount, label: 'Unique contributors', takeaway: 'Deduplicated by identity' },
    { number: multiContributor, label: 'Repos with 2+ contributors', takeaway: `Out of ${total}` },
    { number: soloRepos, label: 'Single-contributor repos', takeaway: soloRepos / Math.max(total, 1) >= 0.5 ? 'Most of the catalogue' : 'A meaningful share' },
  ];
  document.getElementById(ids.statGrid).innerHTML = tiles.map(statTile).join('');

  document.getElementById(ids.tableBody).innerHTML = perRepo
    .map(
      (r) => `
      <tr>
        ${showOrgColumn ? `<td class="mono micro faint">${r.org}</td>` : ''}
        <td class="mono"><a href="${r.url}" target="_blank" rel="noopener">${r.name}</a></td>
        <td>${r.contributors}</td>
        <td>${r.commits}</td>
        <td>${r.isFork ? badge('fork', 'muted') : ''}</td>
      </tr>
    `,
    )
    .join('');

  return { multiContributor, soloRepos, total };
}
