// Creates a clearly labelled DEMO course (draft) with placeholder lessons so the
// builder, player and progress tracking can be explored before real content is
// uploaded. Created as the signed-in user, so RLS applies; delete it any time.
import type { APIRoute } from "astro";
import { audit } from "../../../lib/academy/audit";
import { done } from "../../../lib/academy/forms";
import { clientIp } from "../../../lib/academy/http";

export const prerender = false;

const PLACEHOLDER = "> **Placeholder content.** Replace this text, add the lesson video and attach resources in the course builder.";

const CURRICULUM: { title: string; lessons: { title: string; minutes: number; preview?: boolean; body: string }[] }[] = [
  {
    title: "Getting started",
    lessons: [
      {
        title: "Welcome to the academy",
        minutes: 6,
        preview: true,
        body: `${PLACEHOLDER}\n\n## What you'll learn\n- How the course is structured\n- How to track your progress\n- How to use your learning and trading journals\n\n**Tip:** mark each lesson complete when you finish it.`,
      },
      {
        title: "How the forex market works",
        minutes: 14,
        body: `${PLACEHOLDER}\n\n## Key ideas\n- Currencies trade in **pairs**, e.g. EUR/USD\n- The first currency is the *base*, the second the *quote*\n- Price shows how much quote currency buys one unit of base\n\n## Sessions\n1. Asian session\n2. London session\n3. New York session`,
      },
      {
        title: "Pips, lots and leverage",
        minutes: 12,
        body: `${PLACEHOLDER}\n\n## Definitions\n- **Pip:** the standard price increment (0.0001 for most pairs, 0.01 for JPY pairs)\n- **Standard lot:** 100,000 units of the base currency\n- **Leverage:** borrowed exposure — it magnifies gains *and* losses`,
      },
    ],
  },
  {
    title: "Reading the chart",
    lessons: [
      { title: "Candlestick anatomy", minutes: 10, body: `${PLACEHOLDER}\n\n## Each candle shows\n- Open, high, low and close\n- The **body** (open to close) and the **wicks**` },
      { title: "Market structure basics", minutes: 16, body: `${PLACEHOLDER}\n\n## Trend structure\n- Uptrend: higher highs and higher lows\n- Downtrend: lower highs and lower lows\n- A **break of structure** can signal a change in direction` },
      { title: "Support, resistance and liquidity", minutes: 18, body: `${PLACEHOLDER}\n\n## Checklist\n- [ ] Mark the obvious highs and lows\n- [ ] Note where stops are likely resting\n- [ ] Wait for confirmation before acting` },
    ],
  },
  {
    title: "Risk management",
    lessons: [
      { title: "Position sizing", minutes: 11, body: `${PLACEHOLDER}\n\n## The rule\nRisk a fixed percentage of your account per trade, and size the position from your stop distance.` },
      { title: "Risk-to-reward", minutes: 9, body: `${PLACEHOLDER}\n\n## Example\nRisking 20 pips to make 60 pips is a **1:3** risk-to-reward ratio.` },
      { title: "Building your trading plan", minutes: 15, body: `${PLACEHOLDER}\n\n## Your plan should cover\n1. Markets and sessions you trade\n2. Entry and exit rules\n3. Maximum risk per trade and per day\n4. How you review your journal` },
    ],
  },
];

export const POST: APIRoute = async (ctx) => {
  const db = ctx.locals.supabase;
  const back = "/academy/teacher/course-builder";
  const suffix = Math.random().toString(36).slice(2, 6);

  const { data: course, error } = await db
    .from("courses")
    .insert({
      title: "DEMO · Forex Foundations",
      slug: `demo-forex-foundations-${suffix}`,
      summary: "Demonstration course with placeholder content — edit it, or delete it once your real courses are ready.",
      description: "This is a demo course created to explore the course builder, lesson player and progress tracking. All lessons contain placeholder text and no video.",
      level: "Foundation",
      category: "Demo",
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !course) return done(ctx, back, { error: error?.code === "42501" ? "not-allowed" : "failed" });

  for (const [mi, mod] of CURRICULUM.entries()) {
    const { data: m, error: mErr } = await db.from("modules").insert({ course_id: course.id, title: mod.title, position: mi }).select("id").single();
    if (mErr || !m) return done(ctx, `${back}/${course.id}`, { error: "failed" });
    const { error: lErr } = await db.from("lessons").insert(
      mod.lessons.map((l, li) => ({
        module_id: m.id,
        title: l.title,
        summary: "Placeholder lesson — replace with your own content.",
        body: { markdown: l.body },
        duration_seconds: l.minutes * 60,
        position: li,
        is_preview: Boolean(l.preview),
        status: "published",
      })),
    );
    if (lErr) return done(ctx, `${back}/${course.id}`, { error: "failed" });
  }

  await audit({ actorId: ctx.locals.user!.id, action: "course.demo_created", targetType: "course", targetId: course.id, ip: clientIp(ctx.request) });
  return done(ctx, `${back}/${course.id}`, { notice: "demo-created" });
};
