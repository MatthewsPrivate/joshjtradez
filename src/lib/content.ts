// =============================================================================
//                         ✏️  JOSHJTRADEZ — PAGE COPY
//
//   Edit any string in this file and it updates everywhere on the site.
//   Each export is grouped by section so you can find things fast.
//
//   • Plain text = headings, body, button labels, tooltips
//   • Headlines with mixed gold/white words use { text, gold } pairs
//   • Lists (stats, platforms, footer columns, fields) live near the bottom
//
//   You don't need to touch CSS or component files to change copy.
// =============================================================================

// -----------------------------------------------------------------------------
// SITE — <title> and meta description
// -----------------------------------------------------------------------------
export const SITE = {
  title: "JoshJTradez — Trading Smarter. Winning Bigger.",
  description:
    "Real trades. Real results. JoshJTradez brings institutional-grade strategies to everyday traders.",
} as const;

// -----------------------------------------------------------------------------
// HEADER — sticky nav at the top of the page
// -----------------------------------------------------------------------------
export const HEADER = {
  logo: "JOSHJTRADEZ",
  joinCtaLabel: "Join Now",
  joinCtaHref: "#contact",
} as const;

export const NAV_ITEMS = [
  { label: "Results",        href: "#results" },
  { label: "Community",      href: "#community" },
  { label: "About",          href: "#about" },
  { label: "Contact",        href: "#contact" },
] as const;

// -----------------------------------------------------------------------------
// S01 HERO — full-screen intro with the gold-framed video
// -----------------------------------------------------------------------------
export const HERO = {
  eyebrow: "Intro Video",
  caption:
    "Full-screen autoplay · Josh introduces himself & trading journey · No sound initially",
  scrollLabel: "Scroll",
} as const;

// -----------------------------------------------------------------------------
// S02 IDENTITY — headline, body, CTAs, portrait, stat row
// -----------------------------------------------------------------------------
export const IDENTITY = {
  eyebrow: "Identity",
  body:
    "Real trades. Real results. JoshJTradez brings institutional-grade strategies to everyday traders — no hype, just charts that print. Join a growing community of profitable traders.",
  primaryCta:   { label: "Join the Community", href: "#community" },
  secondaryCta: { label: "View Results",       href: "#results"   },
  portraitLabel: "PORTRAIT IMG",
  portraitMeta: "JOSH · CIRCULAR · 480×480",
} as const;

// Headline rendered line-by-line. Each word gets its own bubble. Set `gold: true`
// to colour it in JoshJTradez gold; otherwise it renders in warm white.
export const IDENTITY_HEADLINE_LINES = [
  [
    { text: "TRADING",  gold: true  },
    { text: "SMARTER.", gold: false },
  ],
  [
    { text: "WINNING",  gold: false },
    { text: "BIGGER.",  gold: true  },
  ],
] as const;

// Stat tiles below the identity headline.
//   value:   what's shown verbatim once the count-up animation finishes
//   numeric: the number the odometer counts up to
//   prefix/suffix: characters wrapped around the rolling number during the count
//   trend:   "up" → gold accent + ↑ glyph; "down" → muted + ↓; "neutral" → flat
//   gauge:   if set (0–100), render a circular SVG gauge ring at that fill
//   meta:    optional sub-line below the label
export interface Stat {
  value: string;
  numeric: number;
  prefix?: string;
  suffix?: string;
  label: string;
  trend?: "up" | "down" | "neutral";
  gauge?: number;
  meta?: string;
}

// Numbers below come from Josh's verified prop-account widgets + certificates.
// Update these as new pass / withdrawal certs land.
export const STATS: Stat[] = [
  { value: "40%",     numeric: 40,    suffix: "%",  label: "Win Rate",      gauge: 40,  trend: "up",   meta: "Verified live account" },
  { value: "$64.15",  numeric: 64.15, prefix: "$",  label: "Avg Win",                   trend: "up",   meta: "Per trade" },
  { value: "$33.77",  numeric: 33.77, prefix: "-$", label: "Avg Loss",                  trend: "down", meta: "Per trade" },
  { value: "$860",    numeric: 860,   prefix: "$",  label: "Latest Payout",             trend: "up",   meta: "Jan 2026 · FuturesElite" },
];

// -----------------------------------------------------------------------------
// S06 CONTACT — Tally form slot + benefits panel
// -----------------------------------------------------------------------------
export const CONTACT = {
  eyebrow: "Contact",
  // Headline is rendered as: <lead> <gold>
  headingLead: "READY TO",
  headingGold: "LEVEL UP?",
  sub: "Drop your details — Josh will reach out personally within 24 hours.",
  benefitsHeading: "Why Reach Out?",
  submitLabel: "Send My Details →",
  formNote:
    "This form scaffolds the Tally embed slot — replace markup with <Tally /> once the form ID lands.",
  thanksHeading: "Locked in.",
  thanksBody:
    "Josh has your details and will reach out within 24 hours. Welcome to the floor.",
} as const;

