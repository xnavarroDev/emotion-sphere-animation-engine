# Coding-agent guide

This repository is a static browser application: there is no build step and no
backend in the current product. Read this file before changing code, then use
`docs/ARCHITECTURE.md` for the runtime flow and ownership map.

## Start here

1. Read `docs/ARCHITECTURE.md` for startup order, state ownership, and feature
   boundaries.
2. Read `app/README.md` for the module catalog.
3. Run `npm run check` before and after structural changes.
4. Run the smallest relevant Playwright test while iterating, then run
   `npm run verify` before handing work off.

Use Node.js 20 or newer. On Windows systems that block PowerShell npm scripts,
use `npm.cmd` and `npx.cmd`.

## Task routing

| Change | Primary locations | Integration boundary |
|---|---|---|
| App startup or cross-feature wiring | `app/app.js`, `app/bootstrap/` | Keep `app.js` a composition root |
| Timeline math or playback | `app/animation/` | `bootstrap/animation-runtime.js` |
| Timeline DOM and interactions | `app/ui/timeline/` | `bootstrap/timeline-editor.js` |
| Layer/background controls | `app/ui/controls/` | `bootstrap/parameter-editor.js`, `layer-control-suite.js` |
| Panel, gallery, or layout | `app/ui/shell/` | `bootstrap/editor-shell.js` |
| Particle motion or appearance | `app/scene/`, `firefly-field.js` | `bootstrap/scene-render-runtime.js` |
| Scene/camera/WebGL lifecycle | `app/scene/scene-runtime.js` | `bootstrap/scene-foundation.js` |
| Preset parsing or restoration | `app/presets/` | `bootstrap/preset-runtime.js` |
| Share links or kiosk API | `app/presets/share-url.js`, `app/runtime/` | `window.emotionSphere` |
| Thumbnail generation | `app/thumbnails/` | `bootstrap/thumbnail-runtime.js` |
| Retained original controls | `app/ui/legacy/` | `bootstrap/legacy-animation-editor.js` |
| Markup or styling | `index.html`, `styles.css` | Preserve IDs consumed by UI adapters |
| Tests | `tests/` | Shared browser helpers are in `tests/helpers/app.js` |

There is no production backend yet. Gemini generation and saved-preset storage
are proposals in `docs/GEMINI_INTEGRATION.md` and `PRESET_DB_CONTEXT.md`.

## Invariants agents must preserve

- `window.emotionSphere` is the only supported application global.
- Modern and legacy controls share canonical state; never create parallel
  playback, scene, layer, or timeline state for one interface.
- The preset text grammar and existing shared URLs are compatibility contracts.
- Preset restoration must wait for dynamically imported editor layers.
- Timeline phase columns are structural across every layer and the Scene track.
- Thumbnail capture must restore the exact live scene, clock, and playback state.
- `index.html` remains a document shell: no inline scripts, styles, or event
  handlers.
- Browser capabilities should be injected into modules where practical; avoid
  adding direct `window` or `document` access to domain modules.
- Do not remove `app/ui/legacy/` merely because it is named legacy. Those
  controls remain tested and user-accessible.

## Dynamic modules and cache versions

`field.js`, `particle-controls.js`, `firefly-field.js`, and `sphere-core.js` are
loaded dynamically. If one changes, update every matching query-string version
at its import sites. When deploy-visible JavaScript changes, bump the
`app/app.js?v=...` version in `index.html` so static hosts do not retain a stale
module graph.

## Debugging shortcuts

- Blank canvas or failed boot: inspect `#err`, browser console errors, dynamic
  import paths, and `app/runtime/app-readiness.js`.
- Missing preset layers/phases: inspect readiness, `preset-document-controller`,
  `preset-restorer`, and layer add/remove adapters.
- Timeline mismatch: inspect `timeline-workspace`, `timeline-edit`, and the
  modern/legacy transport adapters before patching DOM code.
- A button that does nothing: locate its ID in `index.html`, then trace its UI
  adapter into the relevant bootstrap.
- Wrong animation appearance: separate interpolation bugs (`app/animation/`)
  from renderer/presentation bugs (`app/scene/` or `firefly-field.js`).
- Incorrect thumbnails: inspect capture transaction restoration before changing
  timeline thumbnail presentation.
- Kiosk-only failures: inspect `app/runtime/kiosk-runtime.js`, URL precedence,
  and the public emotion API.

Use `rg` to trace IDs, exports, and callbacks. Follow ownership toward a
bootstrap rather than adding another cross-module global or duplicate listener.

## Change discipline

- Keep comments focused on ownership, ordering, and non-obvious constraints.
- Prefer small pure helpers for math and state transitions; keep DOM wiring in
  `app/ui/` and WebGL mutation in `app/scene/`.
- Add or update a focused regression test for bug fixes.
- Preserve unrelated working-tree changes.
- Do not edit files under `legacy/` for active-product changes; they are archived
  prototypes. Compatibility code used by the product lives in `app/ui/legacy/`.

## Definition of done

- Relevant focused tests pass.
- `npm run verify` passes before push.
- `git diff --check` is clean.
- New modules are documented and listed in the architecture check when they
  establish a required boundary.
- User-facing behavior, public APIs, preset round trips, and legacy controls are
  unchanged unless the task explicitly changes them.
- Renderer changes receive a manual visual check across calm, sad, warm, and
  anger; automated tests cannot judge artistic motion quality.
