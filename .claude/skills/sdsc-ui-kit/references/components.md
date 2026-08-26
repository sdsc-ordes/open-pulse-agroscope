# SDSC Components

Exact styling for the core component set. **Corner-radius signature:** buttons,
form inputs, checkboxes, and progress bars all use **0.25rem (4px) radius**
(`rounded-sm` / `border-radius: 0.25rem`) — slightly rounded, not square. Tags /
badges are the exception: a fully-rounded `2rem` pill. All transitions 200ms
unless noted.

## Cards & panels (borderless)

**Content containers — cards, panels, sidebars, table wrappers — have NO outline
border.** This is the datascience.ch look: containers are distinguished by a
**background-fill contrast** and whitespace, never a `1px` outline. A card is just
a filled rectangle sitting on the page.

- **Light mode:** white card (`#FFFFFF`) on the lavender-grey page (`#F4F3F8`), or
  a `#F4F3F8` panel on a white page — the fill difference *is* the boundary.
- **Dark mode:** `#2d2d2d` card on the `#1a1a1a` page.
- **Elevation / hover (interactive cards only):** use a **shadow** (`box-shadow` /
  `hover:shadow-md`) or a fill change, **not** a border. Resting state stays flat.

```css
/* Card / panel — borderless, fill-distinguished */
background: var(--card);          /* #FFFFFF light · #2d2d2d dark */
padding: 1.5rem;                  /* 24px — card internal spacing */
/* NO border. Optional elevation for clickable cards: */
/* transition: box-shadow 200ms;  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); } */
```

The `#C9C9C9` / `var(--border)` colour is reserved for **dividers, input borders,
and table row lines** (see design-tokens) — *not* for boxing a card. Do **not**
wrap a panel in `border border-border`. Exceptions that legitimately keep a
border: form inputs, checkboxes, the round dark-mode toggle, the header's thin
bottom border, semantic-tint callout/stat boxes (border matches the accent
tint), and small colour/image sample tiles that would otherwise vanish against
the page.

## Buttons

Labels are **uppercase**, Switzer, **14px**, **font-weight 400**. **0.25rem
(4px) border-radius** (`rounded`). Padding is **`0.75rem 1.5rem` (12px 24px)**
with a **`1px solid` border matching the fill** and a 200ms `background-color`
transition.

> Source: `SDSC_Design_System.pdf` §5.1 (`.button` / `button`). Background
> `--primary-color`, white uppercase text, border-radius `0.25rem`, transition
> `background-color 200ms ease`.

### Primary

> Implementation note: the hex values below are shown for reference; in actual code use the CSS variables (e.g. `var(--primary-color)`, `var(--secondary-color)`) rather than hard-coding hex.
```css
background: #5561a6;
color: #FFFFFF;
border: 1px solid #5561a6;   /* border matches background */
padding: 0.75rem 1.5rem;     /* 12px 24px */
font-family: Switzer, Arial, sans-serif;
font-size: 14px;
font-weight: 400;
text-transform: uppercase;
border-radius: 0.25rem;      /* 4px */
transition: background-color 200ms ease;
/* hover */ background: #26235c; border-color: #26235c;
```

### Secondary (outline)

```css
background: transparent;
color: #000000;              /* BLACK, not blue */
border: 1px solid #5561a6;
padding: 0.75rem 1.5rem;     /* 12px 24px */
font-family: Switzer, Arial, sans-serif;
font-size: 14px; font-weight: 400; text-transform: uppercase;
border-radius: 0.25rem;      /* 4px */
transition: color 200ms;
/* hover */ color: #5561a6;  /* only text changes to blue — background stays transparent */
```

### Text (`.is-text`)

```css
background: transparent;
color: #000000;              /* BLACK, not blue */
border: 2px solid transparent;
padding: 0.75rem 1.5rem;     /* 12px 24px */
font-family: Switzer, Arial, sans-serif;
font-size: 14px; font-weight: 400; text-transform: uppercase;
border-radius: 0.25rem;      /* 4px */
/* hover */ background: #26235c; border-color: #26235c; color: #FFFFFF;
```

**States:** Default base styling · Hover as above (200ms) · Active/Focus keep a
visible focus state · Disabled 50% opacity, `cursor: not-allowed`.

## Tags & badges

Event / status tags use a **pill** shape (`border-radius: 2rem`, fully rounded)
with uppercase `0.75rem` text at `line-height: 1`.

