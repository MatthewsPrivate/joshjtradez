# JoshJTradez — Editing Guide

Practical "where do I change X" reference. Section by section. Almost everything you'll want to edit is in **one file**: [src/lib/content.ts](src/lib/content.ts).

---

## Golden rule

**99% of edits → [src/lib/content.ts](src/lib/content.ts).**

That file holds every headline, button label, stat number, social link, contact field, and footer link on the site. Touch it and the whole page updates. You should almost never need to open a `.astro` component file just to change text.

Only open a component file when you're changing **layout / structure** (e.g. adding a whole new section).

---

## Quick lookup table

| I want to change… | File | Section to find |
|---|---|---|
| Page title / browser tab | [src/lib/content.ts](src/lib/content.ts) | `SITE` |
| Logo text (top-left) | [src/lib/content.ts](src/lib/content.ts) | `HEADER.logo` |
| "Join Now" button | [src/lib/content.ts](src/lib/content.ts) | `HEADER.joinCtaLabel` / `joinCtaHref` |
| Top nav items | [src/lib/content.ts](src/lib/content.ts) | `NAV_ITEMS` |
| Hero video caption | [src/lib/content.ts](src/lib/content.ts) | `HERO` |
| Big "TRADING SMARTER" headline | [src/lib/content.ts](src/lib/content.ts) | `IDENTITY_HEADLINE_LINES` |
| Win-rate / payout numbers | [src/lib/content.ts](src/lib/content.ts) | `STATS` |
| Contact form fields | [src/lib/content.ts](src/lib/content.ts) | `CONTACT_FIELDS` |
| Contact form benefits | [src/lib/content.ts](src/lib/content.ts) | `CONTACT_BENEFITS` |
| Results / certificate cards | [src/lib/content.ts](src/lib/content.ts) | `PROOF_FEATURED` / `PROOF_SECONDARY` |
| YouTube / Instagram / TikTok / Discord links | [src/lib/content.ts](src/lib/content.ts) | `SOCIAL_PLATFORMS` |
| Footer link columns | [src/lib/content.ts](src/lib/content.ts) | `FOOTER_COLUMNS` |
| Footer tagline + bottom links | [src/lib/content.ts](src/lib/content.ts) | `FOOTER` |
| Brand colors (gold, dark) | [src/styles/globals.css](src/styles/globals.css) | `:root { --bg-base, --gold-500, ... }` |
| Certificate / payout images | `/public/images/` folder | replace files by filename |
| 3D hero scene (gold candle, pillars) | [src/components/motion/HeroScene.tsx](src/components/motion/HeroScene.tsx) | see "3D scene" below |
| Add or remove a whole section | [src/pages/index.astro](src/pages/index.astro) | the `<main>` block |

---

## How to make a change (workflow)

1. Open VS Code / Cursor in the project folder.
2. `Ctrl+P`, type the file name from the table above (e.g. `content.ts`), hit Enter.
3. `Ctrl+F` to find the constant name (e.g. `STATS`) — jumps right to it.
4. Edit the string/number, save.
5. If `npm run dev` is running, the browser hot-reloads.

To preview locally:

```powershell
npm run dev
```

To build for production:

```powershell
npm run build
```

---

## Section-by-section

### Site title + browser tab

[src/lib/content.ts](src/lib/content.ts) → `SITE`

```ts
export const SITE = {
  title: "JoshJTradez — Trading Smarter. Winning Bigger.",
  description: "...",
};
```

`title` is what appears in the browser tab. `description` is the SEO meta description (Google preview text).

---

### Header (top nav)

[src/lib/content.ts](src/lib/content.ts) → `HEADER` and `NAV_ITEMS`

```ts
export const HEADER = {
  logo: "JOSHJTRADEZ",          // top-left brand text
  joinCtaLabel: "Join Now",     // button text
  joinCtaHref: "#contact",      // where it scrolls to
};

export const NAV_ITEMS = [
  { label: "Results",    href: "#results"   },
  { label: "Community",  href: "#community" },
  { label: "About",      href: "#about"     },
  { label: "Contact",    href: "#contact"   },
];
```

To **add** a nav link: copy a `{ label, href }` line and tweak.
To **remove** one: delete that line.
The `href` must match a section `id` on the page (or be an external URL).

---

### S01 — Hero (intro video frame)

[src/lib/content.ts](src/lib/content.ts) → `HERO`

```ts
export const HERO = {
  eyebrow: "Intro Video",
  caption: "Full-screen autoplay · Josh introduces himself ...",
  scrollLabel: "Scroll",
};
```

