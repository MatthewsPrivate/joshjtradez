// Order lifecycle: start a checkout, apply verified payment updates (from the
// webhook or a server-side lookup), and claim guest orders once an account
// exists. Every step is idempotent — Stripe retries webhooks and the welcome
// page may run the same update — so running any of it twice changes nothing.
import { audit } from "../audit";
import { emailOwnersSale, emailPurchaseConfirmation, emailRefund } from "../emails";
import { createServiceClient } from "../supabase";
import type { CheckoutLookup } from "./provider";
import { getPaymentProvider } from "./stripe";

export interface OrderRecord {
  id: string;
  user_id: string | null;
  product_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  provider: string;
  provider_reference: string | null;
  payment_reference: string | null;
  customer_email: string | null;
  refunded_minor: number;
  paid_at: string | null;
  account_claimed_at: string | null;
}

const ORDER_COLUMNS =
  "id, user_id, product_id, amount_minor, currency, status, provider, provider_reference, payment_reference, customer_email, refunded_minor, paid_at, account_claimed_at";

export class CheckoutError extends Error {
  constructor(public code: "payments-off" | "product-unavailable" | "already-enrolled" | "checkout-failed") {
    super(code);
  }
}

export interface StartCheckoutResult {
  redirectUrl: string;
  orderId: string;
}

/** Create a pending order and a hosted checkout for it. `user` is null for guests. */
export async function startCheckout(opts: {
  productId: string;
  user: { id: string; email: string | null } | null;
  origin: string;
  cancelPath: string;
}): Promise<StartCheckoutResult> {
  const provider = getPaymentProvider();
  if (!provider) throw new CheckoutError("payments-off");
  const db = createServiceClient();

  const { data: product } = await db
    .from("products")
    .select("id, name, price_minor, currency, active, product_courses(course_id)")
    .eq("id", opts.productId)
    .maybeSingle();
  const courseIds = ((product?.product_courses ?? []) as { course_id: string }[]).map((c) => c.course_id);
  if (!product || !product.active || !courseIds.length || product.price_minor <= 0) throw new CheckoutError("product-unavailable");

  if (opts.user) {
    const { data: owned } = await db.from("enrolments").select("course_id").eq("user_id", opts.user.id).eq("status", "active").in("course_id", courseIds);
    if ((owned ?? []).length >= courseIds.length) throw new CheckoutError("already-enrolled");
  }

  const { data: order, error } = await db
    .from("orders")
    .insert({
      user_id: opts.user?.id ?? null,
      customer_email: opts.user?.email ?? null,
      product_id: product.id,
      amount_minor: product.price_minor,
      currency: product.currency,
      status: "pending",
      provider: provider.id,
    })
    .select("id")
    .single();
  if (error || !order) {
    console.error("[checkout] order insert failed:", error?.message);
    throw new CheckoutError("checkout-failed");
  }

  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      userId: opts.user?.id ?? null,
      email: opts.user?.email ?? null,
      productName: product.name,
      amountMinor: product.price_minor,
      currency: product.currency,
      successUrl: `${opts.origin}/academy/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${opts.origin}${opts.cancelPath}`,
    });
    await db.from("orders").update({ provider_reference: session.providerReference }).eq("id", order.id);
    return { redirectUrl: session.redirectUrl, orderId: order.id };
  } catch (err) {
    console.error("[checkout] provider failed:", err instanceof Error ? err.message : err);
    await db.from("orders").update({ status: "failed" }).eq("id", order.id);
    throw new CheckoutError("checkout-failed");
  }
}

async function findOrder(update: Pick<CheckoutLookup, "orderId" | "providerReference" | "paymentReference">, provider: string): Promise<OrderRecord | null> {
  const db = createServiceClient();
  const tries: [string, string | null | undefined][] = [
    ["provider_reference", update.providerReference],
    ["payment_reference", update.paymentReference],
  ];
  for (const [col, val] of tries) {
    if (!val) continue;
    const { data } = await db.from("orders").select(ORDER_COLUMNS).eq("provider", provider).eq(col, val).maybeSingle();
    if (data) return data as OrderRecord;
  }
  // Fall back to our own order id from metadata — but only if it belongs to the same checkout.
  if (update.orderId && /^[0-9a-f-]{36}$/i.test(update.orderId)) {
    const { data } = await db.from("orders").select(ORDER_COLUMNS).eq("id", update.orderId).eq("provider", provider).maybeSingle();
    const o = data as OrderRecord | null;
    if (o && (!o.provider_reference || !update.providerReference || o.provider_reference === update.providerReference)) return o;
  }
  return null;
}

async function notifyOwners(title: string, body: string, link: string) {
  const db = createServiceClient();
  const { data: owners } = await db.from("user_roles").select("user_id").eq("role", "owner");
  if (owners?.length) await db.from("notifications").insert(owners.map((o) => ({ user_id: o.user_id, kind: "sale", title, body, link })));
}

