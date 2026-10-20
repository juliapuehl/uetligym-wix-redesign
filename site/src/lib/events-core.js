// Wix Events – shared rules for the event detail page, used on the server (rendering) and in the
// browser (RSVP form). Pure functions only: no network calls, no DOM. Network calls live in
// src/lib/events.js (server: load the event) and in the page's <script> (browser: send the RSVP).
// Based on the Wix Headless kit: events-core.ts and registration-core.ts.
import { imgSrc } from "./media.js";

const EVENT_DETAIL_FIELDS = ["DETAILS", "TEXTS", "REGISTRATION", "URLS", "CATEGORIES", "FORM"];

function evRawId(raw) { return (raw && (raw._id || raw.id)) || ""; }

function evIsoOf(value) {
  if (!value) return "";
  let d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

// event.description ist Ricos Rich Content, kein String; detailedDescription ist der Fallback.
function evParagraphs(rich, legacy) {
  function collect(nodes) {
    return (nodes || []).map(function (n) { return typeof (n.textData && n.textData.text) === "string" ? n.textData.text : collect(n.nodes); }).join("");
  }
  let out = [];
  ((rich && rich.nodes) || []).forEach(function (node) { let t = collect([node]).trim(); if (t) out.push(t); });
  if (!out.length && legacy) String(legacy).split(/\n+/).forEach(function (t) { t = t.trim(); if (t) out.push(t); });
  return out;
}

function evMainImage(raw) {
  let m = raw.mainImage;
  if (m && typeof m === "object" && typeof m.id === "string" && m.id) return "wix:image://v1/" + m.id + "/" + encodeURIComponent(String(m.altText || "image"));
  return m;
}

function evFormattedAddress(address) {
  if (!address) return "";
  if (typeof address.formatted === "string" && address.formatted) return address.formatted;
  if (typeof address.formattedAddress === "string" && address.formattedAddress) return address.formattedAddress;
  return [address.addressLine1 || address.addressLine, address.addressLine2, address.city, address.subdivision, address.postalCode, address.country]
    .filter(function (p) { return typeof p === "string" && p.trim(); }).join(", ");
}

const EV_INPUT_TYPES = { TEXT: 1, NUMBER: 1, TEXT_ARRAY: 1, DATE_TIME: 1, ADDRESS: 1 };
function evFormInput(raw) {
  let type = EV_INPUT_TYPES[raw.type] ? raw.type : raw.array === true ? "TEXT_ARRAY" : "TEXT";
  return {
    name: raw.name || "", label: raw.label || raw.name || "", mandatory: raw.mandatory === true, type: type,
    options: Array.isArray(raw.options) ? raw.options.map(String) : [],
    maxLength: Number(raw.maxLength) > 0 ? Number(raw.maxLength) : 0
  };
}

// Das RSVP-Formular des Veranstalters (FORM-Fieldset). GUEST_CONTROL wird separat geführt.
function evRsvpForm(form) {
  if (!form || !Array.isArray(form.controls)) return null;
  let live = form.controls.filter(function (c) { return c.deleted !== true; }).slice()
    .sort(function (a, b) { return (a.orderIndex || 0) - (b.orderIndex || 0); });
  let controls = [], guestControl = null;
  live.forEach(function (c) {
    let inputs = (c.inputs || []).map(evFormInput).filter(function (i) { return i.name; });
    if (c.type === "GUEST_CONTROL") {
      let count = inputs.filter(function (i) { return i.type === "NUMBER"; })[0] || inputs[0];
      let names = inputs.filter(function (i) { return i.type === "TEXT_ARRAY"; })[0];
      let numeric = ((count && count.options) || []).map(Number).filter(function (n) { return isFinite(n); });
      let rawNames = (c.inputs || []).filter(function (i) { return i.type === "TEXT_ARRAY" || i.array === true; })[0];
      let maxGuests = (numeric.length ? Math.max.apply(null, numeric) : 0) || Number((rawNames && rawNames.maxSize) || 0) || 0;
      guestControl = { label: (count && count.label) || "Begleitpersonen", maxGuests: maxGuests, namesLabel: (names && names.label) || "Namen der Begleitpersonen" };
      return;
    }
    controls.push({ id: evRawId(c) || c.name || String(controls.length), type: c.type || "INPUT", system: c.system === true, inputs: inputs });
  });
  return { controls: controls, guestControl: guestControl };
}

function evToDetail(raw) {
  let reg = raw.registration || {};
  let dts = raw.dateAndTimeSettings || {};
  let dateTbd = dts.dateAndTimeTbd === true;
  let regType = reg.type || reg.initialType || "NONE";
  let status = typeof reg.status === "string" ? reg.status : "UNKNOWN_REGISTRATION_STATUS";
  let paused = reg.registrationPaused === true || reg.registrationDisabled === true;
  let loc = raw.location || {};
  let locType = loc.locationTbd ? "TBD" : (loc.type || "TBD");
  return {
    id: evRawId(raw),
    slug: raw.slug || "",
    title: raw.title || "",
    shortDescription: raw.shortDescription || "",
    status: raw.status || "UPCOMING",
    startDateIso: dateTbd ? "" : evIsoOf(dts.startDate),
    endDateIso: dateTbd ? "" : evIsoOf(dts.endDate),
    timeZoneId: dts.timeZoneId || "Europe/Zurich",
    dateTbd: dateTbd,
    dateTbdMessage: dts.dateAndTimeTbdMessage || "",
    hideEndDate: dts.hideEndDate === true,
    locationName: loc.name || "",
    address: locType === "VENUE" ? evFormattedAddress(loc.address) : "",
    locationType: locType,
    imageUrl: imgSrc(evMainImage(raw), 1600, 900),
    paragraphs: evParagraphs(raw.description, raw.detailedDescription),
    registrationType: regType,
    registrationOpen: status.indexOf("OPEN_") === 0 && !paused && regType !== "NONE",
    registrationClosed: status === "CLOSED_MANUALLY" || status === "CLOSED_AUTOMATICALLY",
    waitlistOnly: status === "OPEN_RSVP_WAITLIST_ONLY",
    rsvpForm: regType === "RSVP" ? evRsvpForm(raw.form) : null,
    googleCalendar: (raw.calendarUrls && raw.calendarUrls.google) || "",
    icsUrl: (raw.calendarUrls && raw.calendarUrls.ics) || ""
  };
}

// "Montag, 26. Oktober 2026 · 18:00–20:00" in der Zeitzone des Events.
function evDateLine(ev) {
  if (ev.dateTbd || !ev.startDateIso) return ev.dateTbdMessage || "Datum folgt";
  let tz = ev.timeZoneId || "Europe/Zurich";
  let s = new Date(ev.startDateIso), e = ev.endDateIso ? new Date(ev.endDateIso) : null;
  function day(d) { return new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(d); }
  function time(d) { return new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d); }
  if (!e || ev.hideEndDate) return day(s) + " · " + time(s) + " Uhr";
  if (day(s) === day(e)) return day(s) + " · " + time(s) + "–" + time(e) + " Uhr";
  return day(s) + ", " + time(s) + " – " + day(e) + ", " + time(e);
}

