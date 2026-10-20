# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The actual project lives in `site/` (Astro 5 site hosted on Wix, created with the Wix CLI). Run all commands from `site/`. `_to_delete/` holds old copies and zips of an earlier version. Ignore it and don't edit it.

## Commands (in `site/`)

- `npm install`: install dependencies
- `npm run dev`: local dev server via `wix dev` (http://localhost:4321)
- `npm run build`: `wix build`
- `npm run preview`: `wix preview`
- `npm run release`: build and publish to the live Wix site. This deploys to production, so only run it when explicitly asked.
There are no tests, no linter and no type-check script. `astro check` would need `@astrojs/check`, which isn't installed.

## Architecture

**Content comes from the Wix dashboard**, not the repo: CMS collections, Events, Blog and Forms. Pages are server-rendered (`output: "server"`, Wix hosting adapter) so that CMS content ends up in the HTML for SEO.

**Two Wix clients that talk to the same REST API (`https://www.wixapis.com`) over plain `fetch`.** Neither uses the `@wix/sdk` modules:
- Server: `src/lib/wix.ts` has `wixRequest`, an anonymous visitor token cached in memory, and fetchers such as `queryCollection`, `fetchUpcomingEvents`, `fetchPosts` and `fetchPostBySlug`. Pages wrap calls in `safe(promise, fallback)` so a Wix failure renders an empty section instead of a 500.
- Browser: `public/assets/site.js` is a classic non-module script loaded `is:inline` in `Layout.astro`. It defines the globals `wixRequest`, `createSubmission` and `escapeHtml`, plus the mobile menu. The visitor tokens (with refresh) are stored in localStorage. The client ID reaches the browser through `<html data-wix-client>`. Page `<script>`s and `src/scripts/popups.js` use these globals without importing them.
- The client ID comes from `PUBLIC_WIX_CLIENT_ID`, falling back to `appId` in `wix.config.json`.

**Shared server and browser modules are plain JS with pure functions only** (no network, no DOM), so Astro can bundle them into both sides: `src/lib/media.js` (`imgSrc`, which builds Wix image URLs), `src/lib/rich.js` (sanitizes CMS rich text) and `src/lib/events-core.js` (turns raw events into page data, and holds the RSVP form logic, request body and German error messages). `src/lib/events.js` is the server-side loader for one event.

**What reads from where:**
- CMS collections: `Startseite` (index), `Kurse` and `Stundenplan` (angebot), `Landingpages` (`/seite/[slug]`), `Popups` (queried in the browser by `popups.js` on every page; preview any popup with `?popup=<Titel>`)
- Wix Events: `community` and `/event-details/[slug]`. RSVPs are sent from the browser to `/events/v2/rsvps`.
- Wix Blog: `blog`, `community` and `/post/[slug]`
- Wix Forms: contact form on `kontakt`. The form ID and field-key mapping are in `src/lib/config.ts`. If the form changes in the dashboard, update them there.
- The route paths `/event-details/…` and `/post/…` match Wix's default URLs.

**Styling:** one global stylesheet, `src/styles/global.css` (Manrope from Google Fonts), plus utility classes like `only-m` and `only-d` for mobile-only and desktop-only content. `Layout.astro` holds the header and footer; its `nav` prop marks the active menu item.

## Conventions

- All user-facing text is in Swiss Standard German (`de-CH`, "du" form). Dates are formatted with `Intl.DateTimeFormat("de-CH")` in `Europe/Zurich`.
- Code comments mix German and English. Browser-side JS uses ES5-style `var`/`function` (in `site.js`) or `let` with function expressions (in the shared libs). Match the file you are editing.
- `.env.local` holds Wix CLI credentials. Never print them or commit them.