```css
background: #26235c;         /* --secondary-color */
color: #FFFFFF;
padding: 0.3rem 0.6rem;
border-radius: 2rem;         /* pill — fully rounded */
font-size: 0.75rem;
text-transform: uppercase;
line-height: 1;
```

> **Component-library note:** when building on a component library (shadcn/ui,
> Radix, MUI, …), override its defaults to these values rather than accepting the
> stock theme — in particular force the 0.25rem (4px) corner radius and point the
> primary colour at `--primary-color`. (For shadcn/ui specifically: keep
> `rounded` mapped to 0.25rem and map the `default`/`primary` variant to the SDSC
> blue.)

## Form inputs

All form elements use **4px border-radius**, 8px vertical / 16px horizontal
padding, placeholder text `#848484`. Labels: Switzer Medium 14px, above the
input with 8px margin. Focus state: `#5561a6` border, `outline: none`.

### Text input

```css
width: 100%;
padding: 8px 16px;
border: 1px solid #E5E5E5;
border-radius: 4px;
background: #FFFFFF;
color: #000000;
font-family: Switzer; font-size: 16px;
/* focus */    border-color: #5561a6; outline: none;
/* disabled */ background: #F4F3F8; color: #848484; cursor: not-allowed;
```

### Textarea

Same as text input plus `resize: vertical; min-height: 100px;`.

### Select dropdown

Same as text input (4px radius, focus border `#5561a6`).

## Checkboxes

4px border-radius.

```css
width: 20px; height: 20px;
border: 2px solid #E5E5E5;
border-radius: 4px;
background: #FFFFFF;
/* checked */  background: #5561a6; border-color: #5561a6;   /* + checkmark */
/* focus */    box-shadow: 0 0 0 2px rgba(85,97,166,0.2);
/* disabled */ background: #F4F3F8; border-color: #E5E5E5; opacity: 0.5; cursor: not-allowed;
```

## Toggle switches

Binary on/off. Track 48×24px, 12px radius; thumb 16×16px circle.

```css
/* track */        width: 48px; height: 24px; background: #E5E5E5; border-radius: 12px; transition: background 200ms;
/* track active */ background: #5561a6;
/* thumb */        width: 16px; height: 16px; background: #FFFFFF; border-radius: 50%; position: absolute; left: 4px; top: 4px; transition: transform 200ms;
/* thumb active */ transform: translateX(24px);
/* disabled */     opacity: 0.5; cursor: not-allowed;
```

States: Off — grey track, thumb left · On — blue track, thumb right · Disabled —
50% opacity, no interaction.

## Progress indicators

### Progress bar (4px radius)

```css
/* container */ width: 100%; height: 8px; background: #E5E5E5; border-radius: 4px; overflow: hidden;
/* fill */      height: 100%; background: #5561a6; border-radius: 4px; transition: width 300ms ease;
/* complete */  background: #90ca42;   /* green at 100% */
```

Use blue `#5561a6` in progress, green `#90ca42` at 100%. Always show a
percentage label; animate width changes over 300ms.

### Loading spinner

```css
width: 32px; height: 32px;
border: 4px solid #E5E5E5;
border-top-color: #5561a6;
border-radius: 50%;
animation: spin 1s linear infinite;
@keyframes spin { to { transform: rotate(360deg); } }
```

Sizes: small 24px · medium 32px (default) · large 48px.

## Top nav links

Header navigation links are **uppercase, Switzer `0.8rem`, weight 500**, muted
grey at rest, shifting to primary on hover. The mobile menu uses larger `1.2rem`
weight-500 links; menu-section titles are `0.6rem` weight 500 uppercase with
`letter-spacing: 0.5px` in grey. On a dark navbar overlay, link text is
`#CCCCCC` (`--text-color-navbar-overlay`).

```css
.nav-link {
  color: var(--muted-fg);   /* #848484 light · #d4d4d4 dark */
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 200ms;
}
.nav-link:hover       { color: var(--primary); }  /* #5561a6 */
.dark .nav-link:hover { color: #ffffff; }
```

## Links & text links

| Style | Colour | Notes |
|-------|--------|-------|
| Read-more (`.is-read-more`) | `#5561a6` | `0.9rem`, no border, transparent background |
| Banner text link | `#5561a6` | `border-bottom: 2px solid #5561a6`, weight 400 |
| List text link | `#000000` | `1rem`, weight 500, uppercase, `border-bottom: 1px solid #000` |
| Footer link | `#848484` | `0.875rem`, no underline, `0.5rem` vertical padding |
| Social link | `#848484` | `14px`, flex, no underline |