// ---- RSVP (registration-core) ----------------------------------------------------------------

const EV_DEFAULT_RSVP_FORM = {
  controls: [
    { id: "name", type: "NAME", system: true, inputs: [
      { name: "firstName", label: "First name", mandatory: true, type: "TEXT", options: [], maxLength: 0 },
      { name: "lastName", label: "Last name", mandatory: true, type: "TEXT", options: [], maxLength: 0 }] },
    { id: "email", type: "INPUT", system: true, inputs: [{ name: "email", label: "Email", mandatory: true, type: "TEXT", options: [], maxLength: 0 }] }
  ],
  guestControl: null
};

function evRsvpFormOf(ev) { return ev.rsvpForm || EV_DEFAULT_RSVP_FORM; }

function evBuiltInInputs(form) {
  let isMail = function (i) { return /mail/i.test(i.name) || /mail/i.test(i.label); };
  let name = form.controls.filter(function (c) { return c.type === "NAME"; })[0] || form.controls.filter(function (c) { return c.system && c.inputs.length >= 2; })[0];
  let emailControl = form.controls.filter(function (c) { return c.system && c.type !== "NAME" && c.inputs.some(isMail); })[0] ||
    form.controls.filter(function (c) { return c.system && c.type !== "NAME"; })[0];
  let emailInput = (emailControl && (emailControl.inputs.filter(isMail)[0] || emailControl.inputs[0])) || null;
  return {
    firstName: (name && name.inputs[0] && name.inputs[0].name) || "firstName",
    lastName: (name && name.inputs[1] && name.inputs[1].name) || "lastName",
    email: (emailInput && emailInput.name) || "email"
  };
}

