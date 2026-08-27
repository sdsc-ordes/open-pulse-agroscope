// Shared entry point: fonts (npm-loaded, no CDN — frontend-dev §3) + the
// required attribution bar + active-nav-link highlighting. Imported by
// every page.
import '@fontsource-variable/space-grotesk';
import '@carrot-kpi/switzer-font';
import '@fontsource/jetbrains-mono';
import '../css/styles.css';

// __BUILD_TIMESTAMP__ is a Vite `define` — a static string substituted when
// the dev server starts / the site is built, never computed in the browser
// (frontend-dev §6).
const buildTimestamp = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';

document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('[data-build-timestamp]');
  if (el) el.textContent = buildTimestamp;

  const here = location.pathname.split('/').pop() || 'index.html';
  for (const link of document.querySelectorAll('.op-nav a')) {
    const target = link.getAttribute('href');
    if (target === here || (here === '' && target === 'index.html')) {
      link.setAttribute('aria-current', 'page');
    }
  }
});
