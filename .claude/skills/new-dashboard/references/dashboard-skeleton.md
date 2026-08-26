# Reference skeleton — landing page + four themes

A proven structure for a scoped Open Pulse dashboard: it collapses the typical flat list of
widget sections into **one landing page and four drill-down themes**, each anchored to a
question a reader would actually ask and to clear data provenance. Offer it as the
recommended structure in Stage 2; adapt theme names, emphasis, and vocabulary to the
Stage 1 scope, viewer, and story/stats posture. Every widget must trace back to one of the
platform stores — if you can't name the source, don't build the widget.

## Landing page — "<Scope> open source at a glance" (required)

The default entry point. A reader gets the gist without scrolling through everything.

- 5–6 headline numbers: repositories, contributors, labs/groups, disciplines covered,
  publications linked.
- One signature visual: the collaboration graph, or a discipline treemap.
- Every element links down into the relevant theme below. The landing page is the summary;
  the themes are the drill-downs.

## Theme 1 — The Landscape: "What open source exists in <scope>?"

The descriptive inventory.

- Counts and breakdowns by repository type, discipline, license family, language/topic;
  a browsable catalogue; a live repository feed.
- The catalogue must support exploration **beyond name search**: filter/group by
  discipline, repository type, license family, owning lab/group, and activity level.
- Provenance: the SPARQL metadata graph (`query-sparql`) for type/discipline/license;
  the metadata extractor for languages; the crawler for the live list.

## Theme 2 — People & Community: "Who's behind it?"

The graph layer (`query-neo4j`).

- Surface the connections explicitly via graph queries: person→group, group→repository,
  group↔group, and cross-institution edges.
- The force-directed collaboration graph is the platform's signature visual — invest real
  design effort in its readability, and build it as a **reusable component**, not a
  one-off.
- The graph comes **with its timeline strip**: a scrubber that replays how the network
  grew, driven by `firstSeen` dates baked into the graph snapshot. It's part of the graph
  deliverable, not an optional extra (mechanics: `frontend-dev` §5 + its `pulse-graph.ts`
  example; visuals: design skill *Graph Explorer → Timeline strip*).

## Theme 3 — Community Health & Activity: "How alive and healthy is it?"

The CHAOSS home (`query-chaoss`, time series from `query-opensearch`) — give it
prominence. Growth-over-time and release frequency belong here: they are activity
metrics, not a separate section. Structure around the three CHAOSS questions:

- **Popularity** — downloads, clones, technical forks (who *uses* it).
- **Community** — contributors, new contributors, change requests/reviews, closure ratio,
  contributor absence factor, elephant factor (who *builds and sustains* it).
- **FAIR/quality** — licenses declared, documentation discoverability (can others
  *reuse* it).

Present the metrics **as CHAOSS metrics**: official metric names (*Contributor Absence
Factor*, *Change Request Closure Ratio*, …), grouped under the three buckets, values from
the CHAOSS API, provenance naming it. A reader should see the word CHAOSS on the page —
never dissolve these into unlabeled "activity" charts.

Titling rule: distinguish **ecosystem growth** (more repositories in scope over time)
from **per-repo growth** (one project's contributor/commit trajectory). They are
different data cuts — name them so readers don't conflate them.

## Theme 4 — Research Impact: "What does it produce?"

One theme, not two: institutional publication repositories and scholarly indexes are the
**source** for publication links (via the metadata extractor), not a separate output
section of their own.

- Tell the software→papers→citations story (CHAOSS *Academic Open-Source Project
  Impact*).
- This is the central recognition narrative of the whole dashboard — give it prominence.
- Provenance: `query-sparql` / `op-collections` for publication and identifier links
  (DOI, ORCID, ROR).

## Cross-cutting requirements (both fixed, regardless of theme selection)

1. **Standardized "How is this computed?" disclosure.** Every data card gets the same
   compact component with four fields: *source* (which store or API), *method*
   (crawler / metadata extractor / classifier), *refresh cadence*, and *caveats* (e.g.
   "discipline inferred by a classifier, may be wrong"). One reusable component,
   consistent everywhere — never bespoke per-section explanations.
2. **"What's missing?" coverage panel.** A first-class data-quality view listing
   repositories with no declared license, no publication link, no discipline, or an
   unclassified type. It turns metadata gaps into an actionable to-do list for the team
   stewarding the data.

## Framing decision to surface, not assume

Before finalising the Landscape theme, ask the user whether non-software repository
types ("Educational Resource", "Data", "Other") should be shown or filtered out — a
scope's story may want to lead with **Software** only. This is a framing call; never
decide it silently.

## If restructuring an existing dashboard

Map the old flat sections into this shape (inventory-ish sections → Landscape; graph and
people sections → People & Community; growth/milestones → Health & Activity; publication
sections → Research Impact) and write a short migration note recording where each old
section went.
