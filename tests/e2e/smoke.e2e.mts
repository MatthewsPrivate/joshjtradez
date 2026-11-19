// Pre-push smoke test: sign-in, portals and two-factor still work. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((l: string) => /^[A-Z_]+=/.test(l)).map((l: string) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = "http://localhost:4398";
const tag = Date.now().toString(36);
const PW = "Test-" + tag + "-Passw0rd!";
const results: boolean[] = [];
const check = (n: string, ok: boolean, info = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${!ok && info ? "  -- " + info : ""}`); };

function totp(secretB32: string, at = Date.now()): string {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const ch of secretB32.replace(/=+$/, "")) bits += a.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b: string) => parseInt(b, 2)));
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(c).digest(); const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
class S {
  jar = new Map<string, string>();
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res: Response) { for (const c of res.headers.getSetCookie()) { const kv = c.split(";")[0]!; const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0/i.test(c) || v === "") this.jar.delete(k); else this.jar.set(k, v); } }
  async get(p: string) { const r = await fetch(BASE + p, { headers: { cookie: this.cookie() }, redirect: "manual" }); this.store(r); return { status: r.status, loc: r.headers.get("location") ?? "", text: await r.text() }; }
  async post(p: string, d: Record<string, string>) { const r = await fetch(BASE + p, { method: "POST", body: new URLSearchParams(d).toString(), headers: { cookie: this.cookie(), "content-type": "application/x-www-form-urlencoded", origin: BASE }, redirect: "manual" }); this.store(r); return { status: r.status, loc: r.headers.get("location") ?? "", text: await r.text() }; }
}
const users: string[] = [];
try {
  const mk = async (label: string) => {
    const email = `jt-${label}-${tag}@test.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { full_name: `Smoke ${label} ${tag}` } });
    if (error) throw error; users.push(data.user.id);
    const s = new S(); const r = await s.post("/api/academy/auth/login", { email, password: PW, next: "/academy" });
    return { id: data.user.id, email, s, loginLoc: r.loc };
  };
  const stu = await mk("student");
  check("student sign-in works", stu.loginLoc === "/academy" && stu.s.jar.size > 1, stu.loginLoc);
  for (const p of ["/academy/student", "/academy/student/my-academy", "/academy/student/trading-journal", "/academy/settings"]) {
    const r = await stu.s.get(p); check(`student ${p} → 200`, r.status === 200, `${r.status} ${r.loc}`);
  }
  let r = await stu.s.get("/academy/settings");
  check("settings shows two-factor section", r.text.includes("TWO-FACTOR"));
  r = await stu.s.get("/academy/student");
  check("no staff banner for students", !r.text.includes('class="mfa-banner"'));
  check("logo is wordmark only", !r.text.includes("logo-mark") && r.text.includes("JOSHJ"));

  const own = await mk("owner");
  await admin.from("user_roles").insert([{ user_id: own.id, role: "owner" }, { user_id: own.id, role: "teacher" }]);
  await new Promise((res) => setTimeout(res, 31_000)); // role cache TTL
  for (const p of ["/academy/owner", "/academy/owner/products", "/academy/owner/enquiries", "/academy/teacher", "/academy/teacher/students", "/academy/teacher/trade-reviews"]) {
    r = await own.s.get(p); check(`owner ${p} → 200`, r.status === 200, `${r.status} ${r.loc}`);
  }
  r = await own.s.get("/academy/owner");
  check("staff banner shown", r.text.includes('class="mfa-banner"'));

  r = await own.s.get("/academy/mfa/setup");
  const secret = /class="mfa-secret"[^>]*>([A-Z2-7]+)</.exec(r.text)?.[1];
  const factorId = /name="factor_id" value="([^"]+)"/.exec(r.text)?.[1];
  check("2FA setup page renders QR + key", !!secret && !!factorId, r.text.slice(0, 300));
  r = await own.s.post("/api/academy/mfa", { intent: "enable", factor_id: factorId!, code: totp(secret!) });
  check("2FA enable", r.loc.includes("mfa-enabled"), r.loc);
  const fresh = new S();
  r = await fresh.post("/api/academy/auth/login", { email: own.email, password: PW, next: "/academy/owner" });
  check("login with 2FA → code step", r.loc.startsWith("/academy/mfa"), r.loc);
  r = await fresh.get("/academy/owner");
  check("portal blocked before code", r.status === 302 && r.loc.startsWith("/academy/mfa"), `${r.status} ${r.loc}`);
  r = await fresh.get("/academy/mfa?next=/academy/owner");
  check("code page renders", r.status === 200 && r.text.includes("Enter your code"), String(r.status));
  await new Promise((res) => setTimeout(res, 31_000));
  r = await fresh.post("/api/academy/mfa", { intent: "verify", factor_id: factorId!, code: totp(secret!), next: "/academy/owner" });
  check("correct code → in", r.loc === "/academy/owner", r.loc);
  r = await fresh.get("/academy/owner");
  check("portal open after code", r.status === 200 && !r.text.includes('class="mfa-banner"'), String(r.status));
  r = await fresh.post("/api/academy/auth/logout", {});
  check("logout works", r.status === 303 || r.status === 302, String(r.status));
} catch (e) { check("script error", false, String(e instanceof Error ? e.stack : e)); }
finally {
  for (const u of users) { await admin.from("audit_log").delete().eq("actor_id", u); await admin.auth.admin.deleteUser(u); }
  console.log(`\ncleanup: ${users.length} users deleted\n${results.filter(Boolean).length}/${results.length} passed`);
}
