// Student trading journal: create / edit / delete trades, screenshots, journal
// settings, "send to Josh for review", and CSV export (GET).
// All writes go through the student's RLS-scoped client, so a student can only
// ever touch their own trades.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, optStr, str } from "../../../lib/academy/forms";
import { CURRENCIES, MARKETS, MAX_SCREENSHOTS, TRADE_COLUMNS, londonLocalToIso, normaliseTrade } from "../../../lib/academy/journal";
import { sendEmail, escapeHtml } from "../../../lib/email";

export const prerender = false;

const JOURNAL = "/academy/student/trading-journal";

/** Positive decimal or null when blank; undefined means "present but invalid". */
function price(form: FormData, name: string): number | null | undefined {
  const s = str(form, name, 40).replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function signed(form: FormData, name: string): number | null | undefined {
  const s = str(form, name, 40).replace(/[,£$€\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

type Parsed = { ok: true; row: Record<string, unknown> } | { ok: false; error: string };

function parseTrade(form: FormData): Parsed {
  const instrument = str(form, "instrument", 40).toUpperCase();
  const direction = str(form, "direction");
  const entry_price = price(form, "entry_price");
  if (!instrument || (direction !== "long" && direction !== "short") || !entry_price) return { ok: false, error: "trade-missing" };

  const exit_price = price(form, "exit_price");
  const stop_loss = price(form, "stop_loss");
  const take_profit = price(form, "take_profit");
  const position_size = price(form, "position_size");
  const pnl = signed(form, "pnl");
  const riskRaw = signed(form, "risk_pct");
  if ([exit_price, stop_loss, take_profit, position_size, pnl, riskRaw].includes(undefined)) return { ok: false, error: "bad-number" };
  if (riskRaw !== null && (riskRaw! < 0 || riskRaw! > 100)) return { ok: false, error: "bad-number" };

  const entry_at = londonLocalToIso(str(form, "entry_at")) ?? new Date().toISOString();
  const exitLocal = str(form, "exit_at");
  const exit_at = exitLocal ? londonLocalToIso(exitLocal) : null;
  if (exit_at && exit_at < entry_at) return { ok: false, error: "bad-dates" };

  const market = str(form, "market");
  const currency = str(form, "account_currency");
  return {
    ok: true,
    row: {
      instrument,
      direction,
      market: (MARKETS as readonly string[]).includes(market) ? market : "forex",
      entry_price,
      exit_price,
      stop_loss,
      take_profit,
      position_size,
      size_unit: str(form, "size_unit", 20) || "lots",
      account_currency: (CURRENCIES as readonly string[]).includes(currency) ? currency : "GBP",
      risk_pct: riskRaw,
      pnl,
      strategy: optStr(form, "strategy", 80),
      session: optStr(form, "session", 40),
      entry_at,
      exit_at,
      emotional_state: optStr(form, "emotional_state", 40),
      notes: str(form, "notes", 20_000),
      lessons_learned: str(form, "lessons_learned", 10_000),
      mistakes: [...new Set(form.getAll("mistakes").filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim().slice(0, 60)))].slice(0, 12),
    },
  };
}

async function emailReviewers(studentName: string, instrument: string, direction: string, tradeId: string, origin: string, message: string) {
  const to = (import.meta.env.ACADEMY_OWNER_EMAILS ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
  if (!to.length) return;
  const link = `${origin}/academy/teacher/trade-reviews/${tradeId}`;
  const result = await sendEmail({
    to,
    subject: `Trade review request: ${instrument} ${direction.toUpperCase()} from ${studentName}`,
    text: `${studentName} sent a ${instrument} ${direction} trade for review.\n\n${message ? `Their note: ${message}\n\n` : ""}Open it: ${link}`,
    html: `<p><strong>${escapeHtml(studentName)}</strong> sent a ${escapeHtml(instrument)} ${escapeHtml(direction)} trade for review.</p>${
      message ? `<blockquote>${escapeHtml(message)}</blockquote>` : ""
    }<p><a href="${link}">Open the trade</a></p>`,
  });
  if (!result.ok && !result.error.startsWith("not configured")) console.error("[trades] review email failed:", result.error);
}

export const POST: APIRoute = async (ctx) => {
  const { supabase, user, profile } = ctx.locals;
  const form = await ctx.request.formData();
  const intent = str(form, "intent");
  const id = str(form, "id");
  const back = backTo(form, JOURNAL);
  const uid = user!.id;
  const trades = () => supabase.from("trades");

  if (intent === "settings") {
    const bal = signed(form, "starting_balance");
    if (bal === undefined || (bal !== null && bal < 0)) return done(ctx, back, { error: "bad-number" });
    const currency = str(form, "currency");
    const strategies = [
      ...new Set(
        str(form, "strategies", 4000)
          .split(/[\n,]/)
          .map((s) => s.trim().slice(0, 80))
          .filter(Boolean),
      ),
    ].slice(0, 30);
    const { error } = await supabase.from("trade_journal_settings").upsert(
      { user_id: uid, starting_balance: bal, currency: (CURRENCIES as readonly string[]).includes(currency) ? currency : "GBP", strategies, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    return done(ctx, back, error ? { error: "failed" } : { notice: "saved" });
  }

  if (intent === "create") {
    const parsed = parseTrade(form);
    if (!parsed.ok) return done(ctx, back, { error: parsed.error });
    const { data, error } = await trades().insert({ ...parsed.row, user_id: uid }).select("id").single();
    if (error || !data) {
      console.error("[trades] create failed:", error?.message);
      return done(ctx, back, { error: "failed" });
    }
    return done(ctx, `${JOURNAL}/${data.id}`, { notice: "trade-saved" });
  }

  if (!isUuid(id)) return done(ctx, back, { error: "invalid" });
  const { data: raw } = await trades().select(TRADE_COLUMNS).eq("id", id).eq("user_id", uid).maybeSingle();
  if (!raw) return done(ctx, JOURNAL, { error: "not-found" });
  const trade = normaliseTrade(raw);

  switch (intent) {
    case "update": {
      const parsed = parseTrade(form);
      if (!parsed.ok) return done(ctx, back, { error: parsed.error });
      const { error } = await trades().update(parsed.row).eq("id", id);
      return done(ctx, back, error ? { error: "failed" } : { notice: "saved" });
    }

    case "delete": {
      const { error } = await trades().delete().eq("id", id);
      if (error) return done(ctx, back, { error: "failed" });
      if (trade.screenshots.length) await supabase.storage.from("user-files").remove(trade.screenshots);
      return done(ctx, JOURNAL, { notice: "deleted" });
    }

    case "request-review": {
      const message = str(form, "message", 4000);
      // A note goes into the review thread; its trigger also opens the request.
      const { error } = message
        ? await supabase.from("trade_reviews").insert({ trade_id: id, author_id: uid, body: message })
        : await trades().update({ review_requested_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        console.error("[trades] request review failed:", error.message);
        return done(ctx, back, { error: "failed" });
      }
      const name = profile?.display_name || profile?.full_name || "A student";
      await emailReviewers(name, trade.instrument, trade.direction, id, ctx.url.origin, message);
      return done(ctx, back, { notice: "review-requested" });
    }

    case "cancel-review": {
      const { error } = await trades().update({ review_requested_at: null }).eq("id", id);
      return done(ctx, back, error ? { error: "failed" } : { notice: "review-cancelled" });
    }

    case "share": {
      const share = str(form, "value") === "on";
      if (!share && trade.review_requested_at) return done(ctx, back, { error: "review-open" });
      const { error } = await trades().update({ shared_with_teacher: share }).eq("id", id);
      return done(ctx, back, error ? { error: "failed" } : { notice: "saved" });
    }

    case "add-screenshot": {
      const path = str(form, "storage_path", 400);
      if (!path.startsWith(`${uid}/trades/${id}/`) || path.includes("..")) return done(ctx, back, { error: "invalid" });
      if (trade.screenshots.length >= MAX_SCREENSHOTS) {
        await supabase.storage.from("user-files").remove([path]);
        return done(ctx, back, { error: "too-many-screenshots" });
      }
      const { error } = await trades().update({ screenshots: [...trade.screenshots, path] }).eq("id", id);
      return done(ctx, back, error ? { error: "failed" } : { notice: "saved" });
    }

    case "remove-screenshot": {
      const path = str(form, "path", 400);
      if (!trade.screenshots.includes(path)) return done(ctx, back, { error: "not-found" });
      const { error } = await trades().update({ screenshots: trade.screenshots.filter((p) => p !== path) }).eq("id", id);
      if (error) return done(ctx, back, { error: "failed" });
      await supabase.storage.from("user-files").remove([path]);
      return done(ctx, back, { notice: "deleted" });
    }
  }
  return done(ctx, back, { error: "invalid" });
};

// CSV export of the student's whole journal.
export const GET: APIRoute = async ({ locals }) => {
  const { data, error } = await locals.supabase.from("trades").select(TRADE_COLUMNS).eq("user_id", locals.user!.id).order("entry_at", { ascending: false }).limit(5000);
  if (error) return new Response("Export failed", { status: 500 });
  const cols = [
    "entry_at", "exit_at", "instrument", "market", "direction", "entry_price", "exit_price", "stop_loss", "take_profit",
    "position_size", "size_unit", "risk_pct", "pnl", "account_currency", "r_multiple", "planned_rr", "strategy", "session",
    "emotional_state", "mistakes", "notes", "lessons_learned",
  ] as const;
  const cell = (v: unknown) => {
    let s = Array.isArray(v) ? v.join("; ") : v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = (data ?? []).map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c])).join(","));
  const csv = [cols.join(","), ...rows].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trading-journal-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
};
