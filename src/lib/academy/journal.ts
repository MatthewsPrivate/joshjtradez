// Trading journal: row types, option lists and the statistics shown on the
// journal page. Everything is computed from the student's own trades — a
// metric with no data behind it is reported as null and rendered as "—".
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase";

export const TRADE_COLUMNS =
  "id, user_id, instrument, market, direction, entry_price, exit_price, stop_loss, take_profit, position_size, size_unit, account_currency, risk_pct, pnl, strategy, session, entry_at, exit_at, emotional_state, notes, mistakes, lessons_learned, screenshots, shared_with_teacher, review_requested_at, reviewed_at, planned_rr, r_multiple, created_at, updated_at";

export interface TradeRow {
  id: string;
  user_id: string;
  instrument: string;
  market: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  size_unit: string;
  account_currency: string;
  risk_pct: number | null;
  pnl: number | null;
  strategy: string | null;
  session: string | null;
  entry_at: string;
  exit_at: string | null;
  emotional_state: string | null;
  notes: string;
  mistakes: string[];
  lessons_learned: string;
  screenshots: string[];
  shared_with_teacher: boolean;
  review_requested_at: string | null;
  reviewed_at: string | null;
  planned_rr: number | null;
  r_multiple: number | null;
  created_at: string;
  updated_at: string;
}

export interface JournalSettings {
  starting_balance: number | null;
  currency: string;
  strategies: string[];
}

export const DEFAULT_SETTINGS: JournalSettings = { starting_balance: null, currency: "GBP", strategies: [] };

export const MARKETS = ["forex", "indices", "commodities", "crypto", "stocks", "futures"] as const;
export const SESSIONS = ["Asia", "London", "New York", "London/NY overlap"] as const;
export const EMOTIONS = ["Focused", "Confident", "Patient", "Neutral", "Anxious", "Impatient", "FOMO", "Revenge", "Tired"] as const;
export const MISTAKES = [
  "Moved stop loss",
  "Entered early",
  "Entered late / chased",
  "No clear setup",
  "Oversized position",
  "Closed too early",
  "Ignored my plan",
  "Traded during news",
  "Revenge trade",
] as const;
export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export const MAX_SCREENSHOTS = 4;
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

export type ReviewState = "none" | "requested" | "reviewed";

export function reviewState(t: Pick<TradeRow, "review_requested_at" | "reviewed_at">): ReviewState {
  if (!t.review_requested_at) return "none";
  return t.reviewed_at && t.reviewed_at >= t.review_requested_at ? "reviewed" : "requested";
}

export const isClosed = (t: TradeRow) => t.exit_price !== null || t.pnl !== null;

