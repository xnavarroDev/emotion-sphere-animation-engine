# Application modules

For startup order, state ownership, and task routing, see
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`AGENTS.md`](../AGENTS.md).

`app.js` remains the browser entry point while the former inline application is
split into focused modules. New dependencies should flow into the entry point;
subsystems should not communicate through new `window` globals.
High-level initialization is moving into `bootstrap/` modules so the entry
point composes subsystem APIs instead of importing every leaf dependency.
Sphere-core attachment now forms a parent bootstrap over preset/runtime startup,
making their asynchronous ordering explicit and independently testable.
Particle births, trails, colors, drag/rotation, frame scheduling, and viewport
startup now compose behind the scene-render bootstrap.
Renderer creation, the cloud background, outer-shell GPU resources, canonical
scene settings, and their legacy compatibility controls share a scene-foundation
bootstrap so they cannot accidentally initialize against different state.
The redesigned timeline's renderer, gestures, transport, phase placement,
thumbnail presentation, resizing, and share action now compose behind the
timeline-editor bootstrap; application state reaches it through explicit
getters and callbacks rather than module globals.
Canonical readiness, scene, playback, emotion, and classic-renderer state is
constructed by one application-state bootstrap and passed explicitly onward.
Panel layout, top-level disclosures, preset cards, dirty tracking, undo
checkpoints, and preview refresh now compose behind the editor-shell bootstrap.
Layer commands, grouped particle parameters, rotation, background controls,
and live-phase commits now compose behind the parameter-editor bootstrap.
The legacy phase list, transport, timeline workspace, snapshot application,
and compatibility reset commands now compose behind a legacy-animation-editor
bootstrap while continuing to share canonical state with the modern timeline.
Firefly-layer selection, classic-emitter controls, sphere-mode controls, and
the compatibility inner-layer controls now initialize through one
layer-control-suite bootstrap with explicit synchronization hooks.
Timeline planning, clock advancement, frame sampling, and layer/scene snapshot
interpolation now share an animation-runtime bootstrap used by live rendering
and thumbnail settling.
Offscreen WebGL capture, synthetic settling, track isolation, cropping,
readback, caching, and exact scene restoration now compose behind a
thumbnail-runtime bootstrap.
Authored inner/firefly layer defaults live in `scene/layer-presets.js`, separate
from startup wiring. The parent `bootstrap/editor-runtime.js` boundary composes
the shell, layer controls, parameter editor, legacy editor, and modern timeline;
`app.js` supplies grouped contracts and retains only handles used by rendering,
presets, and animation.

Timeline focus, layer/scene lookup, and snapshot capture share the
`animation/timeline-workspace.js` boundary so the legacy and modern editors
cannot develop different track-index rules. Live phase commits and their
debounced thumbnail/save feedback live in `ui/timeline/live-phase-editor.js`. Default
timeline startup is coordinated by an idempotent seeder so async boot order
cannot duplicate or skip the initial animation. Preset document loading uses a
controller for preview invalidation, generated-input discovery, UI resync, and
undo-baseline policy while the existing parser retains the stable text format.
Runtime preset playback now shares a documented start-from-zero session policy.
Pointer seeking now has a dedicated animation adapter that clamps the shared
axis and synchronizes interpolated counts with particle birth ages.
Lane resizing delegates in-place geometry updates to the lane presenter,
preserving pointer capture while keeping every track on the shared time axis.
Timeline row and phase DOM assembly now has its own adapter between the pure
render model, mutation actions, and post-insertion measurement finalizer.
The complete rebuild pipeline is coordinated by `ui/timeline/timeline-renderer.js`,
with live application state supplied through explicit getters.
Modern play, reset, and loop presentation is coordinated by
`ui/timeline/timeline-transport.js`, including synchronization with legacy loop UI.
Per-frame timeline plan creation, clock advancement, progress reporting, and
stop policy now live in `animation/frame-runner.js`.
Modern and legacy Play actions use the same playback-session plan preparation.
Mutable playback time, loop, seek-hold, and scrubbing state is centralized in
`animation/playback-state.js`, preventing transports and thumbnail captures
from restoring only part of the animation clock.

- `bootstrap/` – ordered subsystem initialization and explicit composition boundaries
- `animation/` – pure easing, timeline selection/default seeding, exact snapshot restoration, playback planning/session policy, firefly/scene interpolation and renderer adapters, layout, and shared-column structural edits
- `presets/` – live-state collection, preset text serialization/parsing, deterministic restoration, renderer restore adapters, and UTF-8-safe share links
- `runtime/` — explicit cross-import readiness, the public emotion/preset API, built-in aliases, and kiosk/query/message coordination
- `scene/` – authored emotion, sphere-core prototype, and classic-renderer defaults, unified emotion/cycle state, transition composition, firefly-layer collection lifecycle, classic/shell particle buffer state, palette/tint
  math, particle color-buffer rendering/effects/material appearance, motion primitives,
  normalized frame state, CPU position integration, inner-layer construction/presentation and layer reset policy,
  spawn/trail lifecycles, ordered per-frame renderer coordination, pointer-driven
  drag/whole-sphere rotation, live cloud/core presentation, and renderer/camera lifecycle
- `state/` — canonical scene-wide settings plus bounded, burst-coalesced full-document undo history
- `thumbnails/` — exception-safe capture transactions, bounded preview caching, frame scheduling, reusable offscreen render resources, and pure filmstrip sampling plans
- `ui/` — shared accessibility, emotion-selection, and runtime-error primitives
  - `ui/controls/` — particle, layer, background, rotation, and scene controls
  - `ui/shell/` — editor layout, disclosures, preset gallery, and footer
  - `ui/timeline/` — timeline rendering, editing, gestures, transport, and previews
  - `ui/legacy/` — compatibility UI adapters retained for the original controls
