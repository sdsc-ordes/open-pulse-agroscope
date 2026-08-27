// Shared software→papers funnel renderer. Used by the global Impact page and
// any single-org scoped page.

export function renderFunnel(elId, funnel, note) {
  const steps = [
    { label: 'Repositories', value: funnel.repositories },
    { label: 'With a declared license', value: funnel.withLicense },
    { label: 'With contributors identified', value: funnel.withContributorsIdentified },
    { label: 'Linked to a publication', value: funnel.publicationLinksResolved },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  document.getElementById(elId).innerHTML = `
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
    ${note ? `<p class="small mt-24" style="max-width:640px;color:var(--op-text-2)">${note}</p>` : ''}
  `;
}
