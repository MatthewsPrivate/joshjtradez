/** Only allow same-site academy paths as post-auth destinations (no open redirects). */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/academy"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/academy") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export const MIN_PASSWORD_LENGTH = 10;

export function withQuery(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

export function clientIp(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}
