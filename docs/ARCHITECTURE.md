# Architecture and runtime flow

This document explains where behavior lives and how the application starts.
It is intended for contributors and coding agents diagnosing cross-feature bugs.

## Runtime shape

The project is a static ES-module application. `index.html` provides markup and
loads Three.js plus `app/app.js`. There is no bundler, framework, production
server, database, or API layer.

```text
index.html
    |
    v
app/app.js  (composition root)
    |
    +-- bootstrap/application-state.js
    +-- bootstrap/scene-foundation.js
    +-- bootstrap/animation-runtime.js
    +-- bootstrap/editor-runtime.js
    +-- bootstrap/scene-render-runtime.js
    +-- bootstrap/core-runtime.js
    |       `-- bootstrap/preset-runtime.js
    `-- bootstrap/thumbnail-runtime.js
```

Bootstraps construct features. Domain folders contain behavior. UI folders
translate DOM events into callbacks and present canonical state.

## Startup sequence

1. `createApplicationState()` creates readiness, scene settings, playback,
   emotion, classic-renderer settings, and the Scene timeline.
2. `initializeSceneFoundation()` creates the Three.js runtime, background,
   outer shell, textures, and shared scene-setting controls.
3. `initializeAnimationRuntime()` connects timeline planning and interpolation
   to live scene adapters.
4. `initializeEditor()` yields until synchronous classic-particle construction
   finishes, then `initializeEditorRuntime()` dynamically loads particle engines
   and composes layer controls, both editor surfaces, and the modern timeline.
5. `initializeSceneRenderRuntime()` owns the animation frame loop, particle
   spawning, trails, viewport layout, and final render ordering.
6. `initializeCoreRuntime()` attaches the asynchronously loaded sphere core and
   starts preset/public/kiosk behavior only after required adapters exist.
7. `initializeThumbnailRuntime()` starts last because capture requires the
   complete scene and exact restoration adapters.

`app/runtime/app-readiness.js` is the gate between independently loaded editor
and core/preset paths. Do not replace it with timing assumptions.

## Frame flow

At a high level, each animation frame:

1. advances automatic emotion cycling;
2. derives normalized frame state;
3. advances timeline playback and applies layer/Scene interpolation;
4. updates classic particle positions, colors, births, and trails;
5. updates layered firefly fields and sphere/background presentation;
6. applies drag and automatic rotation; and
7. renders the Three.js scene.

The ordering is coordinated by `app/scene/scene-frame-runner.js`. Changes to one
stage should be made there or in its injected service, not by adding a second
animation loop.

## State ownership

| State | Owner | Important consumers |
|---|---|---|
| Boot readiness | `runtime/app-readiness.js` | editor, presets, undo |
| Playback time/loop/scrub | `animation/playback-state.js` | both transports, capture, frame runner |
| Emotion selection/cycle | `scene/emotion-state.js` | colors, particle presentation, kiosk |
| Scene settings | `state/scene-settings.js` | background, rotation, presets, Scene track |
| Classic renderer settings | `scene/classic-renderer-settings.js` | emitter, Scene track, presets |
| Layer timelines | each firefly layer | animation runtime, both editors, presets |
| Scene timeline | application state | animation runtime, both editors, presets |
| Undo document history | `state/undo-history.js` | editor shell and preset restore |

State should be passed through getters and commands. UI modules should not
become alternate state owners.

## UI boundaries

- `ui/controls/` contains current parameter and scene controls.
- `ui/shell/` contains layout, disclosures, preset cards, and footer state.
- `ui/timeline/` contains timeline DOM, gestures, rendering, and transport.
- `ui/legacy/` contains adapters for retained original controls.
- `ui/accessibility.js`, `emotion-controls.js`, and `runtime-errors.js` are
  shared primitives.

The modern and legacy interfaces are two views over the same application state.
Compatibility adapters may look old, but they are not archived. Historical,
inactive prototypes are under the root `legacy/` directory.

## Preset lifecycle

`presets/preset-format.js` is the stable text codec. Parsing produces tokens;
restoration applies those tokens through renderer-aware adapters. Collection and
serialization read live state. URL sharing base64url-encodes the same text, so
file presets, clipboard presets, and shared links use one format.

An external document load invalidates thumbnail caches and resets the undo root.
An undo restoration preserves the existing history. Keep that distinction when
adding new load paths.

## Testing map

- `tests/architecture/animation.spec.js`: timeline, playback, and snapshot contracts
- `tests/architecture/scene.spec.js`: particles, rendering, motion, and layer lifecycle
- `tests/architecture/timeline-ui.spec.js`: modern timeline presenters and interactions
- `tests/architecture/controls-shell.spec.js`: controls, panel shell, gallery, and viewport
- `tests/architecture/legacy-ui.spec.js`: retained compatibility presenters
- `tests/architecture/thumbnails.spec.js`: capture, cache, and render-surface behavior
- `tests/architecture/presets-runtime.spec.js`: restoration, readiness, runtime, and undo
- `tests/app-shell.spec.js`: boot and top-level editor controls
- `tests/editor.spec.js`, `extended-editor.spec.js`: authored editing workflows
- `tests/timeline-interactions.spec.js`: pointer and duration interactions
- `tests/presets.spec.js`, `preset-format.spec.js`: text/share round trips
- `tests/runtime.spec.js`, `runtime-edge.spec.js`: kiosk and public API behavior
- `tests/ui-flows.spec.js`: accessibility and cross-panel UI flows

The test server disables caching and replaces external Three.js/font requests.
Production still loads Three.js and fonts from CDNs.
