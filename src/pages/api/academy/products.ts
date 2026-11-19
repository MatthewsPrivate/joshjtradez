// Owner → Products: what can be bought, for how much, and which courses it unlocks.
// Writes go through the owner's RLS-scoped client (products_write needs courses.manage).
import type { APIRoute } from "astro";
import { backTo, bool, done, isUuid, str } from "../../../lib/academy/forms";
import { audit } from "../../../lib/academy/audit";

export const prerender = false;

const CURRENCIES = ["GBP", "USD", "EUR"];

/** "297", "297.00", "£1,297.50" → minor units; null when invalid. */
function priceMinor(raw: string): number | null {
  const s = raw.replace(/[£$€,\s]/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const minor = Math.round(Number(s) * 100);
  return minor >= 100 ? minor : null; // Stripe's minimum is about £0.30; require at least 1.00
}

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = ctx.locals;
  const form = await ctx.request.formData();
  const intent = str(form, "intent");
  const back = backTo(form, "/academy/owner/products");
  const id = str(form, "id");

  if (intent === "create" || intent === "update") {
    const name = str(form, "name", 120);
    const price = priceMinor(str(form, "price", 20));
    const currency = CURRENCIES.includes(str(form, "currency")) ? str(form, "currency") : "GBP";
    const courseIds = [...new Set(form.getAll("course_ids").filter((v): v is string => typeof v === "string" && isUuid(v)))];
    if (!name || price === null) return done(ctx, back, { error: "bad-price" });
    if (!courseIds.length) return done(ctx, back, { error: "no-courses" });
    const row = { name, description: str(form, "description", 2000), price_minor: price, currency, active: bool(form, "active"), updated_at: new Date().toISOString() };

    let productId = id;
    if (intent === "create") {
      const { data, error } = await supabase.from("products").insert(row).select("id").single();
      if (error || !data) return done(ctx, back, { error: "not-allowed" });
      productId = data.id;
    } else {
      if (!isUuid(id)) return done(ctx, back, { error: "invalid" });
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) return done(ctx, back, { error: "not-allowed" });
      await supabase.from("product_courses").delete().eq("product_id", id).not("course_id", "in", `(${courseIds.join(",")})`);
    }
    const { error: linkErr } = await supabase.from("product_courses").upsert(courseIds.map((c) => ({ product_id: productId, course_id: c })), { onConflict: "product_id,course_id", ignoreDuplicates: true });
    if (linkErr) return done(ctx, back, { error: "failed" });
    await audit({ actorId: user!.id, action: `product.${intent === "create" ? "created" : "updated"}`, targetType: "product", targetId: productId, metadata: { price_minor: price, currency, active: row.active, courses: courseIds.length } });
    return done(ctx, back, { notice: intent === "create" ? "created" : "saved" });
  }

  if (intent === "delete") {
    if (!isUuid(id)) return done(ctx, back, { error: "invalid" });
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (count) {
      // Keep products with orders for the sales history; just stop selling them.
      await supabase.from("products").update({ active: false }).eq("id", id);
      return done(ctx, back, { notice: "product-archived" });
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) await audit({ actorId: user!.id, action: "product.deleted", targetType: "product", targetId: id });
    return done(ctx, back, error ? { error: "not-allowed" } : { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
