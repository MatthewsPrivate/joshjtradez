import type { APIRoute } from "astro";
import { audit } from "../../../../lib/academy/audit";
import { clientIp, withQuery } from "../../../../lib/academy/http";

export const prerender = false;

// Link or unlink a Discord identity on the signed-in account.
// Requires "Manual linking" enabled and the Discord provider configured in Supabase Auth.
export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const intent = (await request.formData()).get("intent");
  const settings = "/academy/settings";

  if (intent === "link") {
    const { data, error } = await locals.supabase.auth.linkIdentity({
      provider: "discord",
      options: {
        redirectTo: `${url.origin}/academy/auth/callback?next=${encodeURIComponent(`${settings}?notice=discord-linked`)}`,
        scopes: "identify",
      },
    });
    if (error || !data.url) return redirect(withQuery(settings, { error: "discord-link" }), 303);
    return redirect(data.url, 303);
  }

  if (intent === "unlink") {
    const { data } = await locals.supabase.auth.getUserIdentities();
    const discord = data?.identities.find((i) => i.provider === "discord");
    if (!discord) return redirect(settings, 303);
    const { error } = await locals.supabase.auth.unlinkIdentity(discord);
    if (error) return redirect(withQuery(settings, { error: "discord-unlink" }), 303);
    await audit({ actorId: locals.user!.id, action: "auth.discord_unlinked", ip: clientIp(request) });
    return redirect(withQuery(settings, { notice: "discord-unlinked" }), 303);
  }

  return new Response("Bad request", { status: 400 });
};