**Link-override gotcha (Tailwind-specific):** if the project styles a global
`a { color: var(--link) }` rule *unlayered*, it beats Tailwind colour *utilities*
(which sit in `@layer utilities` and therefore lose the cascade regardless of
source order). A `text-[#848484]` utility on an `<a>` then silently renders as
the link colour instead. Fix it the same way the buttons do — use an **unlayered
component class** (`.nav-link`, `.btn-primary`) that out-specifies the bare `a`
selector, rather than a utility. The same applies to `:hover`: pin the colour on
the component class or the global `a:hover` wins. (Stacks without Tailwind's
layer system don't hit this — normal specificity applies.)

## Dark mode toggle (nav header)

The header dark mode toggle is a **circular icon button**. It uses `rounded-full`
(not the standard `rounded` / 4px that regular buttons use).

```css
padding: 8px;
border: 1px solid #E5E5E5;  /* dark: #404040 */
border-radius: 9999px;      /* rounded-full */
transition: all 200ms;
/* hover */ border-color: #5561a6; background: #F4F3F8;  /* dark hover: #404040 */
```

Icon inside: sun SVG (light mode) or moon SVG (dark mode), `w-5 h-5`,
`text-[#5561a6]`. Toggling dark mode calls
`document.documentElement.classList.toggle('dark', darkMode)`.

## Colour swatch copy button

Each colour swatch is a clickable button. On hover a semi-transparent dark
overlay covers the swatch, showing a pill button and the hex value.

```
/* swatch container */
border-radius: 4px;         /* rounded */
overflow: hidden;           /* clip overlay to corners */
transform: scale(1.03);     /* on hover */
transition: transform 0.15s;

/* overlay (full inset, shown on hover) */
background: rgba(0, 0, 0, 0.4);

/* pill inside overlay */
background: rgba(255,255,255,0.92);   /* light swatch */
background: rgba(30,28,60,0.88);      /* dark swatch */
color: #26235c;    /* light swatch label */
color: #ffffff;    /* dark swatch label */
padding: 5px 10px;
border-radius: 6px;
font-family: Space Grotesk; font-weight: 600; font-size: 0.78rem;
box-shadow: 0 1px 4px rgba(0,0,0,0.2);

/* checked/confirmed state */
color: #4a6e22;           /* pill text when copied */
/* check icon: lucide Check size 12 / SVG polyline "20 6 9 17 4 12" */
```

Below the pill show the hex value in monospace 10px, `color: rgba(255,255,255,0.85)`.

Luminance check to pick light vs dark pill: `(r*299 + g*587 + b*114)/1000 > 128`.

## Icons

SDSC uses **[Lucide](https://lucide.dev)** as the single icon library across all
products — its stroked, geometric style pairs with Space Grotesk + Switzer.
Lucide ships a package for every common stack, so the choice is stack-independent;
install the binding that matches the project and import icons by name. Never mix
icon libraries, and never mix filled and stroked styles in one product.

```js
// Framework bindings (pick one): same icon names everywhere.
import { Search } from 'lucide-svelte';      // Svelte
import { Search } from 'lucide-react';        // React
import { Search } from 'lucide-vue-next';     // Vue
// Component usage (React/Svelte/Vue): <Search size={20} strokeWidth={2} />
```

```html
<!-- Framework-free: the `lucide` package renders into the DOM -->
<i data-lucide="search"></i>
<script type="module">
  import { createIcons, Search } from 'lucide';
  createIcons({ icons: { Search }, attrs: { width: 20, height: 20, 'stroke-width': 2 } });
</script>
```

**Sizing** — align to the 8px scale: `16px` for inline/dense UI, **`20px` default**,
`24px` for emphasis, `32px+` for feature icons. Don't use arbitrary sizes.

**Colour** — icons inherit `currentColor` by default. Use brand/semantic colours
for their defined roles: Dark Blue `#26235c` / Light Blue `#5561a6` for primary,
Grey `#848484` for secondary, semantic colours for status. Pass `color="#…"` or a
`text-[…]` class. Never use off-brand colours.

**Stroke width** — keep uniform across the UI; **`2px` (default)** recommended,
`1.5px` reads lighter at large sizes.

**Accessibility** — pair icons with text labels wherever possible; never rely on
an icon alone to convey critical meaning. Add `aria-label` to icon-only buttons
and mark purely decorative icons `aria-hidden="true"`.
