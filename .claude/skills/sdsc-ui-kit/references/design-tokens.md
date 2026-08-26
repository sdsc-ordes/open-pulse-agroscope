# SDSC Design Tokens

Brand-defined values are taken from the **SDSC Design System** documentation
(`SDSC_Design_System.pdf`, extracted from the datascience.ch Webflow production
site, June 2026) — these are the authoritative tokens. A few groups marked
**(extension)** below are not in that PDF but are kept for app builds. Reference
tokens via CSS variables; never hard-code hex values in components.

## Colours

### Brand (authoritative — PDF §2)

| Name | CSS variable | Hex | Usage |
|------|--------------|-----|-------|
| Primary Color | `--primary-color` | `#5561A6` | CTAs, links, active nav states, brand accents |
| Secondary Color | `--secondary-color` | `#26235C` | Dark backgrounds, hero overlays, headings on light |

Kit aliases: `--light-blue` = Primary, `--dark-blue` = Secondary.
**Secondary scale (extension):** lighter `#4a4889` · light `#383673` · base `#26235c` · dark `#1e1c4a` · darker `#161438`
**Primary scale (extension):** lighter `#8a94c9` · light `#6f7ab8` · base `#5561a6` · dark `#434e85` · darker `#323b64`

### Backgrounds, text & borders (authoritative — PDF §2)

| Name | CSS variable | Hex | Usage |
|------|--------------|-----|-------|
| Background Black | `--background-color-black` | `#101010` | Dark section backgrounds |
| Background Grey | `--background-color-grey` | `#F4F3F8` | Card surfaces, alternate section backgrounds (light lavender-grey) |
| Background White | `--background-color-white` | `#FFFFFF` | Default page background, text on dark |
| Text Black | `--text-color-black` | `#000000` | Primary body text, headings, footers |
| Text Grey | `--text-color-grey` | `#848484` | Secondary text, captions, footers, section labels, icons |
| Text Navbar Overlay | `--text-color-navbar-overlay` | `#CCCCCC` | Navbar text on a dark overlay |
| Border | `--color-border-2` | `#C9C9C9` | Dividers, input borders, table lines |

Kit also keeps **Light Blue Background `#dddeec` (extension)** for section
banners and highlighted content areas.

### Green accent (extension — not in the PDF)

| Name | Hex | Usage |
|------|-----|-------|
| Green | `#90ca42` | Accent / CTA highlight, progress-complete state |

**Green scale:** lighter `#b8e186` · light `#a4d564` · base `#90ca42` · dark `#73a235` · darker `#567928`

> The PDF's production palette has no green — its CTAs are Primary `#5561a6`.
> Green remains an SDSC accent for highlights; use Primary for the default
> interactive role and reserve green for accent emphasis.

### Surface (neutral grayscale 50–900, extension)

| Shade | Hex | Shade | Hex |
|-------|-----|-------|-----|
| 50 | `#fafafa` | 500 | `#737373` |
| 100 | `#f5f5f5` | 600 | `#525252` |
| 200 | `#e5e5e5` | 700 | `#404040` |
| 300 | `#d4d4d4` | 800 | `#262626` |
| 400 | `#a3a3a3` | 900 | `#171717` |

Usage bands: **50–200** light backgrounds, subtle fills, disabled states ·
**300–500** placeholder text, secondary borders · **600–900** dark text,
strong borders, overlay backgrounds. The canonical divider / input border is
`#C9C9C9` above; the surface scale is for inert fills (tracks, disabled bg).

### Semantic (status / feedback, extension)

| Purpose | Base | Usage |
|---------|------|-------|
| Success | `#10b981` | Success states, confirmations, positive actions |
| Warning | `#f59e0b` | Warning messages, caution states |
| Error | `#ef4444` | Error states, destructive actions, alerts |
| Info | `#3b82f6` | Informational messages, help text |

5-shade scales (lighter / light / base / dark / darker):
- **Success:** `#6ee7b7` `#34d399` `#10b981` `#059669` `#047857`
- **Warning:** `#fcd34d` `#fbbf24` `#f59e0b` `#d97706` `#b45309`
- **Error:** `#fca5a5` `#f87171` `#ef4444` `#dc2626` `#b91c1c`
- **Info:** `#93c5fd` `#60a5fa` `#3b82f6` `#2563eb` `#1d4ed8`