export const CONTACT_BENEFITS = [
  "Personalised trading plan built specifically for your goals and risk tolerance",
  "Access to live trade signals every morning Josh is in the market",
  "Entry into the exclusive Discord community with 3,200+ traders",
  "One-on-one mentorship sessions & paid-in-trade content",
];

// Form fields. Add or remove rows here to change the form.
//   type "select" needs `options: string[]`
//   type "textarea" renders as a multi-line input
export const CONTACT_FIELDS = [
  { name: "fullName",   label: "Full Name",                       type: "text",     required: true,  placeholder: "Your name" },
  { name: "email",      label: "Email",                           type: "email",    required: true,  placeholder: "you@example.com" },
  { name: "phone",      label: "WhatsApp / Phone",                type: "tel",      required: true,  placeholder: "+27 ..." },
  { name: "country",    label: "Country",                         type: "text",     required: true,  placeholder: "South Africa" },
  { name: "experience", label: "Trading Experience",              type: "select",   required: true,
    options: ["Beginner", "Some demo time", "Live <1yr", "1–3 years", "3+ years"] },
  { name: "trading",    label: "Currently Trading?",              type: "select",   required: true,
    options: ["Yes — live", "Yes — demo", "Not yet"] },
  // Replace these four placeholder ranges with Josh's pricing when confirmed.
  { name: "mentorshipBudget", label: "How much are you willing to invest into mentorship?", type: "select", required: true,
    options: ["Price range 1 (TBC)", "Price range 2 (TBC)", "Price range 3 (TBC)", "Price range 4 (TBC)"] },
  { name: "goal",       label: "Trading Goal (next 6–12 months)", type: "textarea", required: true,  placeholder: "What does success look like for you?" },
  { name: "challenges", label: "Current Challenges / Blocks",     type: "textarea", required: false, placeholder: "What's been holding you back?" },
  { name: "referral",   label: "How You Heard About JoshJTradez", type: "text",     required: false, placeholder: "YouTube, Instagram, friend, …" },
] as const;

// -----------------------------------------------------------------------------
// S03 PROOF — verified results gallery
// -----------------------------------------------------------------------------
export const PROOF = {
  eyebrow: "Verified Results",
  heading: "THE RECEIPTS DON'T LIE",
  sub: "Verified payouts, screenshots & monthly scorecards — all real, all documented.",
  footnote:
    "Names sanitised on payout slips. Trade screenshots are timestamped and account-IDs cropped where possible.",
  viewAllLabel: "View All Results",
  viewAllMeta: "240+ DOCUMENTS",
  viewAllSubLabel: "All Documents",
} as const;

export interface ProofCard {
  id: string;
  label: string;
  meta: string[];
  /** Path under /public — eg. "/proof/topstep-funded-trader.png" */
  image?: string;
  /** Eyebrow shown above the lightbox title */
  eyebrow?: string;
  featured?: boolean;
  isViewAll?: boolean;
}

// Real verified certificates — image files live in /public/images/.
// See public/images/README.txt for filenames + drop instructions.
export const PROOF_FEATURED: ProofCard[] = [
  {
    id: "topstep",
    label: "Topstep · Certified Funded Trader",
    meta: ["Jan 28, 2026", "Trading Combine pass", "Click to enlarge"],
    image: "/images/topstep.png",
    eyebrow: "Funded Account · Topstep",
    featured: true,
  },
  {
    id: "fe-withdrawal",
    label: "FuturesElite · Withdrawal Certificate",
    meta: ["Jan 20, 2026", "Profit Share $860", "Click to enlarge"],
    image: "/images/withdrawal.png",
    eyebrow: "Verified Payout · FuturesElite",
    featured: true,
  },
  {
    id: "fe-pass-oct",
    label: "FuturesElite · Pass Certificate",
    meta: ["Oct 15, 2025", "Elite Trader", "Click to enlarge"],
    image: "/images/pass-1.png",
    eyebrow: "Pass Achievement · FuturesElite",
    featured: true,
  },
];
export const PROOF_SECONDARY: ProofCard[] = [
  {
    id: "fe-pass-sep",
    label: "FuturesElite · Pass Certificate",
    meta: ["Sep 19, 2025", "Elite Trader"],
    image: "/images/pass-2.png",
    eyebrow: "Pass Achievement · FuturesElite",
  },
  { id: "view-all", label: "View All Results",      meta: ["240+ DOCUMENTS"], isViewAll: true },
];

