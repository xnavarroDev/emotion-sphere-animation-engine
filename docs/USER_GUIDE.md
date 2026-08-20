# Emotion Sphere — User Guide

`index.html` is a self-contained app for designing and animating the
"Emotion Sphere" — a field of glowing particles ("fireflies") that can be
tuned into a "look" (a color, shape, and motion) and animated through a
sequence of phases that loop. This guide covers the on-screen controls and
what every tunable parameter and easing curve actually does to the sphere.

---

## 1. The layout

- **Canvas (right/main area)** — the live render of the sphere. Always shows
  the current state, whether you're scrubbing a saved animation or dragging
  a slider by hand.
- **Left panel** — everything you use to shape and animate the sphere.
  Collapse it with the `<` arrow at the top; a thin edge tab reappears to
  bring it back.
- **Top-right color dots** — five small circles above the canvas. Four are
  quick-load buttons for the built-in emotions (blue = calm-ish, yellow =
  warm, red = anger, purple = sad/calm depending on build); clicking one
  jumps straight to that preset. The fifth, smaller dot auto-cycles through
  all four in sequence — clicking any single color dot stops the cycle.
  This row is currently the only fully working way to load a built-in
  preset from the UI.
- **Timeline / track editor** — the dark strip docked under the canvas
  (drag its top edge to resize). This is where phases and animation live;
  see §4.

Two panel sections are visible but **not implemented yet** — don't spend
time on them:
- **"Browse saved presets"** — button is disabled; there's no saved-preset
  library yet, only the four built-in ones via the color dots.
- **"Describe a feeling…"** — a text box with a sparkle icon meant for a
  future "type a feeling, get a generated preset" (Gemini-powered)
  integration. The box and icon are inert placeholders right now.

---

## 2. Parameters section — what each slider does to the sphere

The sphere is built from three independent **firefly layers** (think: a
dense inner layer, a mid layer, a sparse outer layer, composited together).
Each layer has its own copy of every slider below. Whatever slider you're
looking at, it's scoped to whichever layer tab you have selected.

| Parameter | Plain-English effect |
|---|---|
| **count** | How many particles are visible in this layer. `0` is valid — a layer can fully disappear (used for "the feeling drains away" moments) and refill later. |
| **radius** | How far particles spread out from the center. Small = a tight ball; large = a wide, diffuse cloud. |
| **coreBias** | How much particles crowd toward the center vs. spread evenly. `1` = even distribution; higher (up to ~2.5) packs particles tightly into the middle, giving a dense, tense-looking core; lower (down to ~0.3) pushes them outward, hollowing out the center. |
| **intensity** | Overall brightness/additive glow. Push it high enough and particle cores start overexposing to white. |
| **hot** | How white-hot the brightest point of each particle gets. `0` = the particle stays its true color even at its brightest core; `1` = the core blows out to pure white, so only the edges show color. |
| **size** | Particle size multiplier — bigger or smaller dots. |
| **blinkSpeed** | How fast particles twinkle (flicker on/off). Low = a slow, gentle shimmer; high (5–6+) = rapid, nervous-looking flicker. |
| **blinkDepth** | How deep the twinkle swing goes. `0` = a steady, unwavering glow; `1` = particles swing all the way from dim to bright each blink. |
| **wander** | How far each particle drifts in place, independent of the others. Low = particles hold roughly still; high = a jittery, unsettled cloud. |
| **orbit** | Each particle tumbling on its own individual axis/speed, on top of any wander. Adds fine, chaotic-looking micro-motion. |
| **spin** | Rigid rotation of the *entire layer* as one piece — like the whole cluster is on a turntable. Sign controls direction (positive vs negative); keep this small (values are typically well under 1) since it affects the whole layer at once. |
| **speed** | A global multiplier that scales wander, orbit, and blink together — the master "how fast is everything happening" dial for the layer. |
| **breath** | The whole layer swelling in and out, like breathing — `0` is off; around `1` swells to roughly 40% past the resting radius. Higher values make a more dramatic pulse. |
| **breathSpeed** | How fast that breathing cycle repeats. |
| **pulse** | Per-particle size pulsing — each particle grows/shrinks on its own independent timing (as opposed to `breath`, which moves the whole layer together). |
| **pulseSpeed** | How fast each particle's individual pulse cycles. |
| **ripple** | A wave that travels outward from the center through the layer, like a ring expanding from a pebble dropped in water. Used sparingly in the built-in presets. |
| **rippleSpeed** | How fast that outward wave travels. |
| **rectFill** | `0` keeps the layer shaped like a sphere; `1` morphs it to fill the screen as a rectangle instead. Not used by any built-in preset — leave at `0` unless you specifically want that shape. |
| **spawnSpan** | How many seconds it takes for the layer to populate from empty up to its full particle count when it's building in from nothing (e.g. on loop restart). Longer = a slower, more gradual "coming into being"; shorter = particles pop in quickly. |
| **colour** | The layer's hex color (`#rrggbb`). Only settable per-phase in an animation — it's what actually drives the rendered color, not a "named" color anywhere in the engine. |

**Scene-level controls** (not per-layer — these govern the background/glow
shared by the whole sphere):

| Parameter | Plain-English effect |
|---|---|
| **glowopacity** | Strength of a soft glow halo behind the sphere. `0` = no glow. Keep this at `0` at rest — the glow overlay has a warm/amber tint baked in that shows as a stray orange halo if it's not fully off between animated peaks. |
| **glowcolor** | Hex color of that glow halo. |
| **bgcolor** | Background base color. |
| **bgcolor2** | A second background color, used as the top of a gradient. |
| **bggradient** | How much the background blends between `bgcolor` and `bgcolor2` as a gradient (`0`) vs. staying flat (`1`)... in practice, higher values lean more gradient. |

