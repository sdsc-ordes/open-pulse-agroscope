# SDSC Page Layouts & Principles

Pre-composed layout patterns and the five design principles. Containers are
max-width 1280px, centred. Mobile-first, with breakpoints at 640 / 768 / 1024 /
1280px (these are the Tailwind `sm`/`md`/`lg`/`xl` defaults, but the patterns are
stack-neutral — apply them with CSS media queries, container queries, or your
framework's grid).

> The markup examples below use a mix of semantic class names (`.hero`,
> `.feature-card`) and Tailwind grid utilities (`grid grid-cols-1 md:grid-cols-3`)
> for brevity. They illustrate the *structure*; translate the utilities into
> whatever the project uses (plain CSS grid/flex, another framework's classes).

## Layout patterns

> **Cards are borderless.** Every card pattern below (`.feature-card`,
> `.event-card`, `.article-card`, stat tiles, sidebars) is a **filled rectangle
> with no outline** — distinguished by background-fill contrast and whitespace,
> the datascience.ch look. Add a `box-shadow` (or fill change) for hover/elevation
> on interactive cards, never a `1px` border. See components.md → *Cards & panels*.

### 1. Hero — image + content

Full-width dot-pattern background, gradient overlay, centred content.

```html
<section class="hero">
  <div class="background-pattern">
    <div class="gradient-overlay"></div>
    <div class="content">
      <h1>Headline</h1>
      <p>Description text</p>
      <button>Call to Action</button>
    </div>
  </div>
</section>
```

Background: dot pattern. Overlay: linear gradient primary-dark → primary-light at
90–95% opacity. White text on dark overlay. Container max-width 1280px.

### 2. Feature grid — 3 column

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
  <div class="feature-card"><h3>Feature Title</h3><p>Feature description</p></div>
  <!-- ×3 -->
</div>
```
Use for three equal-weight features or services.

### 3. Feature grid — 4 column

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">…</div>
```
Use for many small items: icons, stats, service categories.

### 4. Feature grid — 2 column

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-8">…</div>
```
Use for comparisons, paired content, or two main offerings.

### 5. Key numbers

```html
<div class="stats-grid">
  <div class="stat">
    <div class="number">250+</div>
    <div class="label">Projects</div>
  </div>
</div>
```
Numbers: Space Grotesk weight 600, 48–64px, primary colour. Labels: Switzer 400,
16px, grey.

### 6. Full-width banner

```html
<section class="banner" style="background: var(--light-blue-bg)">
  <div class="container"><h2>Banner Headline</h2><p>Supporting text</p><button>Take Action</button></div>
</section>
```
Background uses the Light Blue Background token (`--light-blue-bg`).

### 7. List layout

```html
<div class="list">
  <div class="list-item"><span class="icon">〇</span><div class="content">…</div></div>
</div>
```
Vertical list with dividers; circle-prefix icons for sequential content.

### 8. Content + sidebar

```html
<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
  <main class="lg:col-span-2"><!-- main --></main>
  <aside><!-- sidebar --></aside>
</div>
```
Main content 2/3, sidebar 1/3.

### 9. Event index

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  <article class="event-card">
    <div class="date">May 28, 2026</div>
    <h3 class="title">Event Title</h3>
    <p class="description">…</p>
    <a href="#" class="link">Learn more →</a>
  </article>
</div>
```
Card grid for events, news, or blog posts.

### 10. Article grid

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
  <article class="article-card"><img src="…" alt="…"/><h3>Article Title</h3><p>Preview text…</p><a href="#">Read more →</a></article>
</div>
```
Uniform grid for article previews.

### 11. Top navigation bar (header)

Match the datascience.ch header: a **single clean row**, not a stacked bar.

```html
<header class="sticky top-0 z-50 bg-white border-b border-[#e5e5e5] shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
    <a href="/"><img src="/SDSC_logo_horizontal_rgb_colors.png" alt="Swiss Data Science Center" class="h-8 sm:h-10" /></a>
    <div class="flex items-center gap-6">
      <nav class="hidden md:flex items-center gap-6 text-sm">
        <a class="nav-link" href="/ui-kit">UI Kit</a>
        <a class="nav-link" href="/dataviz">Data Visualization</a>
      </nav>
      <a class="btn-primary" href="/ui-kit">Get Started</a>  <!-- filled CTA, right-aligned -->
    </div>
  </div>
</header>
```

Rules:

- **Logo left**, horizontal full-colour lockup (swap to the white lockup in dark
  mode). Height ~32px mobile / 40px desktop.
- **A few short text links**, Title Case (e.g. "UI Kit", "Data Visualization") —
  not deep section links. In-page navigation belongs in a per-page TOC, not the
  header. Links are muted grey (`--muted-fg`) and shift to primary on hover; use
  a `.nav-link` component class so the global `a` colour rule doesn't override
  them (see design-tokens / components for the link-override gotcha).
- **One filled primary CTA on the right** (`.btn-primary` — uppercase, 0.25rem
  (4px) radius). This right-aligned button is the datascience.ch signature; always
  include it. On mobile, move it into the hamburger dropdown.
- White background, thin 1px bottom border (`#c9c9c9`), subtle shadow. Dark mode:
  `#2d2d2d` surface, `#404040` border. **No secondary metadata strip** in the
  header (version / "last updated" belong in the footer).
- Keep it to a single row height; don't stack rows.

The header is also **sticky** (`sticky top-0 z-50`) and uses the *headroom*
pattern: it slides up out of view while the user scrolls **down**, and slides
back in the moment they scroll **up**. It is always shown near the top of the
page. This reclaims vertical space on long pages without hiding navigation when
the user reaches for it.

Mechanics:

- Translate the whole header with `transform: translateY(-100%)` to hide and
  `translateY(0)` to show. Keep `position: sticky; top: 0` — the transform is
  relative to the stuck position, so `-100%` lifts it fully off-screen.
- Transition `transform` over ~300ms `ease-in-out`. Don't animate `top` or
  layout properties (janky); transform is GPU-composited.
- Reveal whenever `scrollY < 80px` (so the header is always present at the top),
  hide on scroll-down, reveal on scroll-up.
- Use a small dead-zone (~4px) on the delta to avoid jitter, and read scroll in
  a `requestAnimationFrame` callback (throttled) rather than on every event.
- Close any open mobile menu when the header hides.

```svelte
<script lang="ts">
  let navHidden = $state(false);

  $effect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y < 80) navHidden = false;            // always reveal near the top
      else if (y > lastY + 4) navHidden = true; // scrolling down → hide
      else if (y < lastY - 4) navHidden = false;// scrolling up → reveal
      lastY = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<header
  class="sticky top-0 z-50 transition-transform duration-300 ease-in-out"
  style="transform: translateY({navHidden ? '-100%' : '0'})"
>
  <!-- nav content -->
</header>
```

In React, drive the same logic with a `useState`/`useEffect` scroll listener and
toggle a `-translate-y-full` class. Respect `prefers-reduced-motion`: users who
opt out should keep a static sticky header (skip the transform).

### 12. Scroll reveal — fade + rise on enter

The datascience.ch signature page motion: as each block scrolls into view it
**fades in and rises** to its settled position. Use it on section headings,
labels, cards, and content blocks **below the fold** — never on the hero or
anything visible on first paint (it would flash in).

The settled state is the production transform, untouched:

```
opacity: 1;
transform: translate3d(0, 0, 0) scale3d(1, 1, 1)
           rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg);
```

The pre-reveal state is the same transform offset **down ~40px** with
`opacity: 0`. Animate both `opacity` and `transform` together over ~700ms with
an ease-out curve (`cubic-bezier(0.22, 1, 0.36, 1)`). Stagger siblings in a grid
by ~100–120ms each so a row cascades rather than popping at once.

```css
.reveal {
  opacity: 0;
  transform: translate3d(0, var(--reveal-y, 40px), 0) scale3d(1, 1, 1)
             rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg);
  transform-style: preserve-3d;
  transition:
    opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--reveal-delay, 0ms);
  will-change: opacity, transform;
}
.reveal.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale3d(1, 1, 1)
             rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg);
}
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

Drive the class toggle with an `IntersectionObserver` so it reveals once the
element is ~15% visible. In **SvelteKit** this is a one-line action — the action
adds `.reveal` itself, then toggles `.is-visible`, so with no JS the class is
never added and content stays visible:

```ts
// $lib/actions/reveal.ts
export function reveal(node: HTMLElement, { delay = 0, threshold = 0.15, once = true, y = 40 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
  node.style.setProperty('--reveal-y', `${y}px`);
  node.style.setProperty('--reveal-delay', `${delay}ms`);
  node.classList.add('reveal');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { node.classList.add('is-visible'); if (once) io.unobserve(node); }
      else if (!once) node.classList.remove('is-visible');
    }
  }, { threshold });
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
```

```svelte
<p class="section-label" use:reveal>〇 Guidelines</p>
<h2 use:reveal={{ delay: 80 }}>Everything you need to build with SDSC</h2>
{#each cards as card, i}
  <a use:reveal={{ delay: i * 120 }}>…</a>   <!-- staggered row -->
{/each}
```

In **React**, wrap the same `IntersectionObserver` in a `useReveal` hook (or use
a small library) that flips an `isVisible` flag and conditionally applies the
`is-visible` class. Rules either way:

- **Reveal once** by default (`io.unobserve` after the first intersection) so
  blocks don't re-animate every time they re-enter. Re-hiding on scroll-away
  reads as fidgety on long pages.
- **Respect `prefers-reduced-motion`** — skip the transform entirely and show
  content immediately (the media query above and the early return both do this).
- **Animate only `opacity` and `transform`** — both GPU-composited. Never
  animate layout properties (`top`, `height`, `margin`).
- **Never apply it above the fold.** Hero content and anything painted on load
  must not start at `opacity: 0`.

## Design principles

### 1. Consistency
Use the defined palette consistently. Maintain typography hierarchy across pages.
Apply the 8px spacing system uniformly. Follow component patterns for all UI.

### 2. Clarity
Prioritize readability with adequate line spacing. Use ample white space between
sections. Maintain clear hierarchy via size and weight. Keep labels and CTAs
descriptive and actionable.

### 3. Accessibility
WCAG AA minimum (4.5:1 text contrast). Keyboard navigation for all interactive
elements. Semantic, screen-reader-friendly markup. Visible focus states. Never
use colour as the only means of conveying information.

### 4. Responsiveness
Mobile-first. Breakpoints 640 / 768 / 1024 / 1280px. Flexible layouts that adapt
to screen size. Touch targets minimum 44×44px.

### 5. Performance
Optimize images (appropriate formats and sizes). Load fonts efficiently (subset
if needed). Minimize CSS/JS. Use semantic HTML.
