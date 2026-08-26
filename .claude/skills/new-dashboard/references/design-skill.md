# Generate a design skill from a short interview

The operational recipe for the wizard's optional design step: when the user does **not**
want the default SDSC look, turn a handful of design answers into a real, swappable
**design skill** (`.claude/skills/<brand>/`) that the scaffold builds against — instead of a
loose "design brief" the scaffold has to interpret. The whole architecture depends on the
design being a skill that implements the `--op-*` token contract, so a custom look is only
first-class once it exists in that form.

This is the *agent-facing* version of `.claude/SKILLS.md` §11 (the human how-to). Read §11
for the directory shape and activation, and **`frontend-dev` §2 for the canonical token
list** — that table is the source of truth; the skeleton below is a convenience, reconcile
against §2 if they ever differ.

## When to run this

Only when Stage 1's design question landed on a **non-SDSC** answer:

- *"Yes — I'll describe it"* → interview, derive values, generate the skill.
- *"No — you pick, just not SDSC"* → still generate a skill, but you propose a tasteful,
  accessible neutral palette rather than asking for every value.

If the user kept the SDSC default (`openpulse-dark-theme` over `sdsc-ui-kit`), **skip this
entirely** — the active design skill is already installed and Stage 6 uses it as-is.

## 1. Interview — capture the minimum to derive every token

Keep it short; you will *derive* most values from a few anchors. Ask (batch into one
question call where the runtime allows, each with a sensible default):

- **Brand name / slug** — becomes the skill directory `.claude/skills/<slug>/`.
- **Source of truth** — a link, screenshot, brand PDF, existing site, or "just describe it".
  Record it; future edits need to know what wins a dispute (§11 step 3). If a screenshot or
  URL is offered, pull the actual colours/fonts from it rather than guessing.
- **Mode** — dark or light. (The app has no runtime theme toggle; the skill commits to one.)
- **Primary accent colour** — the one interactive/brand colour (links, buttons, focus).
- **Background + surface family** — the page background and card colour; derive the rest of
  the surface ramp from these two.
- **Fonts** — heading / body / mono. Accept "system default" (map to a system stack, no npm
  package needed) or named families (they must be installable npm packages — `frontend-dev`
  §3; flag if a named font has no npm package).
- **Corner style** — sharp / slightly rounded / rounded. One radius decision, applied
  consistently.

Don't ask for all 24 tokens — that is what derivation is for.

## 2. Derive the full `--op-*` set

Every contract token in `frontend-dev` §2 must get a value — a design skill that omits one
breaks the app. Derive the ramps from the anchors:

- **Surfaces** from bg + surface: `--op-bg` (page), `--op-surface` (cards), `--op-surface-2`
  (nested/subtle), `--op-surface-active` (hover/selected), `--op-border` +
  `--op-border-subtle` (two divider strengths). Step lightness in one direction consistently.
- **Accents** — the six `--op-blue-*` slots are the accent ramp from darkest to palest.
  **Keep the names even for a non-blue brand** (§2 note) — they are historical slot names, not
  a colour claim; renaming them would force app-code edits and defeat the contract.
- **Text tiers** from one text colour: `--op-text` (primary) → `--op-text-2` → `--op-text-muted`
  → `--op-text-faint` by lowering contrast in steps; `--op-text-on-blue` is the label colour
  that sits on the accent (pick for contrast against `--op-blue`, not against the page).
- **Status** — `--op-success` / `--op-error` / `--op-warning` / `--op-info`. Use the brand's
  own if given, else conventional green/red/amber/blue tuned to the mode. Aliasing is fine
  (`--op-info: var(--op-blue)`).
- **Footer** — `--op-footer-bg` / `--op-footer-border`, usually a shade of the surface ramp.
- **Fonts** — `--op-font-heading` / `--op-font-body` / `--op-font-mono` as CSS font stacks
  with fallbacks.

