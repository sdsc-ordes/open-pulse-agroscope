# docs

Concise changelog of pulseWebKit template work from the last two weeks
(2026-07-08 → 2026-07-22), grouped by area:

- **[setup-and-install.md](setup-and-install.md)** — Claude Code plugin packaging, the `check-connectivity` script, and the README rewrite around two install paths (template vs. plugin).
- **[new-dashboard-wizard.md](new-dashboard-wizard.md)** — the `/new-dashboard` skill: connectivity gate, plan sign-off, scaffold checklist, custom design-skill generation, credential-safety rules, and making the graph timeline + named CHAOSS metrics explicit deliverables.
- **[digested-skills.md](digested-skills.md)** — graph/timeline and media-card/image-pipeline patterns promoted from the ENAC dashboard into the template's canonical skills.
- **[gateway-unification.md](gateway-unification.md)** — collapsing all Open Pulse store access onto one HTTPS gateway (`OPENPULSE_ENDPOINT`/`OPENPULSE_AUTH`), plus the review-fix follow-ups.

Each file is a plain summary of what shipped and why — see the linked commits for full diffs.
