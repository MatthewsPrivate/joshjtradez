// Helpers for the HTML-form endpoints: read fields, then redirect back to the
// page that posted with a ?notice= / ?error= code (rendered by Flash.astro).
import type { APIContext } from "astro";
import { safeNext, withQuery } from "./http";

export type FlashCode = { notice: string } | { error: string };

export function backTo(form: FormData, fallback: string): string {
  return safeNext(form.get("_back"), fallback);
}

export function done(ctx: Pick<APIContext, "redirect">, to: string, flash?: FlashCode) {
  const clean = to.replace(/([?&])(notice|error)=[^&]*/g, "$1").replace(/[?&]+$/, "").replace(/\?&/, "?");
  return ctx.redirect(flash ? withQuery(clean, flash as Record<string, string>) : clean, 303);
}

export const str = (form: FormData, name: string, max = 10_000): string => {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

export const optStr = (form: FormData, name: string, max = 10_000): string | null => str(form, name, max) || null;

export const bool = (form: FormData, name: string): boolean => {
  const v = form.get(name);
  return v === "on" || v === "true" || v === "1";
};

export function int(form: FormData, name: string, min: number, max: number): number | null {
  const s = str(form, name);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
