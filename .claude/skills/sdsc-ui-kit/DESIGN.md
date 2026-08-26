---
version: alpha
name: SDSC UI Design Kit
description: >-
  Visual identity for Swiss Data Science Center (datascience.ch) web interfaces —
  the Space Grotesk + Switzer type pairing, a purple-dominant brand palette, and
  the 0.25rem-rounded component language. Brand tokens are taken from
  SDSC_Design_System.pdf (Webflow production, June 2026); tokens marked in prose
  as "extension" are kit additions beyond that document.
colors:
  primary: "#5561A6"
  secondary: "#26235C"
  background-black: "#101010"
  background-grey: "#F4F3F8"
  background-white: "#FFFFFF"
  text-black: "#000000"
  text-grey: "#848484"
  text-navbar-overlay: "#CCCCCC"
  border: "#C9C9C9"
  accent-green: "#90CA42"
  light-blue-bg: "#DDDEEC"
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 4rem
    fontWeight: 600
    lineHeight: 1.0
  h2:
    fontFamily: Space Grotesk
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1.1
  h3:
    fontFamily: Space Grotesk
    fontSize: 2rem
    fontWeight: 500
    lineHeight: 1.1
  h4:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: 500
    lineHeight: 1.3
  h5:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: 500
    lineHeight: 1.4
  h6:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: Switzer
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: Switzer
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.4
  section-label:
    fontFamily: Switzer
    fontSize: 0.8rem
    fontWeight: 500
    letterSpacing: 0.05em
  button:
    fontFamily: Switzer
    fontSize: 0.875rem
    fontWeight: 400
rounded:
  sm: 4px
  pill: 2rem
  full: 9999px
spacing:
  tiny: 2px
  xsmall: 8px
  small: 16px
  custom1: 24px
  medium: 32px
  custom2: 40px
  large: 48px
  xlarge: 64px
  xhuge: 128px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background-white}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 0.75rem 1.5rem
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text-black}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 0.75rem 1.5rem
  input:
    backgroundColor: "{colors.background-white}"
    textColor: "{colors.text-black}"
    rounded: "{rounded.sm}"
    padding: 0.5rem 1rem
  tag:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background-white}"
    rounded: "{rounded.pill}"
    padding: 0.3rem 0.6rem
  nav-link:
    textColor: "{colors.text-grey}"
    typography: "{typography.section-label}"
---

## Overview

The Swiss Data Science Center's interface identity is purple-dominant, calm, and
type-led. It pairs **Space Grotesk** (geometric, for headings and display) with
**Switzer** (clean, for body and UI) and a brand built on **Primary `#5561A6`**
and a deep **Secondary `#26235C`**. The signature detail is restraint in corner
radius: a single **0.25rem (4px)** rounding on buttons, inputs, checkboxes, and
progress bars — slightly softened, never square, never large. Apply this skill
only to interface chrome (pages, components, layout, dark mode); scientific
charts are owned by the `sdsc-plotting` skill, whose colours encode data rather
than style chrome.

The normative values are the tokens in the frontmatter; the prose below says how
to apply them. The tokens come from the production design system PDF. Three token
groups are **extensions** not present in that PDF — the green accent
(`accent-green`), the neutral surface grayscale, and the semantic
success/warning/error/info colours — kept because real app builds need disabled
fills, tracks, and status states.

## Colors

- **Primary `#5561A6`** is the default interactive colour: CTAs, links, active
  nav states, focus borders, brand accents.
- **Secondary `#26235C`** is for dark section backgrounds, hero overlays,
  button-hover, and headings on light surfaces.
- **Backgrounds**: white `#FFFFFF` (default page), grey `#F4F3F8` (cards and
  alternate sections — a light lavender-grey), black `#101010` (dark sections).
- **Text**: black `#000000` (body, headings), grey `#848484` (secondary text,
  captions, footers, section labels, icons), `#CCCCCC` on dark navbar overlays.
