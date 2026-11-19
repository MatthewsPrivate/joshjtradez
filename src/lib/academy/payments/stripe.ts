// Stripe adapter (hosted Checkout + webhooks) using Stripe's REST API directly,
// so no SDK dependency. Prices come from our products table (price_data), so
// Josh doesn't need to set up products inside Stripe.
//
// Env: STRIPE_SECRET_KEY (sk_test_… / sk_live_…), STRIPE_WEBHOOK_SECRET (whsec_…).
// STRIPE_API_BASE is only for automated tests against a local mock.
import type { CheckoutLookup, CheckoutRequest, CheckoutSession, PaymentProvider, PaymentStatus, VerifiedPaymentEvent } from "./provider";

const TOLERANCE_SECONDS = 300;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Stripe's form encoding: nested keys as a[b][0][c]=v. */
function encode(obj: Json, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") encode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sessionToLookup(s: Json): CheckoutLookup {
  const paid = s.payment_status === "paid" || s.payment_status === "no_payment_required";
  const status: PaymentStatus = paid ? "paid" : s.status === "expired" ? "cancelled" : "pending";
  return {
    orderId: s.metadata?.order_id ?? s.client_reference_id ?? null,
    providerReference: s.id ?? null,
    status,
    amountMinor: typeof s.amount_total === "number" ? s.amount_total : null,
    refundedMinor: null,
    customerEmail: s.customer_details?.email ?? s.customer_email ?? null,
    paymentReference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
    currency: s.currency ? String(s.currency).toUpperCase() : null,
  };
}

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe";
  readonly supportsRefunds = true;
  private readonly base: string;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string | undefined,
    base?: string,
  ) {
    this.base = (base || "https://api.stripe.com").replace(/\/$/, "");
  }

  private async call(method: "GET" | "POST", path: string, body?: Json): Promise<Json> {
    const res = await fetch(`${this.base}/v1/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": "2024-06-20",
      },
      body: body ? encode(body).toString() : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) throw new Error(`Stripe ${method} ${path} → ${res.status}: ${json.error?.message ?? "request failed"}`);
    return json;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const s = await this.call("POST", "checkout/sessions", {
      mode: "payment",
      client_reference_id: req.orderId,
      metadata: { order_id: req.orderId },
      payment_intent_data: { metadata: { order_id: req.orderId } },
      line_items: [
        {
          quantity: 1,
          price_data: { currency: req.currency.toLowerCase(), unit_amount: req.amountMinor, product_data: { name: req.productName } },
        },
      ],
      customer_email: req.email ?? undefined,
      allow_promotion_codes: true,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
    });
    if (!s.url || !s.id) throw new Error("Stripe returned no checkout URL");
    return { redirectUrl: s.url, providerReference: s.id };
  }

  async lookupCheckout(providerReference: string): Promise<CheckoutLookup> {
    if (!/^cs_[A-Za-z0-9_]+$/.test(providerReference)) throw new Error("Not a Stripe checkout session id");
    return sessionToLookup(await this.call("GET", `checkout/sessions/${providerReference}`));
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent> {
    if (!this.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    const header = headers.get("stripe-signature") ?? "";
    const parts = header.split(",").map((p) => p.split("=", 2) as [string, string]);
    const t = parts.find(([k]) => k === "t")?.[1];
    const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    if (!t || !sigs.length) throw new Error("Missing Stripe signature");
    if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) throw new Error("Stripe signature timestamp outside tolerance");

    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(this.webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)));
    if (!sigs.some((s) => safeEqual(s, expected))) throw new Error("Invalid Stripe signature");

    const event = JSON.parse(rawBody) as Json;
    const obj = (event.data?.object ?? {}) as Json;
    const base = { eventId: String(event.id), type: String(event.type), raw: event };

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        return { ...base, ...sessionToLookup(obj) };
      case "checkout.session.async_payment_failed":
        return { ...base, ...sessionToLookup(obj), status: "failed" };
      case "checkout.session.expired":
        return { ...base, ...sessionToLookup(obj), status: "cancelled" };
      case "charge.refunded": {
        const refunded = Number(obj.amount_refunded ?? 0);
        const amount = Number(obj.amount ?? 0);
        return {
          ...base,
          orderId: obj.metadata?.order_id ?? null,
          providerReference: null,
          paymentReference: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
          status: refunded >= amount ? "refunded" : "partially_refunded",
          amountMinor: amount,
          refundedMinor: refunded,
        };
      }
      default:
        return { ...base, orderId: null, providerReference: null, status: null, amountMinor: null, refundedMinor: null };
    }
  }
}

let cached: StripeProvider | null | undefined;

/** The configured payment provider, or null when payments aren't set up yet. */
export function getPaymentProvider(): StripeProvider | null {
  if (cached !== undefined) return cached;
  const key = import.meta.env.STRIPE_SECRET_KEY;
  // A test base URL is honoured only for a local mock, so the secret key can never be sent elsewhere.
  const base = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(import.meta.env.STRIPE_API_BASE ?? "") ? import.meta.env.STRIPE_API_BASE : undefined;
  cached = key ? new StripeProvider(key, import.meta.env.STRIPE_WEBHOOK_SECRET, base) : null;
  return cached;
}

export const isPaymentsConfigured = () => Boolean(import.meta.env.STRIPE_SECRET_KEY);
