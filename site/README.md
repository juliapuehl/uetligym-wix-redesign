# Uetligym – Website (Astro + Wix)

- `npm install` – Abhängigkeiten installieren
- `npm run dev` – lokal starten (http://localhost:4321)
- `npm run release` – bauen und auf Wix veröffentlichen

Inhalte werden im Wix-Dashboard gepflegt (CMS, Events, Blog, Formulare).
Seiten: `src/pages`, Layout: `src/layouts/Layout.astro`, Styles: `src/styles/global.css`,
Datenzugriff (Server): `src/lib/wix.ts`, Event-Regeln (Server + Browser): `src/lib/events-core.js`,
Bild-/Text-Helfer (Server + Browser): `src/lib/media.js`, `src/lib/rich.js`, Popups: `src/scripts/popups.js`,
Menü und Wix-Client im Browser: `public/assets/site.js`.
