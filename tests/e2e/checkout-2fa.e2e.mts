// End-to-end test of guest checkout, webhook fulfilment, account claim and refunds
// against a local mock of Stripe's API. Cleans up everything it creates.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash, createHmac } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret. */
function totp(secretB32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretB32.replace(/=+$/, "")) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l: string) => /^[A-Z_]+=/.test(l))
    .map((l: string) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = "http://localhost:4398";
const WHSEC = env.STRIPE_WEBHOOK_SECRET;
const tag = Date.now().toString(36);
const PW = "Test-" + tag + "-Passw0rd!";
const results: boolean[] = [];
const check = (name: string, ok: boolean, info = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && info ? "  -- " + info : ""}`);
};

// ---- Mock Stripe -----------------------------------------------------------
type Sess = { id: string; metadata: { order_id: string }; customer_email?: string; amount_total: number; currency: string; payment_status: string; status: string; payment_intent: string; customer_details?: { email: string } };
const sessions = new Map<string, Sess>();
let n = 0;
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.headers.authorization !== `Bearer ${env.STRIPE_SECRET_KEY}`) { res.writeHead(401); return res.end("{}"); }
    if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
      const p = new URLSearchParams(body);
      const id = `cs_test_${tag}_${++n}`;
      const s: Sess = { id, metadata: { order_id: p.get("metadata[order_id]")! }, customer_email: p.get("customer_email") ?? undefined, amount_total: Number(p.get("line_items[0][price_data][unit_amount]")), currency: p.get("line_items[0][price_data][currency]")!, payment_status: "unpaid", status: "open", payment_intent: `pi_${tag}_${n}` };
      sessions.set(id, s);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ...s, url: `https://checkout.stripe.test/${id}`, success_url: p.get("success_url") }));
    }
    const m = /^\/v1\/checkout\/sessions\/(cs_[\w]+)$/.exec(req.url ?? "");
    if (req.method === "GET" && m && sessions.has(m[1]!)) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(sessions.get(m[1]!)));
    }
    res.writeHead(404); res.end("{}");
  });
});
await new Promise<void>((r) => mock.listen(4499, r));