/**
 * Apply a verified payment update to its order. Returns the order afterwards
 * (null if no matching order). Safe to call repeatedly with the same update.
 */
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const siteUrl = () => (import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE || "https://joshjtradez.vercel.app").replace(/\/$/, "");

export async function applyPaymentUpdate(update: CheckoutLookup, providerId = "stripe"): Promise<OrderRecord | null> {
  const db = createServiceClient();
  const order = await findOrder(update, providerId);
  if (!order || !update.status) return order;

  if (update.status === "paid") {
    if (order.status !== "pending" && order.status !== "failed" && order.status !== "cancelled") return order; // already handled
    if (update.currency && update.currency !== order.currency.toUpperCase()) {
      console.error("[payments] currency mismatch on order", order.id, update.currency, order.currency);
      return order;
    }
    const email = (order.customer_email ?? update.customerEmail ?? "").trim().toLowerCase() || null;
    let userId = order.user_id;
    if (!userId && email) {
      const { data } = await db.rpc("user_id_by_email", { e: email });
      userId = (data as string | null) ?? null;
    }
    const { data: updated } = await db
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        // What was actually charged (promotion codes can lower it).
        amount_minor: update.amountMinor ?? order.amount_minor,
        customer_email: email,
        payment_reference: update.paymentReference ?? order.payment_reference,
        user_id: userId,
      })
      .eq("id", order.id)
      .in("status", ["pending", "failed", "cancelled"]) // guards against a concurrent duplicate
      .select(ORDER_COLUMNS)
      .maybeSingle();
    if (!updated) return (await findOrder({ orderId: order.id, providerReference: null, paymentReference: null }, providerId)) ?? order;
    if (userId) await db.rpc("grant_order", { o: order.id });

    const { data: product } = await db.from("products").select("name").eq("id", order.product_id).maybeSingle();
    const productName = product?.name ?? "your course";
    const amount = money(update.amountMinor ?? order.amount_minor, order.currency);
    const site = siteUrl();
    // Runs once per order (guarded by the status update above). Email failures never block fulfilment.
    await Promise.allSettled([
      notifyOwners(`New sale: ${productName}`, `${amount} from ${email ?? "a customer"}`, "/academy/owner/products"),
      audit({ actorId: userId, action: "order.paid", targetType: "order", targetId: order.id, metadata: { amount_minor: update.amountMinor, guest: !order.user_id } }),
      email
        ? emailPurchaseConfirmation({
            to: email,
            productName,
            amount,
            hasAccount: Boolean(userId),
            url: userId ? `${site}/academy/student/my-academy` : `${site}/academy/welcome?session_id=${encodeURIComponent(order.provider_reference ?? update.providerReference ?? "")}`,
          })
        : Promise.resolve(false),
      emailOwnersSale({ productName, amount, buyer: email ?? "A customer", url: `${site}/academy/owner/products` }),
    ]);
    return updated as OrderRecord;
  }

  if (update.status === "refunded" || update.status === "partially_refunded") {
    await db
      .from("orders")
      .update({ status: update.status, refunded_minor: update.refundedMinor ?? order.refunded_minor })
      .eq("id", order.id);
    if (update.status === "refunded") await db.rpc("revoke_order", { o: order.id });
    const newlyRefunded = (update.refundedMinor ?? 0) > order.refunded_minor;
    if (newlyRefunded && order.customer_email) {
      const { data: product } = await db.from("products").select("name").eq("id", order.product_id).maybeSingle();
      await emailRefund({
        to: order.customer_email,
        productName: product?.name ?? "your course",
        amount: money((update.refundedMinor ?? 0) - order.refunded_minor, order.currency),
        full: update.status === "refunded",
      }).catch(() => false);
    }
    await audit({ actorId: null, action: `order.${update.status}`, targetType: "order", targetId: order.id, metadata: { refunded_minor: update.refundedMinor } });
    return { ...order, status: update.status };
  }

  if ((update.status === "failed" || update.status === "cancelled") && order.status === "pending") {
    await db.from("orders").update({ status: update.status }).eq("id", order.id).eq("status", "pending");
    return { ...order, status: update.status };
  }
  return order;
}

/** Look a checkout up with the provider (server-to-server) and apply it. */
export async function syncCheckout(providerReference: string): Promise<{ lookup: CheckoutLookup; order: OrderRecord | null } | null> {
  const provider = getPaymentProvider();
  if (!provider) return null;
  const lookup = await provider.lookupCheckout(providerReference);
  const order = await applyPaymentUpdate(lookup, provider.id);
  return { lookup, order };
}

/** Attach + grant paid guest orders matching this user's confirmed email. */
export async function claimOrdersFor(userId: string): Promise<number> {
  const { data, error } = await createServiceClient().rpc("claim_orders_for", { uid: userId });
  if (error) console.error("[payments] claim failed:", error.message);
  return (data as number | null) ?? 0;
}