The big play button + gold-framed slot live in [src/components/sections/Hero.astro](src/components/sections/Hero.astro). To **swap in a real video**, find the `<button class="play-btn">` element and replace the surrounding markup with a `<video>` tag.

---

### S02 — Identity (headline + stats)

[src/lib/content.ts](src/lib/content.ts) → `IDENTITY`, `IDENTITY_HEADLINE_LINES`, `STATS`

**Body copy + portrait label:**

```ts
export const IDENTITY = {
  eyebrow: "Identity",
  body: "Real trades. Real results. ...",
  primaryCta:   { label: "Join the Community", href: "#community" },
  secondaryCta: { label: "View Results",       href: "#results"   },
  portraitLabel: "PORTRAIT IMG",
  portraitMeta: "JOSH · CIRCULAR · 480×480",
};
```

**Big headline — gold/white per-word:**

```ts
export const IDENTITY_HEADLINE_LINES = [
  [
    { text: "TRADING",  gold: true  },
    { text: "SMARTER.", gold: false },
  ],
  [
    { text: "WINNING",  gold: false },
    { text: "BIGGER.",  gold: true  },
  ],
];
```

Each inner array is one line. Each `{ text, gold }` is one word.
`gold: true` → that word turns gold, `gold: false` → warm white.

**Stat tiles (Win Rate / Avg Win / etc.):**

```ts
export const STATS: Stat[] = [
  { value: "40%",    numeric: 40,    suffix: "%", label: "Win Rate", gauge: 40, trend: "up",   meta: "Verified live account" },
  { value: "$64.15", numeric: 64.15, prefix: "$", label: "Avg Win",             trend: "up",   meta: "Per trade" },
  { value: "$33.77", numeric: 33.77, prefix: "-$", label: "Avg Loss",           trend: "down", meta: "Per trade" },
  { value: "$860",   numeric: 860,   prefix: "$", label: "Latest Payout",       trend: "up",   meta: "Jan 2026 · FuturesElite" },
];
```

- `value` — what's shown when the count-up animation finishes
- `numeric` — number the rolling odometer counts up to
- `prefix` / `suffix` — characters wrapped around the rolling number (e.g. `$`, `%`)
- `label` — name under the number
- `trend` — `"up"` adds gold ↑, `"down"` adds muted ↓, `"neutral"` no arrow
- `gauge` — 0-100; if set, shows a circular ring at that fill
- `meta` — small subtitle under the label

To **add a stat tile**: copy a row, tweak. To **remove one**: delete the row.

---

### S03 — Proof (verified results)

[src/lib/content.ts](src/lib/content.ts) → `PROOF`, `PROOF_FEATURED`, `PROOF_SECONDARY`

**Section header copy:**

```ts
export const PROOF = {
  eyebrow: "Verified Results",
  heading: "THE RECEIPTS DON'T LIE",
  sub: "Verified payouts, screenshots & monthly scorecards ...",
  footnote: "Names sanitised on payout slips. ...",
};
```

**Cards — top row (3 featured certificates):**

```ts
export const PROOF_FEATURED: ProofCard[] = [
  {
    id: "topstep",
    label: "Topstep · Certified Funded Trader",
    meta: ["Jan 28, 2026", "Trading Combine pass", "Click to enlarge"],
    image: "/images/topstep.png",
    eyebrow: "Funded Account · Topstep",
    featured: true,
  },
  // ... more
];
```

**Cards — bottom row:**

```ts
export const PROOF_SECONDARY: ProofCard[] = [
  { id: "fe-pass-sep", label: "...", meta: [...], image: "/images/pass-2.png", eyebrow: "..." },
  { id: "view-all",    label: "View All Results", meta: ["240+ DOCUMENTS"], isViewAll: true },
];
```

Each card needs:
- `id` — any unique short string
- `label` — title shown on the card
- `meta` — array of small grey tags (dates, accounts, etc.)
- `image` — path under `/public/` (see "Images" below)
- `eyebrow` — small gold text shown at top of the lightbox when opened

Cards **without** an `image` show a fake chart silhouette placeholder — fine for empty slots but they look unfinished. Either give them an image or remove the row.

`isViewAll: true` makes the gold "View All Results" tile (one only).

---

### S04 — Platforms / Community (social cards)

[src/lib/content.ts](src/lib/content.ts) → `PLATFORMS`, `SOCIAL_PLATFORMS`

```ts
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "discord",
    name: "Discord",
    blurb: "Live signals & alerts · ...",
    cta: "Join Free",
    href: "https://discord.gg/nbf9AZBPv",   // ← Discord invite goes here
    highlight: true,                         // ← gold "hero" treatment
  },
  // ...
];
```

