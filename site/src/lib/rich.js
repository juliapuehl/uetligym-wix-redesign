// Rich text from the CMS. Pure helpers, used on the server and in the browser (no imports, no DOM).
// Only simple formatting survives; every other tag is dropped (its text is kept), attributes are removed,
// links keep a safe href. Content is entered by the site owner in the dashboard.
const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "h2", "h3", "h4", "blockquote"]);
/** @param {unknown} html @returns {string} */
export function safeRich(html) {
  let s = String(html || "");
  s = s.replace(/<(script|style|iframe|object|embed|template)[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  return s.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (_m, close, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return "";
    if (close) return `</${t}>`;
    if (t === "a") {
      const m = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = (m ? m[2] ?? m[3] ?? m[4] ?? "" : "").trim();
      if (href && /^(https?:|mailto:|tel:|[\w\-./?#=&%]+$)/i.test(href) && !/^\s*javascript:/i.test(href)) {
        const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${href.replace(/"/g, "&quot;")}"${ext}>`;
      }
      return "<a>";
    }
    return `<${t}>`;
  });
}
/** @param {unknown} html @returns {boolean} */
export function hasText(html) {
  return !!String(html || "").replace(/<[^>]*>/g, "").trim();
}
/** @param {unknown} href @returns {string} */
export function safeLink(href) {
  const h = String(href || "").trim();
  return /^\s*javascript:/i.test(h) ? "" : h;
}
