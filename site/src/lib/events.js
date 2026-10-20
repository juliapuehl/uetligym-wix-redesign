// Wix Events on the server: load one event for the detail page.
// The rules for turning it into page data live in events-core.js (shared with the browser).
import { wixRequest } from "./wix";
import { EVENT_DETAIL_FIELDS, evToDetail } from "./events-core.js";

export { evDateLine } from "./events-core.js";

// GET /events/v3/events/slug/{slug}?fields=… → { event }; null bei 404.
export async function fetchEventBySlug(slug) {
  try {
    const res = await wixRequest("/events/v3/events/slug/" + encodeURIComponent(slug), { method: "GET", query: { fields: EVENT_DETAIL_FIELDS } });
    return res && res.event ? evToDetail(res.event) : null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
