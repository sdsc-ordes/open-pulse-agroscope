---
name: sdsc-ui-kit
description: >-
  Use this skill when building or styling web UI for Swiss Data Science Center
  (SDSC / datascience.ch) platforms — applying brand colours, typography
  (Space Grotesk + Switzer), buttons, form inputs, layout patterns, and dark
  mode. Framework-agnostic: the spec is expressed as CSS custom properties and
  plain CSS, and maps onto any web stack (vanilla CSS, Tailwind, React, Svelte,
  Vue, Web Components, shadcn/ui, …). Use when the user asks to build an SDSC
  page, component, or theme, or to make a UI match SDSC brand. Do not use for
  scientific charts or data-visualization colour choices — for Open Pulse
  dashboards use the `openpulse-dark-theme` skill (§2.6); otherwise follow the
  project's plotting guidance.
---

# SDSC UI Design Kit

Build SDSC-branded web interfaces with a consistent design system derived from
[datascience.ch](https://datascience.ch), with fonts **Space Grotesk**
(headings) and **Switzer** (body).

**Framework-agnostic.** The design system is defined in stack-neutral terms —
CSS custom properties for the tokens (`assets/tokens.css`) and plain CSS for
every component spec. It works with any HTML/CSS stack; adapt the canonical CSS
to whatever styling layer the project uses (a Tailwind theme, CSS-in-JS, a
component library, or hand-written CSS). Class names like `rounded` shown in
parentheses are convenience hints for Tailwind, not requirements — see
**Framework notes** below.

> **Ground truth:** the token *values* in this skill (colours, type scale,
> spacing, component metrics) are taken from the **SDSC Design System**
> documentation extracted from the datascience.ch Webflow production site
> (`SDSC_Design_System.pdf`, June 2026). That document is authoritative when a
> value is in dispute. The deployed reference app at
> `https://jdupre81.github.io/UI-kit/` remains a useful visual reference, but
> where it disagrees with the production design tokens, the PDF wins. A few
> values here (the green accent, the neutral surface 50–900 scale, the semantic
> success/warning/error/info colours) extend the PDF and are marked as such.

## When to use this skill

Apply this skill whenever generating or reviewing UI for an SDSC product:
pages, components, themes, or layout. It defines the brand tokens, component
styling rules, and layout patterns the output must follow.

For scientific plots, charts, and data-visualization colour palettes, follow the
project's plotting guidance (for Open Pulse dashboards: see `openpulse-dark-theme` §2.6).

## Core rules (always apply)

1. **Fonts:** Space Grotesk for all headings (H1–H6). Switzer for body text,
   buttons, form labels, and UI elements. Load both.
2. **Brand colours:** Primary actions, links, and active states use Primary
   `#5561a6`; hover and dark headings/backgrounds use Secondary `#26235c`. Green
   `#90ca42` is an SDSC accent / CTA highlight (an extension beyond the PDF's
   core palette — see design-tokens). Never substitute arbitrary colours for
   brand roles.
3. **Corner radius — this is the SDSC signature:**
   - Buttons: **0.25rem (4px) radius** (`border-radius: 0.25rem` / `rounded`). Slightly rounded, not square.
   - Colour swatch boxes: **0.25rem (4px) radius** (`rounded`).
   - Form inputs, checkboxes, progress bars: **0.25rem (4px) radius**.
   - Tags / badges: **pill** (`border-radius: 2rem`, fully rounded).
   - Dark mode toggle (nav header): **circular** (`rounded-full`). The only
     interface control that uses a fully round border.
4. **Spacing:** rem-based t-shirt scale on a 16px base (tiny `0.125rem` →
   xxhuge `12rem`; see design-tokens). Section vertical padding is `3rem`
   (compact) or `8rem` (hero); horizontal page gutter `2.5rem`. Section gaps
   48–64px.
5. **Accessibility:** WCAG AA minimum (4.5:1 text contrast), visible focus
   states, 44×44px minimum tap targets, never colour as the only signal.
6. **Buttons use uppercase labels, Switzer 14px font-weight 400, `0.75rem 1.5rem` (12px 24px) padding, and a `1px solid` border matching the fill**, with a 200ms `background-color` transition (per the production datascience.ch spec). Section colour-group labels use the
   `〇 LABEL` circle prefix pattern in grey `#848484`. The circle applies to
   every colour group heading except PRIMARY COLORS: **SECONDARY COLOR**,
   **NEUTRAL COLORS**, **GRAYSCALE PALETTE**, and **SEMANTIC COLORS**.
7. **Icons:** use **Lucide** as the single icon library — it ships for every
   common stack (`lucide-react`, `lucide-svelte`, `lucide-vue-next`, the
   framework-free `lucide` package / web font, etc.). Default size 20px on the
   8px scale, 2px stroke, inherit `currentColor`. Never mix icon libraries or
   filled+stroked styles.
8. **Cards & panels are borderless.** Content containers (cards, panels,
   sidebars, table wrappers) carry **no outline border** — datascience.ch
   distinguishes them by **background-fill contrast** (white `#FFFFFF` card on the
   `#F4F3F8` page, or vice-versa; `#2d2d2d` on `#1a1a1a` in dark) and whitespace.
   For interactive cards use a **shadow** or fill change on hover, never a border.
   The `#C9C9C9` border colour is only for **dividers, input borders, and table
   row lines** — never for boxing a panel. Borders that *do* stay: form inputs,
   checkboxes, the round dark-mode toggle, the header's thin bottom border,
   semantic-tint callout/stat boxes, and small colour/image sample tiles. See
   components.md → *Cards & panels*.

## Procedure

1. **Install the design tokens.** Copy `assets/tokens.css` into the project's
   global stylesheet (or merge its `:root` / `.dark` variables). Reference tokens
   by name (`var(--primary-color)`, or the equivalent in your framework's theme
   system) — never hard-code hex values in components.
2. **Match the project's stack.** Apply the specs to whatever styling layer the
   project already uses (hand-written CSS, a Tailwind theme, CSS-in-JS, a
   component library). The CSS in the references is the canonical spec; translate
   it into the project's idiom rather than introducing a new one. See **Framework
   notes** for common adaptations.
3. Build using the patterns in the references below. Match existing project
   conventions where they already exist.
4. Verify against the accessibility rules before finishing.

## Framework notes (optional)

The skill is stack-neutral; these are conveniences, not requirements.

- **Plain CSS / Web Components** — use `assets/tokens.css` and the component CSS
  as-is; nothing else is needed.
- **Tailwind CSS** — map the tokens into your theme (e.g. a v4 `@theme` block, or
  `theme.extend` in older configs) so utilities like `bg-primary` / `rounded`
  resolve to SDSC values. Parenthetical class hints in the references (`rounded`,
  `py-2`, …) assume this mapping. For dark mode add a `dark` variant
  (`@custom-variant dark (&:is(.dark *));` in v4) and toggle a `.dark` class.
- **Component libraries (shadcn/ui, Radix, MUI, …)** — override defaults to the
  SDSC tokens; in particular force the 0.25rem (4px) corner radius and point the
  primary colour at `--primary-color`. Do not accept the library's default theme.
- **React / Svelte / Vue / Angular** — framework choice is irrelevant to the
  styling; toggle dark mode by adding/removing `.dark` on the root element
  (`document.documentElement.classList.toggle('dark', on)`).

## References — read the one that matches the task

- **`references/design-tokens.md`** — Full colour palettes (primary, secondary,
  neutral, surface 50–900, semantic), typography scale, line heights, spacing,
  the content-label pattern, logo and partner-logo rules, dot-pattern
  backgrounds, and the complete dark-mode colour mapping. Read when choosing
  colours, type sizes, or setting up the theme.
- **`references/components.md`** — Exact styling for buttons (primary /
  secondary / text), form inputs, textareas, selects, checkboxes, toggle
  switches, progress bars, spinners, and icons (Lucide library, sizing, colour,
  stroke, accessibility), including all states (hover, focus, disabled). Read
  when building or restyling any interactive component.
- **`references/layouts.md`** — Ten page-layout patterns (hero, feature grids,
  key numbers, banner, list, content+sidebar, event/article grids) and the five
  design principles (consistency, clarity, accessibility, responsiveness,
  performance). Read when composing a page or section.

## Assets

- **`assets/tokens.css`** — SDSC-branded CSS custom properties for light and
  dark mode. Copy into the target project as the source of truth for colours,
  radii, and font families.
