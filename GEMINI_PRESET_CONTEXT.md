# Preset generation reference — for the Gemini "Describe a feeling" integration

This is the reference doc for whoever wires up Gemini to generate custom
presets from a free-text feeling description. Feed this file (or the relevant
sections of it) to Gemini as context/system prompt, alongside 1-2 real preset
files from `presets/` as few-shot examples.

**The target:** a plain-text preset string, in the exact format below, passed to:
```js
window.emotionSphere.applyPreset(presetText); // applies it and starts playing
```

---

## 1. The mental model

A "look" is 3 **firefly layers** (independent fields of glowing particles,
composited together — e.g. a dense inner layer + a sparse outer layer) plus
one shared **scene** (background color + glow). The engine supports 1-2
layers too, but always generate all 3 — see the layer-count gotcha in §3.

Each layer, and the scene, has its own **animation timeline**: a sequence of
**phases**, each with a duration in seconds and a target set of parameter
values. Playback smoothly interpolates from phase to phase and loops back to
phase 1 — that's the whole "look." A phase can change any parameter, including
the layer's **colour**, so a preset can e.g. build from dim blue to a bright
white flash and back.

**All tracks (every layer's timeline + the scene's timeline) should sum to
the same total duration.** That's what makes them stay in sync across one
loop. Real presets run 30-45s per full cycle.

---

## 2. Full parameter reference

These are every key you can set on a firefly layer (as its resting/base value,
or as a per-phase animated target). Ranges are the min/max **actually used**
across the 4 shipped presets (calm/sad/warm/anger) — safe territory, not hard
limits.

| key | meaning | observed range | typical |
|---|---|---|---|
| `count` | visible particle count for this layer | 0 – 760 | 40–220 |
| `radius` | cluster radius (how far particles spread from center) | 2.2 – 11.3 | 1.5–4.5 |
| `coreBias` | >1 packs particles toward the center; 1 = even | 0.3 – 2.5 | 1.0 |
| `intensity` | additive brightness; hot centers overexpose to white | 0.18 – 6.0 | 1.5–4.5 |
| `hot` | 0 = true color even at the core, 1 = white-hot centers | 0 – 0.55 | 0–0.3 |
| `size` | particle size multiplier | 0.22 – 0.7 | 0.35–0.5 |
| `blinkSpeed` | twinkle rate multiplier | 0.16 – 6.0 | 1–3 |
| `blinkDepth` | 0 = steady glow, 1 = full twinkle swing | 0 – 1 | 0.8–1 |
| `wander` | in-place drift range multiplier | 0.4 – 5.5 | 1–3 |
| `orbit` | per-particle independent tumble (each particle its own axis/speed) | 0.1 – 2.0 | 0.5–1 |
| `spin` | rad/s rigid rotation of the whole layer (sign = direction) — keep small | -1.8 – 0.4 | ±0.03–0.4 |
| `speed` | global motion-rate multiplier (scales wander/orbit/blink together) | 0.3 – 2.0 | 1–2 |
| `breath` | whole-layer swell in/out, 0 = off, ~1 = 40% past radius | 0 – 6.0 | 0–4 |
| `breathSpeed` | breathing rate multiplier | 0.26 – 2.8 | 1–1.4 |
| `pulse` | per-particle size pulse (each particle its own phase/rate) | 0 – 2.2 | 0–2 |
| `pulseSpeed` | pulse rate multiplier | 0.3 – 2.1 | 1–2 |
| `ripple` | radial traveling wave, swells outward from center | 0 – 0.83 | 0–0.6 (rarely used) |
| `rippleSpeed` | ripple travel-rate multiplier | 0.4 – 1.0 | — |
| `rectFill` | 0 = sphere, 1 = morphs to fill the screen as a rectangle | not used by any shipped preset | leave at 0 |
| `spawnSpan` | seconds over which the layer populates from empty | 9 – 26 | 16–26 |

