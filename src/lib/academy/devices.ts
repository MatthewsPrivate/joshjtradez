// "Known device" cookie for new-sign-in alerts. A browser that has signed in
// before carries a random id; signing in without it triggers an alert email.
// The id isn't tied to a user and grants nothing — it only suppresses alerts.
import type { AstroCookies } from "astro";

export const DEVICE_COOKIE = "jjt_device";
const MAX_AGE = 60 * 60 * 24 * 400; // browsers cap cookie lifetime at ~400 days

export const isKnownDevice = (cookies: AstroCookies) => /^[0-9a-f-]{36}$/.test(cookies.get(DEVICE_COOKIE)?.value ?? "");

export function rememberDevice(cookies: AstroCookies) {
  if (isKnownDevice(cookies)) return;
  cookies.set(DEVICE_COOKIE, crypto.randomUUID(), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: MAX_AGE,
  });
}
