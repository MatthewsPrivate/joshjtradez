// Provider-agnostic payment contract. Each third-party provider (Stripe, Whop,
// PayPal, …) gets one adapter implementing this interface; nothing else in the
// codebase talks to a provider directly.
//
// Rules every adapter and caller must follow:
//   * A course is unlocked ONLY from provider data fetched or verified
//     server-side — a webhook whose signature verifyWebhook() accepted, or a
//     lookupCheckout() call made by this server — never from a checkout
//     redirect or anything the browser says.
//   * Webhook events are recorded in payment_events keyed by (provider, eventId);
//     the unique constraint makes duplicate deliveries a no-op.
//   * No card data ever touches this server — checkout happens on the provider's
//     hosted page.

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface CheckoutRequest {
  orderId: string;
  /** Null for guest checkout: the account is created after payment. */
  userId: string | null;
  /** Prefills the provider's email field when known. */
  email: string | null;
  productName: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Hosted checkout page to redirect the customer to. */
  redirectUrl: string;
  /** Provider's reference for this payment, stored on the order. */
  providerReference: string;
}

/** A webhook event after signature verification, normalised to our vocabulary. */
export interface VerifiedPaymentEvent {
  /** Provider's unique event id — the idempotency key. */
  eventId: string;
  type: string;
  orderId: string | null;
  providerReference: string | null;
  status: PaymentStatus | null;
  amountMinor: number | null;
  refundedMinor: number | null;
  /** Buyer's email as entered on the provider's page (not verified by them). */
  customerEmail?: string | null;
  /** Provider's payment id (e.g. Stripe PaymentIntent) — refund events reference this. */
  paymentReference?: string | null;
  currency?: string | null;
  raw: unknown;
}

/** Server-to-server view of one checkout, used by the welcome page. */
export type CheckoutLookup = Omit<VerifiedPaymentEvent, "eventId" | "type" | "raw">;

export interface RefundRequest {
  providerReference: string;
  amountMinor: number;
  reason?: string;
}

export interface PaymentProvider {
  /** Stable identifier stored on orders.provider, e.g. "stripe". */
  readonly id: string;
  readonly supportsRefunds: boolean;

  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;

  /**
   * Verify authenticity (signature/secret) of a webhook request and normalise it.
   * Must throw if verification fails. Receives the raw body because most
   * providers sign the exact bytes.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent>;

  /** Server-to-server lookup of a checkout by its provider reference. */
  lookupCheckout(providerReference: string): Promise<CheckoutLookup>;

  refund?(req: RefundRequest): Promise<{ refundReference: string }>;
}
