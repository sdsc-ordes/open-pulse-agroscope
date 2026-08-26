# Digested skills — patterns promoted from the ENAC dashboard

Two commits (`2026-07-15`, `#10`/`#11`) mine the ENAC dashboard
(`open-pulse-enac`) for display patterns proven in a real build and fold
them into the template's canonical skills, so the next dashboard doesn't
have to re-derive them.

## Graph + timeline (`feb8c4c75b`)

- **`frontend-dev` §5** — replaces "filter before passing data" with the
  learned contract: the graph component owns the cutoff
  (`setCutoff`/`dateRange`), fades elements in place, computes opacity as
  `cutoff × focus`, scopes the force simulation to the visible subset, and
  reheats only when membership changes. Adds playback pacing and per-view
  domain-rescale rules.
- **`frontend-dev/examples/pulse-graph.ts`** (new) — framework-free
  reference implementation (SVG + d3-force): degree-scaled radii, label
  budget, neighbourhood focus, click-pinned tooltip.
- **`openpulse-dark-theme` §8/§8.1** — visual spec for the pinned tooltip
  and the full timeline strip (growth step-curve + activity-density rug,
  play/scrub track, date axis with first-appearance annotations).

Follow-up fix (`b880fa3e3a`, same day) folds in two bugs found on the ENAC
build: fading an element must fade *every* painted channel (stroke, not
just fill, or a ghost outline remains), and a missing `firstSeen` means
"date unknown" — such nodes stay hidden while a cutoff is active and only
join at the timeline's max position, not "always visible."

## Media cards, avatars, image pipeline (`569688e0a2`)

- **`openpulse-dark-theme` §6.7** (new) — card media & avatars: 2:1 repo
  social-preview thumbnails, 48px org avatars with placeholder fallback,
  40px initials avatars for people (never fetch faces), link-like
  hover/focus for clickable cards.
- **`frontend-dev` §6** — new rule: every rendered image is a build-time
  WebP data URI (org avatars, repo previews, partner logos), bounded
  payload, retry-then-skip fallback — the browser never fetches
  third-party images at runtime.
- **`frontend-dev/examples/fetch-images.mjs`** (new) — reference script
  (sharp resize → WebP → base64 into `src/data/images.json`).