function evFilled(v) { return Array.isArray(v) ? v.some(function (x) { return String(x).trim(); }) : typeof v === "string" && v.trim().length > 0; }

function evCanSubmit(form, values, guestCount) {
  let ids = evBuiltInInputs(form);
  if (![ids.firstName, ids.lastName, ids.email].every(function (n) { return evFilled(values[n]); })) return false;
  for (let c = 0; c < form.controls.length; c++)
    for (let i = 0; i < form.controls[c].inputs.length; i++) {
      let inp = form.controls[c].inputs[i];
      if (inp.mandatory && !evFilled(values[inp.name])) return false;
    }
  if (form.guestControl && (guestCount < 0 || guestCount > form.guestControl.maxGuests)) return false;
  return true;
}

function evInputValue(input, values) {
  let v = values[input.name];
  if (!evFilled(v)) return null;
  if (input.type === "TEXT_ARRAY") return { inputName: input.name, values: (Array.isArray(v) ? v : [v]).filter(function (x) { return String(x).trim(); }) };
  return { inputName: input.name, value: Array.isArray(v) ? v.join(", ") : v };
}

function evRsvpBody(eventId, form, values, status, guests) {
  guests = guests || { guestCount: 0, guestNames: [] };
  let ids = evBuiltInInputs(form);
  let str = function (v) { return (Array.isArray(v) ? v.join(" ") : (v || "")).trim(); };
  let inputValues = [];
  form.controls.forEach(function (c) { c.inputs.forEach(function (i) { let x = evInputValue(i, values); if (x) inputValues.push(x); }); });
  let body = { eventId: eventId, status: status, firstName: str(values[ids.firstName]), lastName: str(values[ids.lastName]), email: str(values[ids.email]), form: { inputValues: inputValues } };
  if (form.guestControl) {
    let gc = Math.max(0, Math.min(Math.trunc(guests.guestCount) || 0, form.guestControl.maxGuests));
    body.additionalGuestDetails = { guestCount: gc, guestNames: guests.guestNames.slice(0, gc).map(function (n) { return n.trim(); }).filter(Boolean) };
  }
  return body;
}

const EV_ERROR_COPY = {
  GUEST_LIMIT_EXCEEDED: "Dieses Event ist leider ausgebucht.",
  MEMBER_ALREADY_REGISTERED: "Du bist für dieses Event bereits angemeldet.",
  MEMBER_EMAIL_ALREADY_REGISTERED: "Du bist für dieses Event bereits angemeldet.",
  INVALID_FORM_RESPONSE: "Bitte fülle alle Pflichtfelder aus.",
  UNEXPECTED_RSVP_STATUS: "Die Anmeldung für dieses Event ist nicht offen.",
  EVENT_NOT_FOUND: "Dieses Event ist nicht mehr verfügbar."
};
function evErrorMessage(e) {
  let code = e && (e.code || (e.details && e.details.applicationError && e.details.applicationError.code));
  if (code && EV_ERROR_COPY[code]) return EV_ERROR_COPY[code];
  return "Die Anmeldung hat leider nicht geklappt. Bitte versuche es nochmals.";
}

export {
  EVENT_DETAIL_FIELDS,
  evToDetail,
  evDateLine,
  evRsvpFormOf,
  evBuiltInInputs,
  evCanSubmit,
  evRsvpBody,
  evErrorMessage,
};