---

## 3. Easing — how a transition between two phases *feels*

When the sphere animates from one phase's values to the next, the `ease`
setting controls the *pacing* of that change — not what it changes to, but
how it gets there. Think of each curve as answering: "does the motion
start fast or slow, and does it end fast or slow?"

| Easing | What it looks like |
|---|---|
| **smootherstep** *(default)* | A gentle S-curve: starts slow, speeds up through the middle, slows back down into the target. No snap at either end — the smoothest, most neutral option. Use this when you don't want the transition itself to draw attention. |
| **linear** | Constant speed the whole way, no acceleration or deceleration. Feels mechanical/robotic compared to any of the others. |
| **easein** | Starts very slowly, then accelerates — arriving at the target moving at its fastest. Feels like something building up momentum, or slowly "winding up" before a change lands. |
| **easeout** | The opposite of easein: starts fast, then decelerates smoothly into the target. Feels like something settling into place, arriving gently even though it left abruptly. |
| **easeinout** | Slow → fast → slow, symmetric on both ends. A softer, more deliberate version of smootherstep with slightly more pronounced ease at the edges. |
| **expoin** | Barely moves for almost the whole duration, then rockets to the target right at the very end. Feels like a held breath followed by a sudden snap — most of the phase looks static, then everything happens at once, late. |
| **expoout** | The opposite of expoin: an explosive burst of motion right at the start, then decelerates and gently settles for the rest of the duration. Feels like a jolt or flinch — abrupt, immediate motion that then relaxes. This is the curve to reach for when you want a transition to feel sudden/startling rather than smooth. |
| **expoinout** | Combines both: a slow creep, then a sudden burst of motion through the middle, then a decelerating landing. The most dramatic/theatrical of the set. |

**Practical guide:** for anything meant to feel calm, gentle, or organic,
use `smootherstep` or `easeinout` with longer phase durations. For anything
meant to feel abrupt, anxious, or jarring, use `expoout` (immediate jolt)
or `expoin` (delayed snap) with shorter phase durations.

---

## 4. Animation — phases, tracks, and the timeline

Each firefly layer has its own animation **track** (lane), and there's one
more track for the **Scene** (background/glow). A track is a sequence of
**phases** — each phase is a target set of parameter values plus a
duration in seconds.

- **What a phase's duration means:** a phase's duration is the time it
  takes to *arrive* at that phase's own values, animating from whatever
  the previous phase looked like. So "Phase 2 @ 6s" means "spend 6 seconds
  morphing from Phase 1's look into Phase 2's look" — editing Phase 2's
  duration changes how long that arrival takes, not how long Phase 1
  lingers.
- **Looping:** when a track's sequence finishes, it loops back to Phase 1.
  On that wrap, the firefly layers rebuild in from empty (using Phase 1's
  own look with particle count zeroed out) rather than smearing from the
  last phase — so every loop starts the same way, including on first load.
- **The shared playhead:** one playhead spans every track at once, so all
  layers and the scene stay in sync. Clicking anywhere on empty lane space
  scrubs the playhead to that point in time. Dragging a phase segment's
  edge (the resize handle) changes that phase's own duration and shifts
  everything after it.
- **Selecting and editing a phase:** click a phase segment to make it the
  one being edited — this loads its saved values into the Parameters
  sliders above. From there, **any slider drag immediately overwrites that
  phase's saved values** — there's no separate "commit" step. After you
  stop dragging, the segment's thumbnail briefly flashes to confirm the
  edit actually saved.
- **add phase:** appends a new phase to whichever track/layer is currently
  focused.
- **clear track:** wipes every phase from just the currently focused
  track — it does not touch the other layers or the scene.
- **loop toggle:** turns looping on/off for playback.
- **play / reset:** starts/stops playback and resets the playhead to the
  start.

**Keeping tracks in sync:** all tracks (every layer's timeline plus the
scene's) should sum to the same total duration, so everything lines up and
loops together cleanly. 30–45 seconds per full cycle is typical for the
built-in presets; 2–4 phases per track is a common shape (rest → build →
peak → return).

---

## 5. Saving, sharing, and exporting

- **"save to presets"** — despite the label, this doesn't save into any
  library yet (that feature isn't built). It copies the current preset as
  text to your clipboard, briefly confirming "Saved to clipboard!"
- **Link / chain icon** — this *is* a real export: it encodes your current
  preset into a URL (`?mode=kiosk&preset=...`) and copies that link to
  your clipboard. Opening that URL loads and plays your exact look
  directly — a genuine way to share or bookmark a specific sphere.
- **Older top-toolbar buttons** (if present in your build) — a
  download-as-`.txt` button and a load-from-clipboard button offer plain
  text export/import of the same preset format described in
  `GEMINI_PRESET_CONTEXT.md`, for hand-editing outside the app.

---

## 6. Quick recipes

- **Make something feel calm:** long phase durations (8–15s), low
  `blinkSpeed`/`wander`, gentle `breath`, `smootherstep` or `easeinout`
  easing, cool or desaturated colors, low `intensity`/`hot`.
- **Make something feel anxious/abrupt:** short phase durations (3–6s),
  high `blinkSpeed`/`wander`/`orbit` (2–6), `expoout` (or `expoin`) easing
  for jolting transitions, tight `coreBias` for a tense packed core,
  saturated warm colors.
- **Make something feel like it's fading/sad:** build to fullness, then
  drop `count` toward `0` in a later phase (a "void" moment), then slowly
  rebuild; cool blue hues, low `hot`.
- **Make something feel warm/climactic:** moderate `breath`, warm
  gold/amber colors, raise `glowopacity` toward a bright climax phase then
  bring it back down toward `0`, higher `intensity` at the peak.
