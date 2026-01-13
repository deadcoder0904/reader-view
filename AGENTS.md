# Repository Guidelines

## Agent-Specific Instructions

- Use Tailwind classes as much as possible; avoid custom CSS unless a utility or theme token is unavailable.
- Use Bun commands (`bun`, `bun run`) instead of `npm`/`npx`.

## Project Structure & Module Organization

- `src/` contains extension code and UI assets.
  - `src/popup/`: popup HTML/TS entry points (`popup.html`, `popup.ts`).
  - `src/background/`: background/service worker logic.
  - `src/styles/`: Tailwind CSS entry points (e.g., `popup.css`).
  - `src/assets/`: static assets used by UI.
- `manifests/`: browser-specific manifest templates.
- `scripts/`: build, zip, and icon-generation tooling.
- `icons/`: generated extension icons.

## Build, Test, and Development Commands

- `bun run dev`: build in dev mode and watch (`scripts/build.ts`).
- `bun run build:chrome`: production build for Chrome.
- `bun run build:firefox`: production build for Firefox.
- `bun run build:all`: build both targets.
- `bun run zip:all`: package both targets.
- `bun run check`: type-check and run tests.
- `bun run lint`: run `oxlint` type-aware linting.
- `bun run format`: format with `oxfmt`.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM) + Tailwind CSS v4.
- Indentation: 2 spaces (consistent with existing files).
- Filenames: lower-case with dashes for assets, camelCase for TS symbols.
- Formatting: `oxfmt` is the source of truth; run before PRs.
- Linting: `oxlint --type-aware .` should be clean.

## Testing Guidelines

- Runner: `bun test` (no dedicated test directory yet).
- Add tests next to modules or in a `__tests__/` directory; prefer `*.test.ts`.
- If adding tests, update this guide with any new conventions or fixtures.

## Commit & Pull Request Guidelines

- Git history is not present in this working copy, so no commit-message convention
  can be inferred. Use concise, imperative messages (e.g., “Add popup dial UI”).
- PRs should include:
  - A short description of the change and rationale.
  - Screenshots for UI changes (popup/extension views).
  - Notes about any new build or config steps.

## Configuration & Extension Notes

- Manifests live in `manifests/` and are injected into builds.
- Use `scripts/generate-icons.ts` to update `icons/` when assets change.
