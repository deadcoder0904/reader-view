# Reader View

Reader View is a browser extension that extracts the main content from a web page, removes clutter, and displays a clean, readable overlay with one‑click Markdown export.

## Features

- Chrome + Firefox targets via `webextension-polyfill`
- Bun-based build pipeline (TS + Tailwind)
- Reader overlay + background service worker
- Tailwind v4 CSS-first setup
- Automated icon generation from a single SVG/PNG

## Development

Requirements:

- Bun >= 1.1
- `zip` CLI for the `zip` script (optional)

Install deps (if needed), then run:

- Dev (chrome target): `bun run dev`
- Dev (firefox target): `bun run dev:firefox`
- Build (chrome target): `bun run build:chrome`
- Build (firefox target): `bun run build:firefox`

Environment variables:

- `BROWSER=chrome|firefox` to choose manifest target (default: `chrome`)

Load the `dist/` folder as an unpacked extension.

## Scripts

- `dev` — build and watch (Chrome)
- `dev:firefox` — build and watch (Firefox)
- `build:chrome` / `build:firefox` — production builds
- `icons` — generate icons from SVG/PNG
- `icons:check` — verify icon sizes
- `lint` / `format` — oxlint and oxfmt
- `zip` — create an archive from `dist/`

## Structure

- `src/background/service-worker.ts` — background logic
- `src/content/` — reader overlay assets
- `src/offscreen/` — offscreen document for clipboard/downloads
- `src/popup/` — unused popup placeholder (no popup in manifest)
- `src/styles/` — Tailwind v4 entry CSS
- `scripts/` — build, icon, zip scripts
- `manifests/` — per‑browser manifest templates

## Notes

- `src/assets/icon.svg` is the Reader View icon source.
- Tailwind v4 is CSS‑first; see `src/styles/popup.css` for theme tokens.
- The background and popup use `webextension-polyfill` for Chrome + Firefox compatibility.
