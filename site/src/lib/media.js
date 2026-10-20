// Wix image URLs. Pure helper, used on the server and in the browser (no imports, no network).
/**
 * @param {any} value  wix:image://…, a media file name or a static.wixstatic.com URL
 * @param {number} w
 * @param {number} h
 * @returns {string}
 */
export function imgSrc(value, w, h) {
  if (!value) return "";
  const v = typeof value === "string" ? value : value.url || value.id || value.src || "";
  let file = "";
  if (v.startsWith("wix:image://")) file = v.slice("wix:image://v1/".length).split("/")[0].split("#")[0];
  else if (/^[\w-]+~mv2\.[a-z0-9]+$/i.test(v)) file = v;
  else { const m = v.match(/^https:\/\/static\.wixstatic\.com\/media\/([^/?#]+)/); if (m) file = m[1]; }
  if (file) return `https://static.wixstatic.com/media/${file}/v1/fill/w_${w},h_${h},al_c,q_90/${file}`;
  return v;
}
