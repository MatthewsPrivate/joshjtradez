// Minimal, safe Markdown → HTML for lesson bodies, journal notes and posts.
// All input is HTML-escaped FIRST, then a small set of patterns is turned into
// tags, so user content can never inject markup or scripts.
//
// Supported: # / ## / ### headings, **bold**, *italic*, `code`, [links](https://…),
// - bullet lists, 1. numbered lists, - [ ] / - [x] checklists, > quotes,
// ``` code blocks ```, --- rules, blank-line paragraphs.

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return null;
}

/** Inline formatting on an already-escaped line. */
function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
      // href was escaped already; unescape &amp; for the URL check only.
      const url = safeHref(href.replace(/&amp;/g, "&"));
      return url
        ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer"${url.startsWith("/") ? "" : ' target="_blank"'}>${text}</a>`
        : text;
    });
}

export function renderMarkdown(source: string | null | undefined): string {
  const lines = escapeHtml((source ?? "").replace(/\r\n?/g, "\n")).split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[]; checklist: boolean } | null = null;
  let code: string[] | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}${list.checklist ? ' class="checklist"' : ""}>${list.items.join("")}</${list.tag}>`);
    list = null;
  };

  for (const line of lines) {
    if (code) {
      if (line.trim().startsWith("```")) {
        out.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushPara();
      flushList();
      code = [];
      continue;
    }
    const t = line.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    const heading = t.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1]!.length + 1; // # → h2 (the page owns h1)
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) {
      flushPara();
      flushList();
      out.push("<hr>");
      continue;
    }
    if (t.startsWith("&gt;")) {
      flushPara();
      flushList();
      out.push(`<blockquote>${inline(t.replace(/^&gt;\s?/, ""))}</blockquote>`);
      continue;
    }
    const check = t.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = t.match(/^[-*]\s+(.*)$/);
    const numbered = t.match(/^\d+[.)]\s+(.*)$/);
    if (check || bullet || numbered) {
      flushPara();
      const tag = numbered ? "ol" : "ul";
      const isCheck = Boolean(check);
      if (!list || list.tag !== tag || list.checklist !== isCheck) {
        flushList();
        list = { tag, items: [], checklist: isCheck };
      }
      const item = check
        ? `<li><span class="check${check[1]!.trim() ? " done" : ""}" aria-hidden="true"></span>${inline(check[2]!)}</li>`
        : `<li>${inline((numbered ?? bullet)![1]!)}</li>`;
      list.items.push(item);
      continue;
    }
    flushList();
    para.push(t);
  }
  if (code) out.push(`<pre><code>${code.join("\n")}</code></pre>`);
  flushPara();
  flushList();
  return out.join("\n");
}

/** Plain-text excerpt for previews and notifications. */
export function markdownExcerpt(source: string | null | undefined, max = 160): string {
  const text = (source ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`_-]|\[(.*?)\]\(.*?\)/g, (_m, t) => t ?? " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