// -----------------------------------------------------------------------------
// S05 PLATFORMS — social cards (Discord card is the highlighted hero)
// -----------------------------------------------------------------------------
export const PLATFORMS = {
  eyebrow: "Community",
  heading: "FIND JOSHJTRADEZ EVERYWHERE",
  sub: "Join thousands learning to trade profitably across all platforms.",
} as const;

export interface SocialPlatform {
  id: "youtube" | "instagram" | "tiktok" | "discord";
  name: string;
  blurb: string;
  cta: string;
  href: string;
  highlight?: boolean;
}
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "youtube",
    name: "YouTube",
    blurb: "Trade breakdowns & education · Long-form weekly videos",
    cta: "Subscribe",
    href: "https://youtube.com/@joshjtradez",
  },
  {
    id: "instagram",
    name: "Instagram",
    blurb: "Daily chart setups & lifestyle · Stories with market updates",
    cta: "Follow",
    href: "https://www.instagram.com/joshjtradez",
  },
  {
    id: "tiktok",
    name: "TikTok",
    blurb: "Short-form trade lessons · Bite-sized snippets",
    cta: "Follow",
    href: "https://www.tiktok.com/@joshjtradez",
  },
  {
    id: "discord",
    name: "Discord",
    blurb: "Live signals & alerts · Weekly mentor resources · Members-only platform",
    cta: "Join Free",
    href: "https://discord.gg/nbf9AZBPv",
    highlight: true,
  },
];

// -----------------------------------------------------------------------------
// S07 FOOTER — brand block + 4 link columns + bottom rule
// -----------------------------------------------------------------------------
export const FOOTER = {
  brand: "JOSHJTRADEZ",
  tagline: "Community · Profitable Trader · Educator · Mentor",
  copyrightSuffix: "All rights reserved.",
  bottomLinks: [
    { label: "Press",      href: "#" },
    { label: "Terms",      href: "#" },
    { label: "Disclaimer", href: "#" },
  ],
} as const;

export const FOOTER_COLUMNS = [
  {
    title: "Quick Links",
    links: [
      { label: "Home",          href: "#top"        },
      { label: "Results",       href: "#results"    },
      { label: "Community",     href: "#community"  },
      { label: "About",         href: "#about"      },
      { label: "Contact",       href: "#contact"    },
    ],
  },
  {
    title: "Platforms",
    links: [
      { label: "YouTube",       href: "https://youtube.com/@joshjtradez" },
      { label: "Instagram",     href: "https://www.instagram.com/joshjtradez" },
      { label: "TikTok",        href: "https://www.tiktok.com/@joshjtradez" },
      { label: "Discord",       href: "https://discord.gg/nbf9AZBPv" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Trading Education", href: "#" },
      { label: "Chart Analysis",    href: "#" },
      { label: "Signals Access",    href: "#" },
      { label: "Mentorship Programs", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy",   href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Risk Disclaimer",  href: "#" },
      { label: "Cookie Policy",    href: "#" },
    ],
  },
];

// -----------------------------------------------------------------------------
// MONTHLY (legacy — section is currently hidden in index.astro)
// Re-exported in case you want to drop the section back in.
// -----------------------------------------------------------------------------
export interface MonthlyEntry {
  month: string;
  short: string;
  amountRand: number;
  pct: number;
  isBest?: boolean;
}
export const MONTHLY_RETURNS: MonthlyEntry[] = [
  { month: "January",   short: "Jan", amountRand:  82_400, pct: 41 },
  { month: "February",  short: "Feb", amountRand:  64_200, pct: 32 },
  { month: "March",     short: "Mar", amountRand:  98_700, pct: 49 },
  { month: "April",     short: "Apr", amountRand: 121_500, pct: 60 },
  { month: "May",       short: "May", amountRand: 142_900, pct: 71 },
  { month: "June",      short: "Jun", amountRand: 110_300, pct: 55 },
  { month: "July",      short: "Jul", amountRand: 175_600, pct: 87 },
  { month: "August",    short: "Aug", amountRand: 248_400, pct: 100, isBest: true },
  { month: "September", short: "Sep", amountRand: 168_200, pct: 84 },
  { month: "October",   short: "Oct", amountRand: 137_800, pct: 68 },
  { month: "November",  short: "Nov", amountRand: 156_500, pct: 78 },
  { month: "December",  short: "Dec", amountRand: 192_100, pct: 95 },
];

// INTRO FILM: put the file in public/videos/intro.mp4, then set videoSrc below.
// Keep videoSrc empty to use the animated cinematic placeholder.
export const INTRO = {
  videoSrc: "",
  poster: "",
} as const;