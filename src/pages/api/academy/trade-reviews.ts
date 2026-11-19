// Comments in a trade's review thread. Both the student and their reviewer
// (Josh / their teacher) post here; RLS decides who may read or write, and
// database triggers update the review status and send notifications.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";
import { audit } from "../../../lib/academy/audit";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = ctx.locals;
  const form = await ctx.request.formData();
  const intent = str(form, "intent");
  const back = backTo(form, "/academy/student/trading-journal");

  if (intent === "comment") {
    const tradeId = str(form, "trade_id");
    const body = str(form, "body", 10_000);
    if (!isUuid(tradeId) || !body) return done(ctx, back, { error: "missing" });
    const { data: trade } = await supabase.from("trades").select("id, user_id").eq("id", tradeId).maybeSingle();
    if (!trade) return done(ctx, back, { error: "not-found" });
    const { error } = await supabase.from("trade_reviews").insert({ trade_id: tradeId, author_id: user!.id, body });
    if (error) {
      console.error("[trade-reviews] insert failed:", error.message);
      return done(ctx, back, { error: "not-allowed" });
    }
    if (trade.user_id !== user!.id) {
      await audit({ actorId: user!.id, action: "trade.reviewed", targetType: "trade", targetId: tradeId, metadata: { student: trade.user_id } });
    }
    return done(ctx, `${back.split("#")[0]}#thread`, { notice: trade.user_id === user!.id ? "reply-sent" : "feedback-sent" });
  }

  if (intent === "delete") {
    const id = str(form, "id");
    if (!isUuid(id)) return done(ctx, back, { error: "invalid" });
    const { error } = await supabase.from("trade_reviews").delete().eq("id", id).eq("author_id", user!.id);
    return done(ctx, back, error ? { error: "failed" } : { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
