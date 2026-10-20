// Server-side Wix data layer. Same REST calls as public/assets/site.js, but with a visitor
// token cached in memory on the server, so pages are rendered with their CMS content (good for SEO).
import config from "../../wix.config.json";
import { imgSrc } from "./media.js";

export const WIX_CLIENT_ID: string = (import.meta.env.PUBLIC_WIX_CLIENT_ID as string) || (config as { appId: string }).appId;
const API = "https://www.wixapis.com";

let cached: { token: string; expiresAt: number } | null = null;

async function visitorToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const res = await fetch(API + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: WIX_CLIENT_ID, grantType: "anonymous" }),
  });
  if (!res.ok) throw new Error("Wix auth failed (" + res.status + ")");
  const d = await res.json();
  cached = { token: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 };
  return cached.token;
}

export class WixError extends Error {
  status = 0;
  code?: string;
}

export async function wixRequest<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string | string[]> } = {}): Promise<T> {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(opts.query || {})) for (const x of ([] as string[]).concat(v)) url.searchParams.append(k, x);
  const res = await fetch(url, {
    method: opts.method || "POST",
    headers: { Authorization: await visitorToken(), "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) {
    const err = new WixError(`${opts.method || "POST"} ${url.pathname} failed (${res.status})`);
    err.status = res.status;
    try { const j = await res.json(); err.code = j?.details?.applicationError?.code; } catch { /* no body */ }
    throw err;
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// ---------- Media ----------
export { imgSrc };

export type HeroMedia = { kind: "image"; src: string; title: string } | { kind: "video"; id: string; poster: string; title: string };

// First entry of a MEDIA_GALLERY / image / video field → image or video.
export function mediaOf(list: any): HeroMedia | null {
  const entry = Array.isArray(list) ? list[0] : list;
  if (!entry) return null;
  const src: string = typeof entry === "string" ? entry : entry.src || entry.url || entry.uri || "";
  const type = typeof entry === "object" && entry.type ? String(entry.type).toLowerCase() : "";
  if (!src) return null;
  if (src.startsWith("wix:video://") || type === "video" || /video\.wixstatic\.com\/video\//.test(src)) {
    const m = src.match(/(?:wix:video:\/\/v1\/|\/video\/)([^/#?]+)/);
    if (!m) return null;
    const poster = (src.match(/[#&]posterUri=([^&]+)/) || [])[1] || m[1] + "f000.jpg";
    return { kind: "video", id: m[1], poster: "https://static.wixstatic.com/media/" + decodeURIComponent(poster), title: entry.title || "" };
  }
  return { kind: "image", src, title: (entry && entry.title) || "" };
}

export function videoSources(id: string, desktop: boolean): string[] {
  const base = "https://video.wixstatic.com/video/" + id;
  return [...(desktop ? ["1080p", "720p", "480p"] : ["720p", "480p", "360p"]).map((r) => `${base}/${r}/mp4/file.mp4`), base + "/file"];
}

// ---------- CMS ----------
export async function queryCollection(collectionId: string, query: Record<string, unknown> = {}): Promise<any[]> {
  const res = await wixRequest<any>("/wix-data/v2/items/query", {
    body: { dataCollectionId: collectionId, query: { paging: { limit: 100, offset: 0 }, ...query } },
  });
  return ((res && res.dataItems) || []).map((d: any) => d.data || {});
}
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch (e) { console.error(e); return fallback; }
}

// ---------- Events ----------
export type EventCard = { slug: string; title: string; imageUrl: string; date: string };

export async function fetchUpcomingEvents(limit = 20): Promise<EventCard[]> {
  const res = await wixRequest<any>("/events/v3/events/query", {
    body: {
      query: {
        filter: { status: { $in: ["UPCOMING", "STARTED"] } },
        sort: [{ fieldName: "dateAndTimeSettings.startDate", order: "ASC" }, { fieldName: "createdDate", order: "DESC" }],
        paging: { limit, offset: 0 },
      },
      fields: ["DETAILS", "REGISTRATION", "CATEGORIES"],
    },
  });
  return ((res && res.events) || []).map((e: any) => {
    const dts = e.dateAndTimeSettings || {};
    const m = e.mainImage;
    return {
      slug: e.slug || "",
      title: e.title || "",
      imageUrl: imgSrc(m && typeof m === "object" && m.id ? m.id : m, 520, 360),
      date: shortEventDate(dts.startDate || "", dts.timeZoneId || "Europe/Zurich", dts.dateAndTimeTbd === true, dts.dateAndTimeTbdMessage || ""),
    };
  });
}

// "26. Okt" this year, "Aug 2027" for another year (as in the design).
function shortEventDate(iso: string, tz: string, tbd: boolean, tbdMessage: string): string {
  if (tbd || !iso) return tbdMessage || "Datum folgt";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const year = (x: Date) => new Intl.DateTimeFormat("de-CH", { year: "numeric", timeZone: tz }).format(x);
  const s = year(d) === year(new Date())
    ? new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "short", timeZone: tz }).format(d)
    : new Intl.DateTimeFormat("de-CH", { month: "short", year: "numeric", timeZone: tz }).format(d);
  return s.replace(/([A-Za-zÄÖÜäöü])\./g, "$1").replace(/\s+/g, " ").trim();
}

// ---------- Blog ----------
export type PostCard = { slug: string; title: string; excerpt: string; date: string; cover: string; thumb: string };

function postCover(p: any, w: number, h: number): string {
  const media = p.media;
  if (!media || media.displayed === false) return "";
  const img = media.wixMedia && media.wixMedia.image;
  return img ? imgSrc(img.id || img.url || img, w, h) : "";
}
export async function fetchPosts(limit = 20): Promise<PostCard[]> {
  const res = await wixRequest<any>("/blog/v3/posts/query", {
    body: { fieldsets: ["METRICS"], query: { sort: [{ fieldName: "pinned", order: "DESC" }, { fieldName: "firstPublishedDate", order: "DESC" }], cursorPaging: { limit } } },
  });
  return ((res && res.posts) || []).map((p: any) => ({
    slug: p.slug || "", title: p.title || "", excerpt: p.excerpt || "", date: p.firstPublishedDate || "", cover: postCover(p, 1200, 675), thumb: postCover(p, 112, 84),
  }));
}
export async function fetchPostBySlug(slug: string) {
  try {
    const res = await wixRequest<any>("/blog/v3/posts/slugs/" + encodeURIComponent(slug), {
      method: "GET",
      query: { fieldsets: ["RICH_CONTENT", "CONTENT_TEXT", "SEO"] },
    });
    const p = res && res.post;
    if (!p) return null;
    return {
      title: p.title || "",
      excerpt: p.excerpt || "",
      date: p.firstPublishedDate || "",
      cover: postCover(p, 1200, 675),
      paragraphs: String(p.contentText || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
    };
  } catch (e) {
    if ((e as WixError).status === 404) return null;
    throw e;
  }
}
export function formatPostDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
}

// ---------- Rich text (CMS) ----------
export { safeRich, hasText, safeLink } from "./rich.js";
