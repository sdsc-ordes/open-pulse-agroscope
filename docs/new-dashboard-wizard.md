# `/new-dashboard` wizard

The guided skill that interviews the user and scaffolds a dashboard,
built out over `#8`/`#12` (2026-07-14 → 2026-07-16):

- **Connectivity gate, plan sign-off, scaffold checklist, custom design
  skills** (`7c6f23cd8c`) — Stage 0 now probes each store and distinguishes
  *not configured* from *configured but unreachable*, so themes aren't
  promised on stores that can't answer. New Stage 5 writes a ~1-page plan
  (`src/your-web/DASHBOARD.md`: scope, themes, recon, stack, design, open
  framing calls) that requires explicit sign-off before scaffolding moves
  to Stage 6. New Stage 1b generates a real custom design skill (WCAG-AA
  gated) when the user wants a non-SDSC look.
- **Stage 0 bootstraps project structure + `.env`, plugin mode included**
  (`0046915855`) — Stage 0 now creates `src/your-web/`, a root
  `.env.example`, and a `.gitignore` entry *before* checking anything, so
  plugin mode works in a foreign/empty project. The `.env` check became
  prescriptive: exact `cp` command, every credential key named with what
  it unlocks, wizard waits for confirmation before probing.
- **Keep credentials out of the chat** (`f1b85efc7f`) — new ground rule:
  the wizard never asks for, echoes, or logs a credential; inspecting
  `.env` reports key names only. A pasted secret is treated as exposed and
  should be rotated.
- **Use the merged `check-connectivity` script as Stage 0's primary probe**
  (`6988ca19ec`) — prefers `tools/check-connectivity.mjs` in clone/template
  checkouts; keeps the query-skill probes as fallback for plugin mode
  (that script can't see a foreign host project's `.env`).
- **Timeline and named CHAOSS metrics are explicit deliverables**
  (`2e54c9d490`) — scaffolded dashboards were silently dropping the graph
  timeline and rendering CHAOSS metrics as generic activity charts even
  though both specs existed. Now: `graph.json` requires `firstSeen` dates
  per element (no dates = no timeline possible, tracked in `stats`);
  `health.json` gains a `chaoss` block keyed by official metric name;
  skipping the timeline must be recorded in the plan; a reader should
  literally see the word "CHAOSS" on the health page.
