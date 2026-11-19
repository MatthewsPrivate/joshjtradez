// Stripe webhook. Configure in Stripe → Developers → Webhooks:
//   URL:    https://<site>/api/academy/payments/webhook/stripe
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded,
//           checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
// Authenticated by signature (STRIPE_WEBHOOK_SECRET), not by session/origin.
import type { APIRoute } from "astro";
import { applyPaymentUpdate } from "../../../../../lib/academy/payments/fulfil";
import { getPaymentProvider } from "../../../../../lib/academy/payments/stripe";
import { createServiceClient } from "../../../../../lib/academy/supabase";
import { emailOpsAlert } from "../../../../../lib/academy/emails";

export const prerender = false;

const text = (body: string, status: number) => new Response(body, { status, headers: { "content-type": "text/plain" } });

export const POST: APIRoute = async ({ request }) => {
  const provider = getPaymentProvider();
  if (!provider) return text("payments not configured", 503);

  const raw = await request.text();
  if (raw.length > 512 * 1024) return text("payload too large", 413);
  let event;
  try {
    event = await provider.verifyWebhook(raw, request.headers);
  } catch (err) {
    console.warn("[stripe webhook] rejected:", err instanceof Error ? err.message : err);
    return text("invalid signature", 400);
  }

  const db = createServiceClient();
  // Record the event once; a duplicate delivery of an already-processed event is a no-op.
  const { data: existing } = await db.from("payment_events").select("id, processed_at").eq("provider", provider.id).eq("provider_event_id", event.eventId).maybeSingle();
  if (existing?.processed_at) return text("already processed", 200);
  let eventRowId = existing?.id as number | undefined;
  if (!eventRowId) {
    const { data: inserted, error } = await db
      .from("payment_events")
      .insert({ provider: provider.id, provider_event_id: event.eventId, event_type: event.type, payload: event.raw as object })
      .select("id")
      .single();
    if (error) {
      // Unique violation = a concurrent delivery is handling it.
      if (error.code === "23505") return text("in progress", 200);
      console.error("[stripe webhook] could not record event:", error.message);
      return text("storage error", 500);
    }
    eventRowId = inserted.id as number;
  }

  try {
    const order = await applyPaymentUpdate(event, provider.id);
    await db.from("payment_events").update({ processed_at: new Date().toISOString(), order_id: order?.id ?? null, error: null }).eq("id", eventRowId);
    return text("ok", 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe webhook] processing failed:", message);
    await db.from("payment_events").update({ error: message.slice(0, 1000) }).eq("id", eventRowId);
    await emailOpsAlert("Stripe payment couldn't be processed", `Event ${event.eventId} (${event.type}) failed: ${message.slice(0, 300)}. A customer may have paid without getting access.`).catch(() => false);
    return text("processing failed", 500); // Stripe will retry
  }
};