## Typography

**Primary font — Space Grotesk** (geometric sans, weight range **500–600**):
all headings H1–H6, section titles, navbar labels. **Secondary font — Switzer**
(clean, readable sans, base weight **400**, line-height 1.5): body, paragraphs,
footer links, UI labels, navigation. Load both for the complete system. Space
Grotesk is on Google Fonts; Switzer is from
[Fontshare](https://www.fontshare.com/fonts/switzer).

### Type scale (PDF §3.2)

| Level | Size | Line height | Weight | Font | Class / tag |
|-------|------|-------------|--------|------|-------------|
| H1 — Display | `4rem` (64px) | 1.0 | 600 | Space Grotesk | `h1` / `.heading-style-h1` |
| H2 — Title | `3rem` (48px) | 1.1 | 500 | Space Grotesk | `h2` / `.heading-style-h2` |
| H3 — Subtitle | `2rem` (32px) | 1.1 | 500 | Space Grotesk | `h3` / `.heading-style-h3` |
| H4 — Section | `1.5rem` (24px) | 1.3 | 500 | Space Grotesk | `h4` / `.heading-style-h4` |
| H5 — Card title | `1.25rem` (20px) | 1.4 | 500 | Space Grotesk | `h5` / `.heading-style-h5` |
| H6 — Label | `1rem` (16px) | 1.5 | 600 | Space Grotesk | `h6` / `.heading-style-h6` |
| Body | `1rem` (16px) | 1.5 | 400 | Switzer | `body` / `p` |
| Small | `0.875rem` (14px) | 1.4 | 400 | Switzer | `.text-size-small` |
| Medium | `1.25rem` (20px) | 1.4 | 400 | Switzer | `.text-size-medium` |
| Large | `1.5rem` (24px) | 1.4 | 400 | Switzer | `.text-size-large` |
| Section Label | `0.8rem` (13px) | — | 500 | Switzer | `.heading-style-section_text` |

**Font-weight utilities (PDF §3.3):** `.text-weight-light` 300 ·
`.text-weight-normal` 400 · `.text-weight-semibold` 600 · `.text-weight-xbold` 800.

**Best practices:** tight letter spacing (−0.02em) for large headings;
antialiased font smoothing; max line length 65–75 characters. Account for ~30%
text expansion for French/German when sizing components (the site is EN/FR/DE).

## Content hierarchy & labels

Three-level pattern: **Label → Title → Body**. The underlying type is the PDF's
section label / heading scale; the `〇` circle prefix is an SDSC kit convention.

1. **Label** (`〇 LABEL TEXT`, kit convention) — grey `#848484`, uppercase,
   Switzer weight 500, `0.8rem` (13px), letter-spacing 0.05em.
2. **Section title** — Space Grotesk weight 500, `2rem` (32px, H3), black `#000000`.
3. **Body content** — Switzer 400, `1rem` (16px), black `#000000`; hyperlinks `#5561a6`.

**Spacing:** label→title 12px · title→body 16px · between sections 48–64px.

**Circle prefix scope in colour sections:** PRIMARY COLORS has **no** circle
prefix. Every other colour group heading uses the circle:
`〇 SECONDARY COLOR`, `〇 NEUTRAL COLORS`, `〇 GRAYSCALE PALETTE`,
`〇 SEMANTIC COLORS`.

## Spacing system (PDF §4)

A **rem-based t-shirt scale** on a 16px base, applied to both padding and margin
utilities:

| Token | rem | px | Typical use |
|-------|-----|----|-------------|
| tiny | 0.125rem | 2px | Micro gaps, icon spacing |
| xsmall | 0.5rem | 8px | Tag internal padding, tight gaps |
| small | 1rem | 16px | Default internal padding |
| custom1 | 1.5rem | 24px | Card internal spacing |
| medium | 2rem | 32px | Component gaps, stacked items |
| custom2 | 2.5rem | 40px | Section sub-padding |
| large | 3rem | 48px | Section container padding |
| custom3 | 3.5rem | 56px | Section alternate padding |
| xlarge | 4rem | 64px | Large section gaps |
| xxlarge | 5rem | 80px | Section vertical rhythm |
| huge | 6rem | 96px | Hero padding |
| xhuge | 8rem | 128px | Section-large padding |
| xxhuge | 12rem | 192px | Maximum page-level margin |

**Section padding.** `.padding-section-small` = `3rem` top/bottom (compact
sections); `.padding-section-large` = `8rem` top/bottom (hero / primary areas).
Horizontal page gutter `.padding-global` = `2.5rem` on desktop, reduced on
smaller breakpoints. Use ample white space; section gaps 48–64px.

## Logo

**Primary files:** colour `SDSC_logo_horizontal_rgb_colors.png`; white
`SDSC_logo_horizontal_rgb_white.png`.

✓ Do: use official files, keep aspect ratio, clear space = logo height, colour
logo on light / white logo on dark, minimum 32px height for digital.
✗ Don't: stretch/distort, recolour, add shadows/gradients/outlines, place on
busy backgrounds, or use outdated versions.

**Partner logos — footer requirement:** always display all four in the footer
alongside the SDSC logo: ETH Zürich (`eth_logo_kurz_pos.png`), EPFL
(`EPFL_Logo_Digital_RGB_PROD.png`), PSI
(`PSI_Logo_01_Standard_Positive_RGB.png`), Biopôle Lausanne
(`Biopo_le_Lausanne_idca14LYxL_1.png`). All at 36px height (Tailwind `h-9`),
48px gap. On dark backgrounds apply `filter: brightness(0) invert(1)`. Hover
opacity 70% → 100%.

## Dot pattern background

Subtle dot pattern for hero sections and key content areas.

**Files and display names:**

| Display name | PNG file | SVG file |
|---|---|---|
| Global Background 2 | `global_background2.png` | `global_background2.svg` |
| Global Background 3 | `global_background3.png` | `global_background3.svg` |
| Global Background 4 | `global_background4.png` | `global_background4.svg` |

Always use Title Case display names ("Global Background 2", not "global_background2").

```css
background-image: url('path/to/global_background2.png');
background-size: cover;
background-position: left center; /* or right center — avoid plain center */
background-repeat: no-repeat;
```

**Pattern thumbnail UI:** when showing pattern thumbnails in a picker/gallery,
overlay a download icon button in the top-right corner (absolutely positioned,
~8px inset). The button is a `0.25rem`-radius square with a semi-transparent
white background (`#ffffff` at ~90%) and a `#C9C9C9` border, hovering to a
`#5561a6` fill; the download icon switches from `#5561a6` to white on hover. The
icon button must stop click propagation so it doesn't trigger the parent
thumbnail click. Also include a "Download png →" text link below each thumbnail.
*(The original kit expresses these as Tailwind utilities — `absolute top-2
right-2`, `bg-white/90 hover:bg-[#5561a6] p-2 border rounded-sm` — but the rule
is the styling above, not the class names.)*

✓ Use for: hero sections, featured content, CTA sections, important cards,
landing headers. ✗ Avoid: small text-heavy sections, busy layouts, whole pages,
layering multiple patterns, or insufficient overlay contrast. Always place a
white / semi-transparent backdrop-blur layer behind text and keep WCAG AA
contrast (4.5:1).

## Dark mode

| Element | Light | Dark |
|---------|-------|------|
| Page background | `#F4F3F8` | `#1a1a1a` |
| Card background | `#FFFFFF` | `#2d2d2d` |
| Border | `#C9C9C9` | `#404040` |
| Text primary | `#000000` | `#FFFFFF` |
| Text secondary | `#848484` | `#d4d4d4` |
| Link normal | `#5561a6` | `#93c5fd` |
| Link hover | `#26235c` | `#FFFFFF` |

```css
.element { background: #FFFFFF; color: #000000; }
.dark .element { background: #2d2d2d; color: #FFFFFF; }
```
