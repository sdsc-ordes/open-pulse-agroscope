# pulseWebKit

**Build an interactive dashboard on [Open Pulse](https://openpulse.science) data — with an AI coding agent doing most of the work.**

[Open Pulse](https://openpulse.science) is a research-software-observability platform by the Swiss Data Science Center (SDSC): data about research code — repositories, contributors, commits, organisations, publications. This kit teaches your AI coding agent how to query that data and build a dashboard from it. You describe what you want; the agent fetches real data and builds the UI — in whatever web framework you prefer.

---

## Part 1 — Get started

### What you need

- A [GitHub](https://github.com) account
- [Node.js](https://nodejs.org) 20 or newer
- An AI coding agent — [Claude Code](https://claude.com/claude-code) works best; Codex, Cursor, and [Pi](https://pi.dev) work too
- Open Pulse credentials — ask whoever runs your Open Pulse deployment (for the SDSC instance, see [openpulse.science](https://openpulse.science))

### Two ways to install

- **Option A — copy the template** *(recommended)*: start a new dashboard repo from scratch. You get the full kit — skills, agent docs, design system, devcontainer, GitHub Pages publishing path.
- **Option B — install the plugin**: add the same skills to a project you already have, from Claude Code *or* Claude Desktop.

Pick **one** per project (combining them loads every skill twice), then follow that option's steps below.

### Option A — copy the template

**1. Create your repo.** On this repo's GitHub page click **Use this template → Create a new repository** (don't fork — a template copy gives you a clean, independent repo). Clone it and open it in your agent; accept the one-time workspace-trust prompt and everything loads automatically.

**2. Add your credentials.** In the repo folder:

```bash
cp .env.example .env
```

Everything goes through one HTTPS gateway, so there's really just one line to fill in: open `.env` in your own editor and replace the placeholder in `OPENPULSE_AUTH` with the reader token you got — that single pair (paired with the already-filled-in `OPENPULSE_ENDPOINT`) covers Neo4j, SPARQL, OpenSearch, and the CHAOSS metrics API. Add `OPENPULSE_ADMIN_AUTH` too if you'll run crawls or extractions. **Never paste credentials into the chat with your AI agent** — it only needs to know the file exists and will never ask for the values; if a credential does end up in a chat, treat it as exposed and ask for a replacement. (`.env` is git-ignored — never commit it.)

**3. Check the connection.**

```bash
npm run check-connectivity
```

Each data store prints **✔** (reachable), **✖** (wrong credential or store down), or **•** (skipped — placeholder not filled in). Fix any ✖ in `.env` and re-run.

**4. Build your dashboard.** In your agent, type:

```
/new-dashboard
```

The wizard interviews you one decision at a time — what the dashboard is about, who it's for, how it should look — verifies the data for your scope actually exists, writes a one-page plan for your approval, and only then builds the app and verifies every page in a real browser.

**5. See it running.**

```bash
cd src/your-web
npm install
npm run dev
```

Open the printed URL in your browser.

### Option B — install the plugin

**1. Install.** How you install depends on which app you're using — pick your tab:

**Claude Code (terminal).** In your project, run:

```
/plugin marketplace add sdsc-ordes/open-pulse-webkit
/plugin install open-pulse@open-pulse
/reload-plugins
```

The last command loads the freshly installed skills into your current session — needed once after installing; no restart required. Note that `/plugin` is a Claude Code command — typing it into Claude Desktop's chat box returns *"isn't a recognized command here"*, because Desktop installs plugins through its UI instead (see below).

**Claude Desktop (app).** Plugins are added through the **Directory** panel, not the chat box:

![Installing the Open Pulse WebKit plugin in Claude Desktop](.github/assets/claude-desktop-plugin-install.gif)

**2. Build your dashboard.** Type:

```
/open-pulse:new-dashboard
```

The wizard sets up your project first — it creates the folders and the `.env.example` template, then tells you exactly which token goes where (usually just the one `OPENPULSE_AUTH` reader token — everything is reached through the same gateway). Fill `.env` in your own editor; **never paste credentials into the chat**. Once your credentials check out, it interviews you, verifies the data exists for your scope, writes a one-page plan for your approval, then builds and verifies the app in a real browser.

**3. See it running.**

```bash
cd src/your-web
npm install
npm run dev
```

Open the printed URL in your browser.

### After install

Keep asking your agent for changes in plain language — it knows how to query Open Pulse and keep the UI on-brand. You can also skip the wizard and just describe what you want, e.g.

> *"Add a repo health page with CHAOSS metrics — contributors, closure ratio, absence factor, license coverage, and release frequency."*

…or invoke a skill by name — `/query-chaoss` for repo health metrics, `/query-neo4j` for the graph, `/op-search` for semantic search, … (prefix with `open-pulse:` in plugin mode).

### Bring your own framework

The kit doesn't prescribe a UI stack. The app lives in `src/your-web/` and can be plain HTML, React, Vue, Svelte, Astro, web components — whatever you (or your agent) prefer; the wizard asks rather than assumes. What's fixed and reusable is framework-neutral: the Open Pulse **query skills** and the **design system** (a contract of CSS custom properties). Everything else is yours to swap.

---

## Part 2 — Details

### The platform

**Two URLs, different jobs:**

| URL | Role |
|---|---|
| **[openpulse.science](https://openpulse.science)** | Main public page — documentation, ontology namespaces. Dashboards built from this kit link here in the required attribution bar. |
| **[openpulse.epfl.ch](https://openpulse.epfl.ch)** | First live deployment — Neo4j, SPARQL, OpenSearch, CHAOSS metrics API, collections, extractor, crawler. Skills and `.env` point here. |

### What's in the box

| | What it is | Where |
|---|---|---|
| 🧠 **Agent skills** | The guided **`new-dashboard` wizard**, 8 query skills (Neo4j graph, SPARQL metadata, OpenSearch, semantic search, [CHAOSS metrics](https://openpulse.epfl.ch/chaoss), crawler, extractor, collections), and the frontend/design skills | `.claude/skills/`, mirrored to `.agents/skills/` |
| 🔌 **Claude Code plugin** | The same skills packaged as the installable `open-pulse` plugin — usable from any project without copying the template | `.claude-plugin/` |
| 📋 **Agent docs** | `CLAUDE.md` / `AGENTS.md` (conventions), `PROJECT.md` (mission + data sources), `SKILLS.md` (recipes) | repo root + `.claude/` |
| 🎨 **Design system** | Swappable design skills over a fixed `--op-*` token contract — see [The design skills](#the-design-skills) | `frontend-dev` + `openpulse-dark-theme` + `sdsc-ui-kit` |
| 🐳 **Devcontainer** | Ubuntu image + Playwright MCP sidecar (VS Code / Codespaces) | `.devcontainer/` + `tools/image/docker/` |
| 🔑 **Env template** | Documents every endpoint + credential the skills need | `.env.example` |

### Works with your agent of choice

Skills and docs are written once in `.claude/` and mirrored to a vendor-neutral copy (`.agents/` + root `AGENTS.md`):

- **Claude Code** reads `CLAUDE.md` + `.claude/skills/`
- **AGENTS.md-standard tools** (Codex, Cursor, …) read root `AGENTS.md`
- **Pi** reads `AGENTS.md` and auto-discovers `.agents/skills/`

> **Only edit `.claude/`**, then run `node tools/sync-agents.mjs`. CI fails if the copies drift.

### The wizard, stage by stage

1. **Setup & connectivity** — creates missing project structure (plugin mode included: `src/your-web/`, `.env.example`, `.gitignore`), walks you through creating `.env` with exact instructions, then live-checks every store — via `check-connectivity` in a template copy, or per-store probes through the query skills in plugin mode — so a section is never promised on a store that's down or unconfigured.
2. **Interview** — data scope, primary viewer, storytelling-vs-stats posture, design intent.
3. **Custom design (optional)** — turns a short design Q&A into a reusable design skill implementing the token contract.
4. **Themes** — a proven landing-page-plus-four-themes skeleton to take, adapt, or replace.
5. **Data reconnaissance** — live queries against your scope; themes are only promised where data exists.
6. **Plan, then build** — a one-page `DASHBOARD.md` spec you approve, then scaffold + browser verification.

Nothing is scaffolded until you've signed off on the plan.

### The design skills

The look the wizard (and any direct UI request) builds against is delivered **as a skill**, so re-branding is a drop-in — no app-code rewrite. The app references only a fixed set of `--op-*` **token names** (the contract, defined in `frontend-dev`); the active design skill supplies the values:

| Skill | Role |
|---|---|
| **`frontend-dev`** | Engineering, brand-agnostic: token contract, font-loading, canvas/D3 rules, image-snapshot rule, required components, browser verification |
| **`openpulse-dark-theme`** *(active)* | The permanent-dark Open Pulse look: token values, graph-canvas rules, card media & avatars, provenance disclosure |
| **`sdsc-ui-kit`** | Base SDSC brand ([datascience.ch](https://datascience.ch)): colours, typography, components, layouts |

Rules under any design skill: all colours from contract tokens (no hardcoded hex outside canvas/SVG); fonts are tokens loaded from npm (no CDN); every page has the **attribution bar** (`Built using openpulse.science at <build timestamp>`); every data card carries the same **"How is this computed?"** disclosure.

**Bring your own brand:** package it as a skill (`SKILL.md` + `assets/tokens.css` implementing the contract), flip the *Active design skill* line in `CLAUDE.md`. Recipe: `.claude/SKILLS.md` §11.

### CHAOSS health metrics

The hub computes **35 CHAOSS metrics** live per GitHub repository across three buckets — **Community** (contributors, closure ratio, response times, bus factor, …), **Popularity** (academic impact, forks, …), **Quality** (docs discoverability, licenses, releases, test coverage, …). Browse at [openpulse.epfl.ch/chaoss](https://openpulse.epfl.ch/chaoss); query via the `query-chaoss` skill:

```bash
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie                          # all 35
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie closure_ratio --window 30
```

### Repository layout

```
open-pulse-webkit/
├── .claude/            # canonical agent config (EDIT HERE)
│   ├── PROJECT.md      #   mission, URLs, data sources
│   ├── SKILLS.md       #   task recipes
│   └── skills/         #   the 12 skills
├── .claude-plugin/     # plugin + marketplace manifests
├── .agents/            # generated mirror (DO NOT EDIT)
├── CLAUDE.md           # repo conventions (canonical)
├── AGENTS.md           # generated mirror
├── .mcp.json           # active Playwright MCP config (host default)
├── .devcontainer/      # devcontainer entry (compose in tools/image/docker/)
├── .env.example        # endpoints + credentials template
├── tools/
│   ├── check-connectivity.mjs   # live-checks all five stores against .env
│   ├── image/docker/            # Dockerfile, compose, setup-mcp.sh
│   └── sync-agents.mjs          # regenerates .agents/ from .claude/
└── src/
    └── your-web/       # ← your web app, any framework
```

### Devcontainer & Playwright MCP (template copies only)

Open in VS Code / Codespaces with the **Dev Containers** extension — `.devcontainer/devcontainer.json` starts a `web` workspace (Ubuntu 24.04, Node 22, Python 3) plus a `playwright-mcp` sidecar (headless Chromium) for UI verification; `post-create` points `.mcp.json` at the sidecar (`http://localhost:8931/mcp`).

On the **host** (no container), `.mcp.json` defaults to stdio `npx`. One-time setup:

```bash
npx playwright install chromium
bash tools/image/docker/setup-mcp.sh host   # only if a prior devcontainer session switched .mcp.json
```

### Publishing to GitHub Pages

The app is designed to publish as a **static site on GitHub Pages** — no server, free hosting.

1. **Build a static bundle.** Configure your framework's static/export build to output to `dist/`. If not served from the domain root, set the base path to `/<your-repo>/`.
2. **Add a Pages workflow:**
   ```yaml
   # .github/workflows/pages.yml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build:
       runs-on: ubuntu-latest
       defaults: { run: { working-directory: src/your-web } }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: "20" }
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with: { path: src/your-web/dist }
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
3. **Enable Pages:** repo → *Settings → Pages → Source: GitHub Actions*.

> **Live data on a static host:** Pages has no server runtime, so the browser can't safely hold credentials. Either **pre-build snapshots** (query Open Pulse at build time, ship static JSON — the wizard's default) or host a credential-holding **external proxy** the static site fetches from.

### Dev notes

- **Editing agent config:** edit `.claude/` only, then `node tools/sync-agents.mjs`. The `agents-sync` CI job fails on drift.
- **Plugin releases:** bump `version` in `.claude-plugin/plugin.json` on skill-visible changes; sanity-check with `claude plugin validate .`.
- **Never commit `.env`** — only `.env.example` is tracked.

### Status

**Under construction.** Ready today: the agent toolkit (skills + docs), the plugin packaging, the dual-runtime sync, the devcontainer, the connectivity check, and the env/MCP scaffolding. The web app in `src/your-web/` is scaffolded per-user by the wizard — the kit ships no app of its own.

---

## License

See [LICENSE](./LICENSE).