`count: 0` is a real, used value — layers fully disperse to empty at some
phases (e.g. sad's "void" moment) and refill later.

**Colour:** set per-phase with `colour #rrggbb` (see grammar below). Not a
resting-layer key — it only exists inside phases.

### Scene (background) keys — set per Anim Scene phase, not per layer:
| key | meaning | range |
|---|---|---|
| `glowopacity` | background glow halo strength | 0 – 1 |
| `bggradient` | how much the background is a two-color gradient vs. flat | 0 – 1 |
| `glowcolor` | (hex) glow halo color | — |
| `bgcolor` | (hex) background base/bottom color | — |
| `bgcolor2` | (hex) background gradient top color | — |

---

## 3. Exact text-format grammar

Case-insensitive section headers, one `key value` pair per line otherwise.
**Unknown or malformed lines are silently ignored, not rejected** — the
loader never throws, so a subtly wrong preset will just look wrong, not
error. Validate before applying (see §5).

```
Firefly Layer 1
count 120
radius 2.00
coreBias 1.00
intensity 3.00
hot 0.10
size 0.40
blinkSpeed 1.00
blinkDepth 0.80
wander 1.00
breath 0.00
breathSpeed 1.00
pulse 0.00
pulseSpeed 1.00
ripple 0.00
rippleSpeed 1.00
rectFill 0.00
spawnSpan 20.00
orbit 0.50
spin 0.02
speed 1.00

Firefly Layer 2
... (same keys — always include all 3 layers, see rules below)

Firefly Layer 3
... (same keys)

Anim Layer 1
animate 1
Phase 1 @ 8.00
ease smootherstep
name Starting
colour #4a6fa8
count 60.000
radius 2.000
... (any subset of the layer keys above, as this phase's target values)
Phase 2 @ 12.00
colour #a8c8ff
intensity 4.500
...

Anim Layer 2
... (matches Firefly Layer 2)

Anim Layer 3
... (matches Firefly Layer 3)

Anim Scene
animate 1
Phase 1 @ 8.00
glowcolor #ffffff
bgcolor #10141c
bgcolor2 #000000
glowopacity 0.00
bggradient 1.00
Phase 2 @ 12.00
glowopacity 0.60
...

View
mode circles
loop 1
glow 0
fireflies 0
glowopacity 0.00
bgcolor #10141c
bgcolor2 #000000
bggradient 1
rotate 1
rotatespeed 0.05
```

Rules:
- `Phase N @ <seconds>` starts a new phase; everything until the next
  `Phase`/section header belongs to it.
- `ease` (optional, defaults to `smootherstep` if omitted) — one of:
  `smootherstep`, `linear`, `expoout`, `expoin`, `easeout`, `easein`.
- `name` (optional) — a human label for the phase, shown in the timeline UI.
  Skip it unless you want to name phases meaningfully.
- Every `Anim Layer N` must correspond to a `Firefly Layer N` with the same N.
- **`mode circles` is required, exactly that, in the View block.** ("circles"
  is the current particle renderer — the confusingly-named "fireflies" mode
  is a legacy/unused system. Always emit `mode circles`.)
- Do **not** emit `Classic`, `Core Particles`, or `Layer N` sections — those
  belong to the legacy mode and aren't used by any real preset.
- Do **not** emit `@colorname` override lines or an `emotion` line — those
  drive the built-in emotion-dot color-switching system, which
  `applyPreset()` doesn't use. Set color entirely via per-phase `colour`.
- **Always emit exactly 3 `Firefly Layer` blocks (and 3 matching `Anim Layer`
  blocks), even for a "1-layer-looking" result** (make layers 2/3 sparse —
  low `count`, low `intensity` — rather than omitting them). Verified: applying
  a preset only overwrites the layers it explicitly lists; a preset that only
  defines `Firefly Layer 1` leaves layers 2 and 3 showing whatever the *previous*
  look had (e.g. the page's default red look on a fresh load) — a stray-color
  bug that's easy to ship without noticing in a screenshot taken too early.
- **Set the static `glowopacity` in `View` to `0.00`.** Verified: the
  background glow overlay has a warm/amber tint baked into its default look
  that bleeds through as a stray orange halo if `glowopacity` starts above 0,
  even with `glowcolor` set to white. Every shipped preset keeps the resting
  `glowopacity` at `0.00` and only raises it inside `Anim Scene` phases for a
  deliberate bloom at a climax, falling back toward 0 afterward.
- Every phase should set `colour` explicitly. If a phase omits it, the layer
  just keeps whatever color the previous phase left it at — usually not what
  you want.
- Keep every layer's Anim timeline (and the Anim Scene timeline) summing to
  the **same total duration**. 2-4 phases per layer is typical; 30-45s total
  is a good default cycle length if the description doesn't imply a pace.

---

## 4. Mapping a feeling description to parameters (rough guide)

These are the actual dials that carry emotional character in the 4 shipped
presets — use them as anchors, not rules:

- **Calm** → slow `breathSpeed`/`pulseSpeed` (~1), low `blinkSpeed`, gentle
  `ripple`, cool/desaturated or purple hues, long phase durations (8-15s),
  low `intensity`/`hot`.
- **Sad** → builds to fullness then drops `count` toward 0 (a "void" phase),
  slow return; cool blue hues; low `hot`.
- **Warm** → moderate `breath`, warm gold/amber hues, glow-heavy background
  (`glowopacity` up), climax phase with higher `intensity`.
- **Anger** → fast `blinkSpeed`/`wander`/`orbit` (2-3+), high `breath` and
  `pulse`, short phase durations (short buildup, fast churn), red hues, high
  `coreBias` (tightly packed), `intensity` 5+.

For a novel description, pick 2-4 of these dials that best match the
description's pace and intensity, choose a hue, and build 2-4 phases that
move toward/away from a "climax" phase — that's the shape every shipped
preset follows (rest → build → peak → return, looping).

---

## 5. Suggested integration recipe

1. Send Gemini this doc + 1 full real preset file (e.g. `presets/firefly-calm.txt`)
   as a few-shot example, plus the user's free-text description.
2. Ask it to return **only** the preset text, in this exact format, nothing else.
3. **Validate before applying** — the loader fails silently on garbage, so a
   malformed response won't error, it'll just render wrong or blank:
   - Every non-blank line matches either a known section header or `key value`
     (numeric) or `key #hexcolor`.
   - Exactly `Firefly Layer 1`, `2`, and `3` all appear, each with a matching
     `Anim Layer N` (see the layer-count gotcha above — a missing layer
     silently inherits whatever was on screen before).
   - Every `Anim Layer`/`Anim Scene` block's phase durations sum to the same
     total (within ~1s).
   - `View` includes `glowopacity 0.00` (or the response's first `Anim Scene`
     phase does) — otherwise expect a stray warm halo (see the glow gotcha
     above).
   - Any `colour`/`glowcolor`/`bgcolor`/`bgcolor2` value is a valid `#rrggbb`.
   - If validation fails, retry the Gemini call once with the error appended
     before giving up and showing an error state.
4. On success: `window.emotionSphere.applyPreset(text)`.

Real, complete examples to use as few-shot references: any file in
`presets/` (`firefly-calm.txt`, `firefly-sad.txt`, `firefly-warm.txt`,
`firefly-anger.txt`).