`highlight: true` flags the gold hero card (only Discord uses it by default).

The Discord invite is also referenced in the footer — change it in **both** places: `SOCIAL_PLATFORMS` (above) and `FOOTER_COLUMNS` below.

---

### S05 — Contact form

[src/lib/content.ts](src/lib/content.ts) → `CONTACT`, `CONTACT_BENEFITS`, `CONTACT_FIELDS`

**Headline + button + thanks message:**

```ts
export const CONTACT = {
  eyebrow: "Contact",
  headingLead: "READY TO",
  headingGold: "LEVEL UP?",     // gold half of the headline
  sub: "Drop your details — ...",
  benefitsHeading: "Why Reach Out?",
  submitLabel: "Send My Details →",
  thanksHeading: "Locked in.",
  thanksBody: "Josh has your details ...",
};
```

**Benefit bullets:**

```ts
export const CONTACT_BENEFITS = [
  "Personalised trading plan ...",
  "Access to live trade signals ...",
  // ...
];
```

**Form fields:**

```ts
export const CONTACT_FIELDS = [
  { name: "fullName", label: "Full Name", type: "text",  required: true, placeholder: "Your name" },
  { name: "email",    label: "Email",     type: "email", required: true, placeholder: "you@example.com" },
  { name: "experience", label: "Trading Experience", type: "select", required: true,
    options: ["Beginner", "Some demo time", "Live <1yr", "1–3 years", "3+ years"] },
  // ...
];
```

- `type` can be `"text"`, `"email"`, `"tel"`, `"select"`, `"textarea"`
- `"select"` rows need an `options: string[]` array
- `required: false` makes a field optional

To **add a field**: copy a row, change `name`/`label`. The `name` must be unique.

---

### S06 — Footer

[src/lib/content.ts](src/lib/content.ts) → `FOOTER`, `FOOTER_COLUMNS`

```ts
export const FOOTER = {
  brand: "JOSHJTRADEZ",
  tagline: "Community · Profitable Trader · ...",
  copyrightSuffix: "All rights reserved.",
  bottomLinks: [
    { label: "Press",      href: "#" },
    { label: "Terms",      href: "#" },
    { label: "Disclaimer", href: "#" },
  ],
};

export const FOOTER_COLUMNS = [
  { title: "Quick Links", links: [ ... ] },
  { title: "Platforms",   links: [ ... ] },   // ← Discord link is here too
  { title: "Resources",   links: [ ... ] },
  { title: "Legal",       links: [ ... ] },
];
```

To **change a Discord invite**: update it in `SOCIAL_PLATFORMS` (above) **and** in the `FOOTER_COLUMNS → Platforms` block.

---

## Images

All images live under `/public/` and are referenced from `content.ts` as a path starting with `/`.

| Image | File path | Used by |
|---|---|---|
| Topstep cert | `/public/images/topstep.png` | `PROOF_FEATURED` |
| Payout slip | `/public/images/withdrawal.png` | `PROOF_FEATURED` |
| Pass cert Oct | `/public/images/pass-1.png` | `PROOF_FEATURED` |
| Pass cert Sep | `/public/images/pass-2.png` | `PROOF_SECONDARY` |
| Favicon (browser tab icon) | `/public/favicon.svg` | layout |

To **replace an image**: drop a new file at the same path with the same filename. No code change needed.

To **add a new certificate**:
1. Save the image to `/public/images/your-cert.png`
2. Open [src/lib/content.ts](src/lib/content.ts) → `PROOF_FEATURED` or `PROOF_SECONDARY`
3. Add a new card with `image: "/images/your-cert.png"`

Supported formats: `.png`, `.jpg`, `.webp`, `.svg`. PNG with transparent background works best for certificates.

---

## Brand colors

[src/styles/globals.css](src/styles/globals.css) → `:root { ... }` block at the top

```css
:root {
  /* Surface */
  --bg-base:   #0A0A0B;   /* main background */
  --bg-elev-1: #111114;   /* cards, panels */
  --bg-elev-2: #16161A;   /* deeper recessed */

  /* Gold */
  --gold-500:  #E5B344;   /* primary gold */
  --gold-400:  #F2C75C;   /* lighter highlight */
  --gold-300:  #FFDB80;   /* brightest */
  --gold-glow: rgba(229, 179, 68, 0.35);

  /* Text */
  --white:       #F5F5F2;
  --white-muted: #9A9A95;
}
```

