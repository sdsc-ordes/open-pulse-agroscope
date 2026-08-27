import coverage from '../data/coverage.json';

const totalGaps = coverage.gaps.noLicense.length + coverage.gaps.noDiscipline.length + coverage.gaps.unclassifiedType.length;
document.getElementById('lede').textContent =
  `${totalGaps} per-repository metadata gaps and ${coverage.structural.length} structural gaps — an ` +
  `actionable to-do list for whoever stewards Agroscope's Open Pulse metadata, not a footnote.`;

document.getElementById('structural-gaps').innerHTML = coverage.structural
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

function list(id, names) {
  const el = document.getElementById(id);
  el.innerHTML = names.length
    ? names.map((n) => `<li class="mono mt-8" style="padding:4px 0;border-bottom:1px solid var(--op-border-subtle)">${n}</li>`).join('')
    : '<li class="muted mt-8">None — fully covered.</li>';
}

list('gap-license', coverage.gaps.noLicense);
list('gap-discipline', coverage.gaps.noDiscipline);
list('gap-type', coverage.gaps.unclassifiedType);
