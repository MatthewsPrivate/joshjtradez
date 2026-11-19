// Start a purchase. Works for guests (main website "Buy" buttons) and for
// signed-in students. Creates a pending order and sends the buyer to Stripe's
// hosted checkout page.
import type { APIRoute } from "astro";
import { isUuid, str } from "../../../../lib/academy/forms";
import { withQuery } from "../../../../lib/academy/http";
import { CheckoutError, startCheckout } from "../../../../lib/academy/payments/fulfil";

export const prerender = false;

/** Same-site path to return to if the buyer cancels (main site or academy). */
function returnPath(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && v.length < 300 ? v : "/";
}

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData().catch(() => null);
  const productId = form ? str(form, "product_id") : "";
  const back = returnPath(form ? str(form, "_back") : "/");
  if (!isUuid(productId)) return ctx.redirect(withQuery(back, { error: "invalid" }), 303);

  const user = ctx.locals.user;
  try {
    const { redirectUrl } = await startCheckout({
      productId,
      user: user ? { id: user.id, email: user.email } : null,
      origin: ctx.url.origin,
      cancelPath: withQuery(back, { notice: "checkout-cancelled" }),
    });
    return ctx.redirect(redirectUrl, 303);
  } catch (err) {
    const code = err instanceof CheckoutError ? err.code : "checkout-failed";
    if (code === "already-enrolled") return ctx.redirect("/academy/student/my-academy?notice=already-enrolled", 303);
    return ctx.redirect(withQuery(back, { error: code }), 303);
  }
};
