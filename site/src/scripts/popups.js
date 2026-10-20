// Popups aus dem CMS – im Layout auf jeder Seite eingebunden. Bild- und Text-Regeln teilen sich
// Server und Browser (src/lib/media.js, src/lib/rich.js). wixRequest und escapeHtml kommen aus
// public/assets/site.js (im Layout vor diesem Skript geladen).
import { imgSrc } from "../lib/media.js";
import { safeRich } from "../lib/rich.js";

// ---------- Popups aus dem CMS (Tabelle "Popups") ----------
// Auf jeder Seite: das wichtigste aktive Popup, das zu Seite, Zeitraum und Häufigkeit passt.
// Vorschau unabhängig von allen Regeln: <seite>?popup=<Titel>, z. B. /?popup=Newcomer%20Offer
(function () {
  function store(kind) { try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch (e) { return null; } }
  function seen(key, kind) { var s = store(kind); try { return !!(s && s.getItem(key)); } catch (e) { return false; } }
  function markSeen(key, kind) { var s = store(kind); try { if (s) s.setItem(key, "1"); } catch (e) { /* egal */ } }

  function pageKeys() {
    // "/" → ["index"], "/angebot" → ["angebot"], "/seite/newcomer-offer" → ["seite", "seite/newcomer-offer"]
    var parts = location.pathname.replace(/\.html$/, "").split("/").filter(Boolean).map(function (x) { return decodeURIComponent(x).toLowerCase(); });
    if (!parts.length) return ["index"];
    var keys = [parts[0]];
    if (parts.length > 1) keys.push(parts.join("/"));
    return keys;
  }
  function today() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function dateStr(v) {
    if (!v) return "";
    if (typeof v === "object" && v.$date) v = v.$date;
    return String(v).slice(0, 10);
  }
  function freqOf(p) {
    var f = String(p.haeufigkeit || "einmal").toLowerCase();
    if (/immer/.test(f)) return "immer";
    if (/besuch|session/.test(f)) return "besuch";
    return "einmal";
  }
  function templateOf(p) {
    var v = String(p.vorlage || "").toLowerCase();
    if (/banner/.test(v)) return "banner";
    if (/slide|seite|ecke/.test(v)) return "slidein";
    return "modal";
  }
  function matches(p, keys, day) {
    var pages = Array.isArray(p.seiten) ? p.seiten.map(function (x) { return String(x).trim().toLowerCase().replace(/\.html$/, ""); }).filter(Boolean) : [];
    if (pages.length && pages.indexOf("alle") < 0 && !pages.some(function (x) { return keys.indexOf(x) >= 0 || (x === "startseite" && keys[0] === "index"); })) return false;
    var from = dateStr(p.startDatum), to = dateStr(p.endDatum);
    if (from && day < from) return false;
    if (to && day > to) return false;
    var f = freqOf(p), key = "uetligym-popup-" + p._id;
    if (f === "einmal" && seen(key, "local")) return false;
    if (f === "besuch" && seen(key, "session")) return false;
    return true;
  }

  function show(p, preview) {
    var tpl = templateOf(p);
    var f = freqOf(p), key = "uetligym-popup-" + p._id;
    var img = tpl !== "banner" ? imgSrc(p.bild, tpl === "modal" ? 960 : 680, tpl === "modal" ? 540 : 380) : "";
    var title = p.titel ? '<h2 class="pop-title" id="pop-title">' + escapeHtml(p.titel) + '</h2>' : "";
    var text = p.text ? '<div class="rich pop-text">' + safeRich(p.text) + '</div>' : "";
    var link = String(p.buttonLink || "").trim();
    var btn = p.buttonText && link && !/^\s*javascript:/i.test(link)
      ? '<a class="btn ' + (tpl === "banner" ? "oak-dark-text sm" : "oak") + ' pop-cta" href="' + escapeHtml(link) + '">' + escapeHtml(p.buttonText) + '</a>' : "";
    var close = '<button class="pop-close" type="button" aria-label="Schliessen">×</button>';

    var wrap = document.createElement("div");
    wrap.className = "pop pop-" + tpl;
    if (tpl === "modal") {
      wrap.innerHTML = '<div class="pop-backdrop"></div><div class="pop-card" role="dialog" aria-modal="true"' + (title ? ' aria-labelledby="pop-title"' : ' aria-label="Hinweis"') + ' tabindex="-1">' +
        close + (img ? '<div class="pop-img"><img src="' + img + '" alt=""></div>' : '') + '<div class="pop-body">' + title + text + btn + '</div></div>';
    } else if (tpl === "slidein") {
      wrap.innerHTML = '<div class="pop-card" role="dialog" aria-modal="false"' + (title ? ' aria-labelledby="pop-title"' : ' aria-label="Hinweis"') + '>' +
        close + (img ? '<div class="pop-img"><img src="' + img + '" alt=""></div>' : '') + '<div class="pop-body">' + title + text + btn + '</div></div>';
    } else {
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", p.titel || "Hinweis");
      wrap.innerHTML = '<div class="wrap pop-bar"><div class="rich pop-text">' + (p.text ? safeRich(p.text) : escapeHtml(p.titel || "")) + '</div>' + btn + close + '</div>';
    }

    var lastFocus = document.activeElement;
    function onKey(e) { if (e.key === "Escape") dismiss(); }
    function dismiss() {
      wrap.classList.remove("pop-open");
      document.removeEventListener("keydown", onKey);
      if (tpl === "modal") document.documentElement.classList.remove("pop-lock");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 250);
      if (tpl === "modal" && lastFocus && lastFocus.focus) lastFocus.focus();
    }
    wrap.querySelector(".pop-close").addEventListener("click", dismiss);
    var backdrop = wrap.querySelector(".pop-backdrop");
    if (backdrop) backdrop.addEventListener("click", dismiss);
    var cta = wrap.querySelector(".pop-cta");
    if (cta) cta.addEventListener("click", function () { if (!preview && f === "einmal") markSeen(key, "local"); });
    document.addEventListener("keydown", onKey);

    document.body.appendChild(wrap);
    if (tpl === "modal") document.documentElement.classList.add("pop-lock");
    requestAnimationFrame(function () { wrap.classList.add("pop-open"); });
    if (tpl === "modal") { var card = wrap.querySelector(".pop-card"); if (card) card.focus(); }
    if (!preview) { if (f === "einmal") markSeen(key, "local"); else if (f === "besuch") markSeen(key, "session"); }
  }

  function init() {
    var previewTitle = new URLSearchParams(location.search).get("popup");
    var query = previewTitle
      ? { paging: { limit: 50, offset: 0 } }
      : { filter: { aktiv: { $eq: true } }, sort: [{ fieldName: "prioritaet", order: "DESC" }], paging: { limit: 50, offset: 0 } };
    wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "Popups", query: query } }).then(function (res) {
      var items = ((res && res.dataItems) || []).map(function (d) { return d.data || {}; });
      if (previewTitle) {
        var want = previewTitle.trim().toLowerCase();
        var hit = items.filter(function (p) { return String(p.titel || "").trim().toLowerCase() === want; })[0];
        if (hit) show(hit, true);
        return;
      }
      var keys = pageKeys(), day = today();
      var p = items.filter(function (x) { return matches(x, keys, day); })[0];
      if (!p) return;
      var delay = Math.max(0, Number(p.verzoegerung) || 0) * 1000;
      setTimeout(function () { show(p, false); }, delay);
    }).catch(function () { /* keine Popups – Seite läuft normal weiter */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