- **Border `#C9C9C9`** for dividers, input borders, and table lines.
- **Green `#90CA42` (extension)** is an accent for highlights and the
  progress-complete state. The PDF's production CTAs are Primary purple, not
  green — reserve green for accent emphasis, not the default action colour.
- Never substitute arbitrary colours for these brand roles. Maintain WCAG AA
  (4.5:1) text contrast and never use colour as the only signal.

## Typography

Load both fonts (Space Grotesk via Google Fonts; Switzer via Fontshare). Headings
use Space Grotesk at weight **500–600**; body and UI use Switzer at weight
**400**, line-height 1.5. The scale runs H1 `4rem`/600 down to H6 `1rem`/600,
with body at `1rem`. Section labels are uppercase Switzer `0.8rem`/500 with
`0.05em` tracking — by kit convention prefixed with a `〇` circle on every colour
group except PRIMARY COLORS. Tighten letter-spacing (≈ −0.02em) on large
headings, keep line length to 65–75 characters, and budget ~30% text expansion
for French and German (the site is EN/FR/DE).

## Layout

Spacing is a rem-based t-shirt scale on a 16px base (`tiny` 2px → `xxhuge`
192px), applied to both padding and margin. Section vertical padding is `3rem`
(compact) or `8rem` (hero); the horizontal page gutter is `2.5rem` on desktop and
narrows on smaller breakpoints. Keep generous white space — section gaps sit in
the 48–64px band. Designs must work from 320px up: stack to a single column on
mobile, keep tap targets ≥ 44×44px, and give horizontal palettes/tables their own
overflow scroll rather than letting them collapse.

## Shapes

Corner radius is the brand's quiet signature, and it has only three values:

- **`0.25rem` (4px)** — buttons, form inputs, selects, textareas, checkboxes,
  progress bars, colour swatches. The default for almost everything.
- **`2rem` pill** — tags and status badges only.
- **`9999px` circle** — the nav dark-mode toggle only; the single fully-round
  control in the system.

There is no large/`xl` radius. When restyling a component library (shadcn/ui,
Radix, MUI, …), override its default rounding back to `0.25rem`.

## Components

- **Buttons** — uppercase Switzer 14px/400, padding `0.75rem 1.5rem` (12×24px),
  `0.25rem` radius, `1px solid` border matching the fill, `background-color`
  transition 200ms. Primary: Primary fill, white text, hover to Secondary.
  Secondary (outline): transparent fill, black text, Primary border, hover text
  to Primary. Text variant: transparent, black text, hover to Secondary fill.
- **Form inputs** — white background, `#C9C9C9` border, `0.25rem` radius,
  placeholder grey; focus moves the border to Primary with `outline: none`.
  Labels sit above in Switzer 14px with 8px gap.
- **Tags / badges** — Secondary fill, white uppercase `0.75rem` text, `2rem`
  pill, padding `0.3rem 0.6rem`, line-height 1.
- **Nav links** — uppercase Switzer `0.8rem`/500, grey at rest, Primary on hover.
- **Icons** — Lucide only, 20px default on the 8px scale, 2px stroke, inheriting
  `currentColor`; never mix icon libraries or filled+stroked styles.

## Do's and Don'ts

- **Do** reference tokens (`var(--primary-color)`, or the equivalent in the
  project's theme system) — never hard-code hex values in components.
- **Do** keep the 0.25rem radius everywhere except tags (pill) and the dark-mode
  toggle (circle).
- **Do** load both fonts and use Space Grotesk for headings, Switzer for body/UI.
- **Don't** introduce a second icon set, a third button shape, or off-brand
  accent colours.
- **Don't** use green as the default action colour — that role is Primary purple.
- **Don't** let interface colours leak into charts (or chart palettes into UI);
  that boundary belongs to `sdsc-plotting`.
- **Don't** ship colour-only signals, sub-44px tap targets, or text below 4.5:1
  contrast.