const pay = (id: string, email: string) => {
  const s = sessions.get(id)!;
  s.payment_status = "paid"; s.status = "complete"; s.customer_details = { email };
  return s;
};
async function webhook(type: string, object: unknown, opts: { badSig?: boolean; id?: string } = {}) {
  const payload = JSON.stringify({ id: opts.id ?? `evt_${tag}_${Math.random().toString(36).slice(2)}`, type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", opts.badSig ? "whsec_wrong" : WHSEC).update(`${t}.${payload}`).digest("hex");
  const res = await fetch(`${BASE}/api/academy/payments/webhook/stripe`, { method: "POST", body: payload, headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` } });
  return { status: res.status, text: await res.text() };
}

class Session {
  jar = new Map<string, string>();
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0]!; const i = kv.indexOf("=");
      const k = kv.slice(0, i); const v = kv.slice(i + 1);
      if (/max-age=0/i.test(c) || v === "") this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async get(path: string) {
    const res = await fetch(BASE + path, { headers: { cookie: this.cookie() }, redirect: "manual" });
    this.store(res); return { status: res.status, loc: res.headers.get("location") ?? "", text: await res.text() };
  }
  async post(path: string, data: Record<string, string | string[]>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, x));
    const res = await fetch(BASE + path, { method: "POST", body: p.toString(), headers: { cookie: this.cookie(), "content-type": "application/x-www-form-urlencoded", origin: BASE }, redirect: "manual" });
    this.store(res); return { status: res.status, loc: res.headers.get("location") ?? "", text: await res.text() };
  }
}

const users: string[] = [];
const courseIds: string[] = [];
let productId: string | null = null;
async function mkUser(label: string, name: string, login = true) {
  const email = `jt-${label}-${tag}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  users.push(data.user.id);
  const s = new Session();
  if (login) await s.post("/api/academy/auth/login", { email, password: PW, next: "/academy" });
  return { id: data.user.id, email, s };
}
const sessionIdFrom = (loc: string) => /checkout\.stripe\.test\/(cs_\w+)/.exec(loc)?.[1];

try {
  const owner = await mkUser("owner", "Test Owner " + tag);
  await admin.from("user_roles").insert([{ user_id: owner.id, role: "owner" }, { user_id: owner.id, role: "teacher" }]);
  const { data: course, error: cErr } = await admin.from("courses").insert({ title: "Pay Test " + tag, slug: "pay-test-" + tag, status: "published" }).select("id, slug").single();
  if (cErr) throw cErr;
  courseIds.push(course!.id);

  // Products page + product creation
  let r = await owner.s.get("/academy/owner/products");
  check("owner products page loads, Stripe test mode shown", r.status === 200 && r.text.includes("TEST MODE"), String(r.status));
  r = await owner.s.post("/api/academy/products", { intent: "create", name: "Pay Product " + tag, price: "abc", currency: "GBP", course_ids: course!.id, active: "on", _back: "/academy/owner/products" });
  check("rejects invalid price", r.loc.includes("error=bad-price"), r.loc);
  r = await owner.s.post("/api/academy/products", { intent: "create", name: "Pay Product " + tag, price: "297.50", currency: "GBP", course_ids: course!.id, active: "on", _back: "/academy/owner/products" });
  const { data: prod } = await admin.from("products").select("id, price_minor").eq("name", "Pay Product " + tag).single();
  productId = prod?.id ?? null;
  check("create product £297.50 linked to course", r.loc.includes("notice=created") && prod?.price_minor === 29750, r.loc);

  // ---- 1. Guest buyer, brand-new email ----
  const guest = new Session();
  r = await guest.post("/api/academy/checkout", { product_id: productId!, _back: "/" });
  const cs1 = sessionIdFrom(r.loc);
  check("guest checkout redirects to Stripe", r.status === 303 && !!cs1, `${r.status} ${r.loc}`);
  const s1 = sessions.get(cs1!)!;
  check("Stripe session has correct amount/currency/order", s1.amount_total === 29750 && s1.currency === "gbp" && !!s1.metadata.order_id);
  const { data: o1 } = await admin.from("orders").select("status, user_id, provider_reference").eq("id", s1.metadata.order_id).single();
  check("pending guest order recorded", o1?.status === "pending" && o1.user_id === null && o1.provider_reference === cs1, JSON.stringify(o1));

  r = await guest.get(`/academy/welcome?session_id=${cs1}`);
  check("welcome before payment shows 'Confirming'", r.text.includes("Confirming your payment"));

  const buyerEmail = `jt-buyer-${tag}@test.invalid`;
  const w = await webhook("checkout.session.completed", pay(cs1!, buyerEmail), { badSig: true });
  check("webhook with bad signature rejected", w.status === 400, String(w.status));
  const evtId = `evt_${tag}_paid1`;
  let wh = await webhook("checkout.session.completed", sessions.get(cs1!), { id: evtId });
  check("signed webhook accepted", wh.status === 200 && wh.text === "ok", `${wh.status} ${wh.text}`);
  wh = await webhook("checkout.session.completed", sessions.get(cs1!), { id: evtId });
  check("duplicate webhook is a no-op", wh.status === 200 && wh.text === "already processed", wh.text);
  const { data: o1b } = await admin.from("orders").select("status, customer_email, payment_reference, user_id").eq("id", s1.metadata.order_id).single();
  check("order paid with buyer email, no account yet", o1b?.status === "paid" && o1b.customer_email === buyerEmail && o1b.user_id === null && o1b.payment_reference === s1.payment_intent, JSON.stringify(o1b));

  r = await guest.get(`/academy/welcome?session_id=${cs1}`);
  check("welcome shows code + password form for buyer email", r.text.includes("PAYMENT CONFIRMED") && r.text.includes(buyerEmail) && r.text.includes('name="code"'));
  const orderId1 = s1.metadata.order_id;
  const { count: codesIssued } = await admin.from("email_codes").select("id", { count: "exact", head: true }).eq("order_id", orderId1);
  check("a code was issued automatically on first visit", codesIssued === 1, String(codesIssued));
  await guest.get(`/academy/welcome?session_id=${cs1}`);
  const { count: codesAfterRefresh } = await admin.from("email_codes").select("id", { count: "exact", head: true }).eq("order_id", orderId1);
  check("refreshing doesn't send another code", codesAfterRefresh === 1, String(codesAfterRefresh));
  r = await guest.post("/api/academy/checkout/send-code", { session_id: cs1! });
  check("resend is rate-limited (1/minute)", r.loc.includes("code-cooldown"), r.loc);

  // The real code went to an inbox we don't have; plant a known one (same hashing as the server).
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const plant = async (code: string) => {
    await admin.from("email_codes").update({ consumed_at: new Date().toISOString() }).eq("order_id", orderId1).is("consumed_at", null);
    await admin.from("email_codes").insert({ purpose: "purchase_claim", order_id: orderId1, email: buyerEmail, code_hash: sha(`${orderId1}:${code}:${env.SUPABASE_SERVICE_ROLE_KEY}`), expires_at: new Date(Date.now() + 6e5).toISOString() });
  };
  await plant("482913");
  r = await guest.post("/api/academy/checkout/claim", { session_id: cs1!, code: "000000", full_name: "Guest Buyer " + tag, password: PW, confirm: PW });
  check("wrong email code rejected", r.loc.includes("code-wrong"), r.loc);
  r = await guest.post("/api/academy/checkout/claim", { session_id: cs1!, code: "482913", full_name: "Guest Buyer " + tag, password: "short", confirm: "short" });
  check("weak password rejected", r.loc.includes("error=weak"), r.loc);
  for (let i = 0; i < 5; i++) r = await guest.post("/api/academy/checkout/claim", { session_id: cs1!, code: "111111", full_name: "G", password: PW, confirm: PW });
  check("5 wrong codes lock the code", r.loc.includes("code-locked"), r.loc);
  r = await guest.post("/api/academy/checkout/claim", { session_id: cs1!, code: "482913", full_name: "G", password: PW, confirm: PW });
  check("even the right code fails once locked", r.loc.includes("code-locked"), r.loc);
  await plant("731045");
  r = await guest.post("/api/academy/checkout/claim", { session_id: cs1!, code: "731 045", full_name: "Guest Buyer " + tag, password: PW, confirm: PW });
  check("device cookie set for the buyer's browser", guest.jar.has("jjt_device"));
  check("claim creates account and lands in course", r.loc.includes(`/academy/student/courses/${course!.slug}`) && r.loc.includes("purchase-complete"), r.loc);
  const newUid = (await admin.rpc("user_id_by_email", { e: buyerEmail })).data as string | null;
  if (newUid) users.push(newUid);
  const { data: en1 } = await admin.from("enrolments").select("status, source").eq("user_id", newUid!).eq("course_id", course!.id).maybeSingle();
  check("new account enrolled via purchase", en1?.status === "active" && en1.source === "purchase", JSON.stringify(en1));
  r = await guest.get(`/academy/student/courses/${course!.slug}?notice=purchase-complete`);
  check("buyer is signed in and sees course unlocked", r.status === 200 && r.text.includes("Payment confirmed") && !r.text.includes("Enrol now"), String(r.status));

  const attacker = new Session();
  r = await attacker.post("/api/academy/checkout/claim", { session_id: cs1!, full_name: "X", password: "Another-Passw0rd!", confirm: "Another-Passw0rd!" });
  check("same checkout can't create/overwrite an account twice", r.loc.includes("account-exists"), r.loc);

  // ---- 2. Guest pays with an email that already has an account (no takeover) ----
  const existing = await mkUser("existing", "Existing Student " + tag, false);
  r = await new Session().post("/api/academy/checkout", { product_id: productId!, _back: "/" });
  const cs2 = sessionIdFrom(r.loc)!;
  await webhook("checkout.session.completed", pay(cs2, existing.email.toUpperCase()));
  const { data: en2 } = await admin.from("enrolments").select("status").eq("user_id", existing.id).eq("course_id", course!.id).maybeSingle();
  check("existing account gets the course (email match, case-insensitive)", en2?.status === "active", JSON.stringify(en2));
  r = await new Session().get(`/academy/welcome?session_id=${cs2}`);
  check("welcome tells existing user to sign in (no password form)", r.text.includes("is unlocked") && !r.text.includes('name="password"'));
  r = await new Session().post("/api/academy/checkout/claim", { session_id: cs2, full_name: "Hijack", password: "Hijack-Passw0rd!", confirm: "Hijack-Passw0rd!" });
  const anon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: oldPwErr } = await anon.auth.signInWithPassword({ email: existing.email, password: PW });
  check("claim can't take over existing account (password unchanged)", r.loc.includes("account-exists") && !oldPwErr, r.loc + " " + oldPwErr?.message);

  // ---- 3. Signed-in student buys; welcome page alone fulfils (webhook delayed) ----
  const stu = await mkUser("student", "Signed In " + tag);
  r = await stu.s.post("/api/academy/checkout", { product_id: productId!, _back: `/academy/student/courses/${course!.slug}` });
  const cs3 = sessionIdFrom(r.loc)!;
  check("signed-in checkout prefills email", sessions.get(cs3)?.customer_email === stu.email);
  pay(cs3, stu.email);
  r = await stu.s.get(`/academy/welcome?session_id=${cs3}`);
  check("welcome (server-side lookup) unlocks and redirects signed-in buyer", r.status === 302 && r.loc.includes(`/courses/${course!.slug}`), `${r.status} ${r.loc}`);
  wh = await webhook("checkout.session.completed", sessions.get(cs3));
  const { count: paidCount } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("provider_reference", cs3).eq("status", "paid");
  check("late webhook after welcome doesn't double-process", wh.status === 200 && paidCount === 1);
  r = await stu.s.post("/api/academy/checkout", { product_id: productId!, _back: "/" });
  check("already-enrolled student isn't charged again", r.loc.includes("already-enrolled"), r.loc);

  // ---- 4. Refund removes access ----
  wh = await webhook("charge.refunded", { id: "ch_" + tag, payment_intent: sessions.get(cs3)!.payment_intent, amount: 29750, amount_refunded: 29750, metadata: {} });
  const { data: en3 } = await admin.from("enrolments").select("status").eq("user_id", stu.id).eq("course_id", course!.id).maybeSingle();
  const { data: o3 } = await admin.from("orders").select("status, refunded_minor").eq("provider_reference", cs3).single();
  check("full refund → order refunded + access revoked", wh.status === 200 && o3?.status === "refunded" && o3.refunded_minor === 29750 && en3?.status === "revoked", JSON.stringify({ o3, en3 }));

  // ---- 5. Guest skips welcome page, later signs up with same email ----
  r = await new Session().post("/api/academy/checkout", { product_id: productId!, _back: "/" });
  const cs4 = sessionIdFrom(r.loc)!;
  const laterEmail = `jt-later-${tag}@test.invalid`;
  await webhook("checkout.session.completed", pay(cs4, laterEmail));
  const { data: later } = await admin.auth.admin.createUser({ email: laterEmail, password: PW, email_confirm: true });
  users.push(later.user!.id);
  const { data: claimed } = await admin.rpc("claim_orders_for", { uid: later.user!.id });
  const { data: en4 } = await admin.from("enrolments").select("status").eq("user_id", later.user!.id).eq("course_id", course!.id).maybeSingle();
  check("later sign-up claims the guest purchase", claimed === 1 && en4?.status === "active", JSON.stringify({ claimed, en4 }));

  // ---- Security ----
  const { error: rpcErr } = await anon.rpc("grant_order", { o: s1.metadata.order_id });
  check("students can't call fulfilment functions", !!rpcErr);
  r = await stu.s.get("/academy/owner/products");
  check("student can't open Products page", r.status !== 200, String(r.status));
  r = await new Session().get("/academy/welcome?session_id=cs_test_doesnotexist");
  check("unknown checkout shows not-found message", r.text.includes("couldn&#39;t check") || r.text.includes("couldn't check") || r.text.includes("Payment not completed"));
  r = await new Session().post("/api/academy/checkout", { product_id: "00000000-0000-0000-0000-000000000000", _back: "/" });
  check("unknown product rejected", r.loc.includes("error=product-unavailable"), r.loc);
  r = await owner.s.get("/academy/owner/products");
  check("products page lists sales", r.text.includes(buyerEmail) && r.text.includes("refunded"));

  // ---- Two-factor for staff ----
  r = await owner.s.get("/academy/owner");
  check("staff without 2FA see the setup banner", r.text.includes("mfa-banner"));
  r = await owner.s.get("/academy/mfa/setup");
  const secret = /class="mfa-secret"[^>]*>([A-Z2-7]+)</.exec(r.text)?.[1];
  const factorId = /name="factor_id" value="([^"]+)"/.exec(r.text)?.[1];
  check("setup page shows QR + secret", !!secret && !!factorId && r.text.includes("<img"), r.text.slice(0, 200));
  r = await owner.s.post("/api/academy/mfa", { intent: "enable", factor_id: factorId!, code: "000000" });
  check("wrong authenticator code rejected", r.loc.includes("mfa-wrong"), r.loc);
  r = await owner.s.post("/api/academy/mfa", { intent: "enable", factor_id: factorId!, code: totp(secret!) });
  check("2FA enabled with a valid code", r.loc.includes("mfa-enabled"), r.loc);
  r = await owner.s.get("/academy/owner");
  check("banner gone once 2FA is on", r.status === 200 && !r.text.includes("mfa-banner"), String(r.status));

  const fresh = new Session();
  r = await fresh.post("/api/academy/auth/login", { email: owner.email, password: PW, next: "/academy/owner" });
  check("password-only sign-in is sent to the code step", r.loc.startsWith("/academy/mfa"), r.loc);
  check("new-device sign-in sets the device cookie", fresh.jar.has("jjt_device"));
  r = await fresh.get("/academy/owner");
  check("portal blocked until code entered", r.status === 302 && r.loc.startsWith("/academy/mfa"), `${r.status} ${r.loc}`);
  r = await fresh.post("/api/academy/products", { intent: "delete", id: productId!, _back: "/academy/owner/products" });
  check("staff APIs blocked until code entered", r.status === 401, String(r.status));
  r = await fresh.post("/api/academy/mfa", { intent: "verify", factor_id: factorId!, code: "123456", next: "/academy/owner" });
  check("wrong sign-in code rejected", r.loc.includes("mfa-wrong"), r.loc);
  await new Promise((res) => setTimeout(res, 31_000)); // TOTP codes are single-use per 30s window
  r = await fresh.post("/api/academy/mfa", { intent: "verify", factor_id: factorId!, code: totp(secret!), next: "/academy/owner" });
  check("correct sign-in code lets them in", r.loc === "/academy/owner", r.loc);
  r = await fresh.get("/academy/owner");
  check("portal opens after 2FA", r.status === 200, String(r.status));
  r = await fresh.post("/api/academy/mfa", { intent: "disable", factor_id: factorId! });
  check("2FA can be turned off from a verified session", r.loc.includes("mfa-disabled"), r.loc);
} catch (e) {
  check("script error", false, String(e instanceof Error ? e.stack : e));
} finally {
  const { data: ords } = await admin.from("orders").select("id").in("product_id", productId ? [productId] : ["00000000-0000-0000-0000-000000000000"]);
  const orderIds = (ords ?? []).map((o) => o.id as string);
  if (orderIds.length) {
    await admin.from("payment_events").delete().in("order_id", orderIds);
    await admin.from("enrolments").delete().in("order_id", orderIds);
    await admin.from("audit_log").delete().in("target_id", orderIds);
    await admin.from("orders").delete().in("id", orderIds);
  }
  await admin.from("payment_events").delete().like("provider_event_id", `evt_${tag}%`);
  await admin.from("notifications").delete().eq("kind", "sale").like("body", `%${tag}%`);
  if (productId) { await admin.from("audit_log").delete().eq("target_id", productId); await admin.from("products").delete().eq("id", productId); }
  for (const c of courseIds) await admin.from("courses").delete().eq("id", c);
  for (const u of users) { await admin.from("audit_log").delete().eq("actor_id", u); await admin.auth.admin.deleteUser(u); }
  const { count: leftOrders } = await admin.from("orders").select("id", { count: "exact", head: true }).like("customer_email", `%${tag}%`);
  const { count: leftNotes } = await admin.from("notifications").select("id", { count: "exact", head: true }).like("body", `%${tag}%`);
  console.log(`\ncleanup: ${users.length} users deleted, leftover orders=${leftOrders}, leftover sale notifications=${leftNotes}`);
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
  mock.close();
}
