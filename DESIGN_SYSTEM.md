# Zach Web UI Style Guide (Lean)

A compact “design contract” for Codex: build clean, calm, high-legibility UIs with restrained aesthetics.

**Vibe:** precision instrument + field notes. **Rule:** if unsure, choose the simpler layout and add whitespace.

---

## 1) Non‑negotiables
- **Legibility first:** strong hierarchy, generous spacing, readable line lengths.
- **Neutral-first:** accents are rare; state colors mean state.
- **Component-driven:** reuse canonical components; avoid one-off styling.
- **Interaction sanity (keep it cheap):** hover/active/disabled states exist, obvious primary action, no broken flows.

---

## 2) Layout primitives

### Widths + grid
- **Page max width:** `1200px` (most sites), `1280px` (data-heavy dashboards).
- **Grid:** 12 columns desktop; single column mobile.
- **Gutters:** `24px` desktop, `16px` mobile.

### Spacing scale (only use these)
`4, 8, 12, 16, 24, 32, 48, 64` (px)

Rules:
- Most gaps are **8/16/24**.
- Card/panel padding is **16–20**.
- Don’t invent spacing values.

### Radius + surfaces
- **Radius:** default `12px`, cards/panels `16px`, pills `999px`.
- **Surfaces:** border-first (1px) with minimal shadow.
- **Shadows:** subtle only; avoid heavy drop shadows.

---

## 3) Typography

### Fonts
- **Sans (UI):** Inter (fallback `ui-sans-serif`).
- **Mono (numbers/code):** JetBrains Mono (fallback `ui-monospace`).

### Type scale (desktop)
- `12` caption
- `14` small
- `16` body (default)
- `20` section heading
- `24` h3
- `32` h2
- `40` h1

Line-height:
- Body `1.5–1.65`
- Headings `1.1–1.25`

Hierarchy rules:
- Exactly **one H1** per page.
- Each section: **title + one sentence** (max) description.
- Numeric/technical values: **mono**, right-aligned in tables.

Copy rules:
- Short, specific, no hype.

---

## 4) Color system

### Philosophy (dark-first, low-glare)
- **Default theme is dark.** Light theme is optional.
- **No pure black/white:** avoid `#000` / `#fff` to reduce eye fatigue.
- **Neutrals dominate;** accent is rare and intentional.
- **One primary accent** per site.
- **State colors** are only for state.

### Default palette (Style 3: Ink + Paper, darker background)
This is the baseline look you picked.
- Background reads as **ink**, not “LED blue.”
- Accent reads as **brass/highlighter**, not neon.

### Tokens (CSS variables)
```css
:root {
  /* Dark default (Ink + Paper — darker) */
  --bg: 5 7 11;          /* #05070B */
  --surface: 11 16 23;   /* #0B1017 */
  --surface-2: 16 24 36; /* #101824 */
  --border: 34 48 66;    /* #223042 */

  --text: 233 236 239;       /* #E9ECEF (off-white) */
  --text-muted: 180 189 200; /* #B4BDC8 */

  /* Accent (brass) */
  --brand: 212 163 115;        /* #D4A373 */
  --brand-strong: 197 141 91;  /* #C58D5B */
  --brand-weak: 26 20 16;      /* #1A1410 (dark warm tint) */

  /* States */
  --success: 34 197 94;
  --warn: 245 158 11;
  --danger: 239 68 68;
}

[data-theme="light"] {
  /* Optional light theme (keep the same accent family) */
  --bg: 255 255 255;
  --surface: 248 250 252;
  --surface-2: 241 245 249;
  --border: 226 232 240;
  --text: 15 23 42;
  --text-muted: 71 85 105;
}
```

Usage rules:
- Backgrounds: `--bg` or `--surface` only.
- Borders: always `--border`.
- Links: brand color + underline on hover.
- Highlights: prefer **tinted surfaces** (`--brand-weak`) before solid fills.

### Theme builder (cohesive across sites)
We want different sites to feel related without sharing the exact same accent.

**Rule:** keep **the neutrals identical** across all sites; only the **accent hue** changes.

**Inputs (per site):**
- `accentHue` (0–360)
- `accentChroma` (constant across sites)
- `accentLightness` (constant across sites)

**Outputs:**
- `--brand` (primary accent)
- `--brand-weak` (tinted background)
- `--brand-strong` (pressed/hover)
- optional `--brand-2` (chart/secondary)

Preferred (modern CSS): **OKLCH** (more visually consistent than HSL).

```css
:root {
  /* Choose per site */
  --accent-h: 80;      /* brass/amber default for our ecosystem */
  --accent-c: 0.12;    /* keep constant across sites */
  --accent-l: 0.72;    /* keep constant across sites */

  /* Derived accents */
  --brand-oklch: oklch(var(--accent-l) var(--accent-c) var(--accent-h));
  --brand-strong-oklch: oklch(calc(var(--accent-l) - 0.10) var(--accent-c) var(--accent-h));

  /* Dark-first: weak accent is a DARK tinted surface (low glare) */
  --brand-weak-oklch: oklch(0.22 calc(var(--accent-c) * 0.35) var(--accent-h));

  /* Optional sibling for charts */
  --brand-2-oklch: oklch(var(--accent-l) var(--accent-c) calc(var(--accent-h) + 40));
}

[data-theme="light"] {
  /* Light optional: weak accent becomes a LIGHT tinted surface */
  --brand-weak-oklch: oklch(0.95 calc(var(--accent-c) * 0.35) var(--accent-h));
}
```

**Codex decision rule:** pick `accentHue` from a small set (3–6 hues max) so the ecosystem stays cohesive.

Suggested ecosystem hue set (examples):
- Brass `80` (default)
- Slate Blue `215`
- Violet `265`
- Sage `150`
- Rose `10`

---

## 5) Canonical components

### Buttons
- Heights: `40px` default, `44–48px` large.
- Variants: **primary**, **secondary**, **ghost**, **destructive**.
- Must have: hover/active/disabled + visible focus ring.

### Inputs
- Label above.
- Helper text below.
- Error message below in danger.
- Consistent padding and border style.

### Cards / panels
- Border-first surface.
- Title left, actions right.
- Keep headers short.

### Tables
- Sticky header on long tables.
- Numbers right-aligned.
- Row hover highlight.
- Empty state (“No data yet”).

### Navigation
- Keep nav minimal.
- Clear current-state styling.
- Don’t hide primary actions.

---

## 6) Interaction sanity (minimal)
- **UI states exist:** hover/active/disabled for controls (prefer component defaults).
- **Don’t nuke outlines:** keep a visible focus style *if it already comes for free* via the component library.
- **Meaning isn’t color-only:** if something is “bad/good”, add a short label or icon (avoid ambiguity).

---

## 7) Motion (minimal)
- Default transitions `150–200ms`.
- Motion clarifies state changes, never decoration.

---

## 8) Implementation hints (Codex)
- Map tokens into your design system (Tailwind/shadcn or equivalent).
- Reuse components; avoid bespoke styling.
- When uncertain: **simplify** and increase whitespace.

---

## 9) Quick QA checklist
- [ ] One obvious primary action
- [ ] One H1 only
- [ ] Spacing uses the scale only
- [ ] Hover/active/disabled exist
- [ ] Text is comfortable to read on `bg/surface`
- [ ] Mobile: no horizontal scroll
- [ ] Loading/empty/error states exist

