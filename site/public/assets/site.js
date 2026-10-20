// Uetligym – browser script on every page: menu, Wix client (visitor token over plain fetch) for the
// contact form, event registration and popups (src/scripts/popups.js). Page content (courses, events, blog, CMS) is rendered
// on the server by src/lib/wix.ts and doesn't need this file.

// ---------- Menu ----------
(function () {
  var btn = document.querySelector(".menu-btn");
  var nav = document.getElementById("nav");
  if (!btn || !nav) return;
  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();

// ---------- Wix client ----------
var WIX_CLIENT_ID = document.documentElement.getAttribute("data-wix-client") || "";
var WIX_API_BASE = "https://www.wixapis.com";
var STORAGE_KEY = "wix-visitor-" + WIX_CLIENT_ID;
var memoryTokens = null;

function loadTokens() {
  if (memoryTokens) return memoryTokens;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) memoryTokens = JSON.parse(raw);
  } catch (e) { /* storage unavailable: mint a fresh visitor */ }
  return memoryTokens;
}
function saveTokens(t) {
  memoryTokens = t;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch (e) { /* session only */ }
}
async function mintTokens(body) {
  var res = await fetch(WIX_API_BASE + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ clientId: WIX_CLIENT_ID }, body))
  });
  if (!res.ok) throw new Error("Wix auth failed (" + res.status + ").");
  var d = await res.json();
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: Date.now() + d.expires_in * 1000 };
}
async function accessToken() {
  var t = loadTokens();
  if (t && t.expiresAt - 60000 > Date.now()) return t.accessToken;
  var fresh = null;
  if (t && t.refreshToken) {
    try { fresh = await mintTokens({ grantType: "refresh_token", refreshToken: t.refreshToken }); } catch (e) { fresh = null; }
  }
  if (!fresh) fresh = await mintTokens({ grantType: "anonymous" });
  saveTokens(fresh);
  return fresh.accessToken;
}
async function wixRequest(path, opts) {
  opts = opts || {};
  var url = new URL(path, WIX_API_BASE);
  var q = opts.query || {};
  Object.keys(q).forEach(function (k) {
    [].concat(q[k]).forEach(function (v) { url.searchParams.append(k, String(v)); });
  });
  var res = await fetch(url, {
    method: opts.method || "POST",
    headers: { Authorization: await accessToken(), "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  if (!res.ok) {
    var msg = "";
    var details = null;
    try { var j = await res.json(); msg = (j && j.message) || ""; details = (j && j.details) || null; } catch (e) { /* no body */ }
    var err = new Error(msg || (opts.method || "POST") + " " + url.pathname + " failed (" + res.status + ").");
    err.status = res.status;
    err.details = details;
    err.code = details && details.applicationError && details.applicationError.code;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Forms (forms/rest/submissions.ts) ----------
async function createSubmission(formId, values) {
  return wixRequest("/form-submission-service/v4/submissions", { body: { submission: { formId: formId, submissions: values } } });
}

// ---------- HTML ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}

// ---------- Videos: bei "Bewegung reduzieren" nicht automatisch abspielen ----------
(function () {
  if (!window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("video[data-reduce-motion]").forEach(function (v) { v.removeAttribute("autoplay"); v.pause(); });
})();
