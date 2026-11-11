// Turns a YouTube or Vimeo link into a safe embed URL. Anything else is not
// embedded (shown as an external link instead).

export function embedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : null);

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    const ok = id(v);
    return ok ? `https://www.youtube-nocookie.com/embed/${ok}?rel=0&modestbranding=1` : null;
  }
  if (host === "youtu.be") {
    const ok = id(url.pathname.slice(1));
    return ok ? `https://www.youtube-nocookie.com/embed/${ok}?rel=0&modestbranding=1` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([0-9a-f]{6,20}))?/);
    if (!m) return null;
    const hash = m[2] ?? url.searchParams.get("h");
    return `https://player.vimeo.com/video/${m[1]}${hash && /^[0-9a-f]+$/.test(hash) ? `?h=${hash}` : ""}`;
  }
  return null;
}

/** "12:05" / "1:02:03" → seconds; plain number = minutes. Returns null if blank/invalid. */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 60);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0) || parts.length > 3) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTotal(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