**Contrast is a hard gate, not a nicety:** `--op-text` on `--op-bg` and on `--op-surface`
must clear WCAG AA (≈4.5:1 for body text); `--op-text-on-blue` on `--op-blue` likewise.
Adjust the derived values until they pass — an inaccessible theme is a broken theme.

## 3. Write the skill

Two files minimum (`.claude/SKILLS.md` §11 shows the full-brand layout; a custom theme can
stay minimal):

```
.claude/skills/<slug>/
├── SKILL.md            # trigger frontmatter + the design language (modes, accent use, radius, fonts)
└── assets/tokens.css   # a :root block defining every --op-* token — copy-pasteable into the app
```

- **`assets/tokens.css`** — one `:root { … }` block, every contract token with a value and a
  short role comment. It must be usable verbatim as the app's `:root` (Stage 6 step 2 copies
  it in). Skeleton to fill (reconcile names against `frontend-dev` §2):

  ```css
  :root {
    /* Fonts */
    --op-font-heading: /* … */;
    --op-font-body:    /* … */;
    --op-font-mono:    /* … */;
    /* Surfaces */
    --op-bg: /* page */;            --op-surface: /* cards */;
    --op-surface-2: /* nested */;   --op-surface-active: /* hover/selected */;
    --op-border: /* divider */;     --op-border-subtle: /* faint divider */;
    /* Brand accents (keep the -blue- names for any brand) */
    --op-blue-darker: ;  --op-blue-dark: ;  --op-blue-mid: ;
    --op-blue: /* primary accent */;  --op-blue-light: ;  --op-blue-pale: ;
    /* Text */
    --op-text: ;  --op-text-2: ;  --op-text-muted: ;  --op-text-faint: ;
    --op-text-on-blue: /* label colour on the accent */;
    /* Status */
    --op-success: ;  --op-error: ;  --op-warning: ;  --op-info: ;
    /* Footer */
    --op-footer-bg: ;  --op-footer-border: ;
  }
  ```

- **`SKILL.md`** — frontmatter `description` written as a **trigger, not a summary** (§11
  step 2): "when building UI for <brand>… / choosing a colour, radius, type size…", and when
  not to. Body: name the source of truth + date, state the mode, the accent-use rule (accent
  only on interactive chrome; status colours only on badges/toasts is a good default), the
  radius decision, and the fonts. If it reuses SDSC component anatomy, declare `sdsc-ui-kit`
  as the base and list only the deliberate deviations (mirror how `openpulse-dark-theme` §1.2
  does it) — otherwise spell out the component looks it needs.

## 4. Activate it (so Stage 6 builds against it)

1. **Point the app at it** — Stage 6 step 2 copies `assets/tokens.css` into the app's global
   `:root` (and the utility-framework mirror, if any). Because the app references only
   contract names, no app code changes when the brand does.
2. **Update the active-skill line** in `CLAUDE.md` → *Design system* to name the new skill.
3. **Run `node tools/sync-agents.mjs`** so `.agents/` + `AGENTS.md` regenerate (CI fails on
   drift). This is required for every `.claude/` edit, the new skill included.

## 5. Record it in the plan

The Stage 5 plan's *Stack & publishing* (or a short *Design* line) must state which design
skill is active — the SDSC default or the generated `<slug>` — plus its mode and accent, so
the design decision is as traceable as the data decisions. Verify the look in the browser at
Stage 6 (`frontend-dev` §4) exactly as with any UI: a skill that type-checks is not a skill
that looks right.

## Guardrails

- **Every** contract token gets a value — a missing one is an app-breaking gap, not a
  cosmetic one.
- Keep the `--op-blue-*` slot names regardless of the brand's actual accent colour.
- WCAG AA contrast on text-on-surface and text-on-accent is a gate (step 2).
- No raw hex in app template markup — values live only in `tokens.css` → `:root` (and the
  utility mirror); canvas/D3 is the sole hex exception (`frontend-dev` §5).
- Don't invent new `--op-*` names here — adding a *contract* token is a separate, deliberate
  change to `frontend-dev` §2 (`SKILLS.md` §4), not something a per-brand skill does.