/** +1 win, -1 loss, 0 breakeven/unknown. Uses P&L when logged, otherwise the R multiple. */
export function outcome(t: TradeRow): -1 | 0 | 1 {
  const v = t.pnl ?? t.r_multiple;
  if (v === null || v === undefined) return 0;
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export interface GroupStat {
  name: string;
  trades: number;
  winRate: number | null;
  totalR: number;
  totalPnl: number;
}

export interface JournalStats {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number | null;
  returnPct: number | null;
  profitFactor: number | null;
  avgR: number | null;
  totalR: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  /** % of trades logged with a stop loss — the simplest risk-discipline signal. */
  stopLossRate: number | null;
  /** Equity curve points (balance, or cumulative R when no P&L is logged). */
  curve: number[];
  curveUnit: "money" | "R";
  bestTrade: TradeRow | null;
  worstTrade: TradeRow | null;
  byStrategy: GroupStat[];
  bySession: GroupStat[];
  byInstrument: GroupStat[];
  topMistakes: { name: string; count: number; lostR: number }[];
  emotions: { name: string; trades: number; winRate: number | null }[];
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const closeTime = (t: TradeRow) => t.exit_at ?? t.entry_at;

/** Supabase returns numeric columns as numbers or strings depending on size — normalise once. */
export function normaliseTrade(raw: Record<string, unknown>): TradeRow {
  const t = raw as unknown as TradeRow;
  return {
    ...t,
    entry_price: Number(t.entry_price),
    exit_price: num(t.exit_price),
    stop_loss: num(t.stop_loss),
    take_profit: num(t.take_profit),
    position_size: num(t.position_size),
    risk_pct: num(t.risk_pct),
    pnl: num(t.pnl),
    planned_rr: num(t.planned_rr),
    r_multiple: num(t.r_multiple),
    mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
    screenshots: Array.isArray(t.screenshots) ? (t.screenshots as unknown[]).filter((s): s is string => typeof s === "string") : [],
  };
}

function group(trades: TradeRow[], key: (t: TradeRow) => string | null | undefined): GroupStat[] {
  const map = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const k = key(t)?.trim();
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  return [...map.entries()]
    .map(([name, ts]) => {
      const decided = ts.filter((t) => outcome(t) !== 0);
      return {
        name,
        trades: ts.length,
        winRate: decided.length ? (decided.filter((t) => outcome(t) > 0).length / decided.length) * 100 : null,
        totalR: sum(ts.map((t) => t.r_multiple ?? 0)),
        totalPnl: sum(ts.map((t) => t.pnl ?? 0)),
      };
    })
    .sort((a, b) => b.trades - a.trades || b.totalR - a.totalR);
}

export function computeStats(all: TradeRow[], settings: JournalSettings): JournalStats {
  const closed = all.filter(isClosed).sort((a, b) => closeTime(a).localeCompare(closeTime(b)));
  const wins = closed.filter((t) => outcome(t) > 0);
  const losses = closed.filter((t) => outcome(t) < 0);
  const decided = wins.length + losses.length;

  const withPnl = closed.filter((t) => t.pnl !== null);
  const withR = closed.filter((t) => t.r_multiple !== null);
  const netPnl = withPnl.length ? sum(withPnl.map((t) => t.pnl!)) : null;

  const grossWin = withPnl.length ? sum(withPnl.filter((t) => t.pnl! > 0).map((t) => t.pnl!)) : sum(withR.filter((t) => t.r_multiple! > 0).map((t) => t.r_multiple!));
  const grossLoss = withPnl.length
    ? Math.abs(sum(withPnl.filter((t) => t.pnl! < 0).map((t) => t.pnl!)))
    : Math.abs(sum(withR.filter((t) => t.r_multiple! < 0).map((t) => t.r_multiple!)));

  const winRs = withR.filter((t) => t.r_multiple! > 0).map((t) => t.r_multiple!);
  const lossRs = withR.filter((t) => t.r_multiple! < 0).map((t) => t.r_multiple!);

  let curveUnit: "money" | "R" = "money";
  let curve: number[] = [];
  if (withPnl.length) {
    let bal = settings.starting_balance ?? 0;
    curve = [bal, ...withPnl.map((t) => (bal += t.pnl!))];
  } else if (withR.length) {
    curveUnit = "R";
    let r = 0;
    curve = [0, ...withR.map((t) => (r += t.r_multiple!))];
  }

  const ranked = [...closed].filter((t) => (t.pnl ?? t.r_multiple) !== null).sort((a, b) => (a.pnl ?? a.r_multiple!) - (b.pnl ?? b.r_multiple!));

  const mistakeMap = new Map<string, { count: number; lostR: number }>();
  for (const t of closed) {
    for (const m of t.mistakes) {
      const cur = mistakeMap.get(m) ?? { count: 0, lostR: 0 };
      cur.count++;
      if ((t.r_multiple ?? 0) < 0) cur.lostR += t.r_multiple!;
      mistakeMap.set(m, cur);
    }
  }

  return {
    total: all.length,
    open: all.length - closed.length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: decided ? (wins.length / decided) * 100 : null,
    netPnl,
    returnPct: netPnl !== null && settings.starting_balance ? (netPnl / settings.starting_balance) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgR: withR.length ? sum(withR.map((t) => t.r_multiple!)) / withR.length : null,
    totalR: withR.length ? sum(withR.map((t) => t.r_multiple!)) : null,
    avgWinR: winRs.length ? sum(winRs) / winRs.length : null,
    avgLossR: lossRs.length ? sum(lossRs) / lossRs.length : null,
    stopLossRate: all.length ? (all.filter((t) => t.stop_loss !== null).length / all.length) * 100 : null,
    curve,
    curveUnit,
    bestTrade: ranked.at(-1) ?? null,
    worstTrade: ranked.length > 1 ? ranked[0]! : null,
    byStrategy: group(closed, (t) => t.strategy),
    bySession: group(closed, (t) => t.session),
    byInstrument: group(closed, (t) => t.instrument),
    topMistakes: [...mistakeMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    emotions: group(closed, (t) => t.emotional_state).map(({ name, trades, winRate }) => ({ name, trades, winRate })),
  };
}

export async function loadSettings(supabase: SupabaseClient, userId: string): Promise<JournalSettings> {
  const { data } = await supabase.from("trade_journal_settings").select("starting_balance, currency, strategies").eq("user_id", userId).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { starting_balance: num(data.starting_balance), currency: data.currency ?? "GBP", strategies: data.strategies ?? [] };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function money(v: number | null, currency = "GBP", signed = true): string {
  if (v === null) return "—";
  const s = new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(Math.abs(v));
  return signed ? `${v > 0 ? "+" : v < 0 ? "-" : ""}${s}` : v < 0 ? `-${s}` : s;
}

export const fmtR = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}R`);
export const fmtPct = (v: number | null, dp = 1) => (v === null ? "—" : `${v.toFixed(dp)}%`);
export const fmtPrice = (v: number | null) => (v === null ? "—" : String(v));
export const tone = (v: number | null) => (v === null || v === 0 ? "" : v > 0 ? "up" : "down");

// <input type="datetime-local"> has no time zone; the academy works in UK time.
function londonOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!) - utcMs;
}

/** "2026-11-19T09:30" (UK local) → ISO UTC string, or null if invalid. */
export function londonLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const d = new Date(guess - londonOffsetMs(guess));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → "2026-11-19T09:30" in UK time, for datetime-local inputs. */
export function isoToLondonLocal(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  return new Date(ms + londonOffsetMs(ms)).toISOString().slice(0, 16);
}

export function tradeDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function tradeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "Europe/London" }).toUpperCase();
}

// ---------------------------------------------------------------------------
// Screenshots live in the private user-files bucket under <user_id>/trades/.
// Pages sign short-lived URLs after RLS has confirmed the viewer can read the trade.
// ---------------------------------------------------------------------------

export async function signScreenshots(paths: string[]): Promise<{ path: string; url: string }[]> {
  if (!paths.length) return [];
  const { data, error } = await createServiceClient().storage.from("user-files").createSignedUrls(paths, 60 * 60);
  if (error || !data) {
    console.error("[journal] sign screenshots failed:", error?.message);
    return [];
  }
  return data.flatMap((d) => (d.signedUrl && d.path ? [{ path: d.path, url: d.signedUrl }] : []));
}

export interface ReviewComment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
  is_staff: boolean;
}

export async function loadThread(supabase: SupabaseClient, tradeId: string): Promise<ReviewComment[]> {
  const { data } = await supabase.from("trade_reviews").select("id, author_id, body, created_at").eq("trade_id", tradeId).order("created_at");
  const rows = (data ?? []) as Omit<ReviewComment, "author_name" | "is_staff">[];
  if (!rows.length) return [];
  const { data: people } = await supabase.from("member_directory").select("id, name, is_staff").in("id", [...new Set(rows.map((r) => r.author_id))]);
  const who = new Map((people ?? []).map((p) => [p.id as string, p as { name: string; is_staff: boolean }]));
  return rows.map((r) => ({ ...r, author_name: who.get(r.author_id)?.name ?? "Member", is_staff: who.get(r.author_id)?.is_staff ?? false }));
}
