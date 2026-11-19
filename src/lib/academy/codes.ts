// One-time email codes for confirming a buyer owns the email they paid with.
// Stored as a peppered SHA-256 hash; 10-minute expiry; 5 attempts; single use;
// resend limited to once a minute and 5 per order.
import { createServiceClient } from "./supabase";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_ORDER = 5;

async function hash(orderId: string, code: string): Promise<string> {
  // The service key is server-only, so a leaked hash can't be brute-forced offline without it.
  const data = new TextEncoder().encode(`${orderId}:${code}:${import.meta.env.SUPABASE_SERVICE_ROLE_KEY}`);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

export type IssueResult = { ok: true; code: string } | { ok: false; reason: "cooldown" | "limit" | "failed" };

export async function issueClaimCode(orderId: string, email: string): Promise<IssueResult> {
  const db = createServiceClient();
  const { data: recent } = await db.from("email_codes").select("created_at").eq("order_id", orderId).eq("purpose", "purchase_claim").order("created_at", { ascending: false }).limit(MAX_CODES_PER_ORDER);
  if ((recent ?? []).length >= MAX_CODES_PER_ORDER) return { ok: false, reason: "limit" };
  if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) return { ok: false, reason: "cooldown" };

  const code = sixDigits();
  // Only the newest code is valid.
  await db.from("email_codes").update({ consumed_at: new Date().toISOString() }).eq("order_id", orderId).is("consumed_at", null);
  const { error } = await db.from("email_codes").insert({
    purpose: "purchase_claim",
    order_id: orderId,
    email,
    code_hash: await hash(orderId, code),
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) {
    console.error("[codes] insert failed:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, code };
}

/** Is there an unexpired, unused code for this order (i.e. one was already sent)? */
export async function hasActiveClaimCode(orderId: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from("email_codes")
    .select("id")
    .eq("order_id", orderId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  return Boolean(data?.length);
}

export type VerifyResult = "ok" | "wrong" | "expired" | "locked";

export async function verifyClaimCode(orderId: string, code: string): Promise<VerifyResult> {
  const db = createServiceClient();
  const { data: row } = await db
    .from("email_codes")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("order_id", orderId)
    .eq("purpose", "purchase_claim")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "locked";

  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6 || (await hash(orderId, clean)) !== row.code_hash) {
    await db.from("email_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return row.attempts + 1 >= MAX_ATTEMPTS ? "locked" : "wrong";
  }
  // Single use — the conditional update makes concurrent submissions safe.
  const { data: used } = await db.from("email_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null).select("id").maybeSingle();
  return used ? "ok" : "expired";
}