Change a hex value, save → the whole site updates. If you rebrand to a different accent color (say teal), replace every `--gold-*` value and the whole gold/dark theme switches.

The **same colors** are also declared inside `@theme { ... }` lower in the file — change them in **both** places so Tailwind utilities (`text-gold-500`, `bg-gold-400`, etc.) match.

---

## Page section order

[src/pages/index.astro](src/pages/index.astro)

```astro
<main>
  <Hero />
  <Identity />
  <Contact />
  <Proof />
  <Platforms />
</main>
```

To **reorder** sections: drag the `<Component />` lines into the order you want.
To **hide** a section: comment it out with `{/* */}` or delete the line.
To **add** a new section: build a `.astro` file under `src/components/sections/`, import it at the top, and place it in `<main>`.

---

## 3D scene (hero animation)

[src/components/motion/HeroScene.tsx](src/components/motion/HeroScene.tsx)

This is the only file where Three.js / React lives. Most edits cluster at the top of the file:

| Knob | Find | Effect |
|---|---|---|
| Number of gold pillars | `const count = 8` inside `makePillars()` | More/fewer columns in the ring |
| Number of crystal shards | `positions` array in `makeShards()` | Add/remove `[x, y, z]` entries |
| Hero candle color | `color="#F2C75C"` inside `HeroCandle` | Brand gold |
| Flame color | `color="#FFDB80"` on the flame sphere + point light | Warmth of the flame |
| Bloom intensity (overall glow) | `<Bloom intensity={1.3} ...>` at the bottom | Higher = more bloom |
| God-ray strength | `<GodRays weight={0.45} exposure={0.55} ...>` | Lower = subtler rays |
| Depth-of-field blur | `<DepthOfField bokehScale={2.6} ...>` | Lower = sharper edges |
| Auto-shatter delay | `window.setTimeout(trigger, 12_000)` near the bottom | Milliseconds before scene auto-explodes |

The scene only renders on **desktop** with **no reduced-motion preference** — see the `client:media` flag in [src/components/sections/Hero.astro](src/components/sections/Hero.astro). Mobile gets the 2D particle backdrop instead.

---

## Common gotchas

- **Don't edit `dist/`** — that's auto-generated by `npm run build`. Anything you put there is overwritten on next build.
- **Adding HTML inside `content.ts`** — strings are rendered as plain text, not HTML. If you write `<b>bold</b>` it shows as literal `<b>bold</b>`. To style words differently use the `gold: true / false` pattern (like the identity headline).
- **Discord link** lives in **two** places (`SOCIAL_PLATFORMS` and `FOOTER_COLUMNS → Platforms`). Update both.
- **Brand color** lives in **two** places (`:root` and `@theme` in `globals.css`). Update both.
- **Section IDs** — nav links (`href: "#results"`) only work if a section on the page has the matching `id="results"`. Section IDs live in the `.astro` files (`<section id="results">`).
- **Stat numbers** need both `value` (display string) and `numeric` (count-up target). Mismatch → the count-up runs to the wrong target and then snaps to the string.

## Cinematic intro video

The intro appears before the main landing page. Until a film is provided, its 3D cover is interactive: Play or Skip intro cracks the screen into glass fragments and reveals the landing page underneath. Reduced-motion visitors enter immediately.

To add your film:
1. Save the video as `public/videos/intro.mp4`.
2. In `src/lib/content.ts`, set `INTRO.videoSrc` to `"/videos/intro.mp4"`.
3. Optionally set `INTRO.poster` to a cover image path in `public`.

The film autoplays muted; Watch the film restarts it with sound and native controls. Finishing the film or choosing Skip intro triggers the breakaway. The transition works without WebGL, and Escape completes it immediately.

Visuals: `src/components/sections/Intro.astro`. Fracture timing and animation: `src/lib/intro-transition.ts`.
## Review deployment and search visibility

The review build tells search engines not to index it in two places:
- `src/layouts/Layout.astro`: robots meta tag with `noindex, nofollow`.
- `vercel.json`: `X-Robots-Tag: noindex, nofollow` on all responses, including image and video files.

This is a search-indexing preference, not a password or access restriction. Anyone with a public deployment link can view the site. Leave crawling allowed so search engines can read the noindex rules.

When Josh approves a search-visible launch, remove BOTH rules and redeploy. Until then, keep these rules on production as well as preview deployments.

Vercel setup: Astro preset, `npm run build`, output `dist`. Connect the GitHub repository for automatic deployment. Use feature branches for review links; merge reviewed changes to the production branch to update the main site.