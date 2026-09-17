# Handoff — repo structure, cleanup, and where to take this next

Written for whoever picks this project up next. The short version: the app
works and the core renderer is solid, but it was built fast and iteratively.
For a code-oriented map, start with [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`AGENTS.md`](../AGENTS.md).
The original 5,600-line `index.html` is now a document shell. `app/app.js` is
the composition root, while focused bootstrap, animation, scene, preset,
thumbnail, and UI modules own subsystem behavior. The remaining complexity is
mostly at the intentional boundary between retained compatibility controls and
the modern editor, not in one monolithic entry file.

**The north star for whatever you build next:** anyone on the team —
including non-engineers, e.g. Min Lee — should be able to open this tool and
make a preset without writing code or touching git. Weigh every decision
below against that, not against code cleanliness for its own sake.

---

## 1. The good news: this mostly already works today

Before building anything new, know what's already true:

- **Opening `index.html` gives anyone the full tuning UI** — sliders,
  animation timeline, live preview. No login, no code. See
  [`USER_GUIDE.md`](USER_GUIDE.md), which was written specifically to make
  the parameter names (`coreBias`, `blinkDepth`, etc.) legible in plain
  English for exactly this reason — point non-engineers there first.
- **The link/share button already works** (`#rp-share-link`, wired in
  `app/app.js`) — tune a look, click it, get a URL that plays that exact preset.
  This is, right now, the zero-code way for someone like Min Lee to make and
  hand over a preset. It's just not documented or surfaced as "hey, this is
  how you do it" anywhere obvious — that's a 20-minute fix (see §4).

So the accessibility goal is *closer than it looks*. The two things
actually missing are covered next.

---

## 2. The two features that would close the gap

Both already have full implementation specs written — this isn't
greenfield, it's "pick these up":

- **[`GEMINI_INTEGRATION.md`](GEMINI_INTEGRATION.md)** — "Describe a
  feeling" (type English, get a generated preset). This is the highest-
  leverage single feature for the accessibility goal: it removes the need
  to understand *any* parameter to get a starting point. Someone can type
  "nervous, like waiting for bad news" and get something to react to and
  refine, rather than facing 20 blank sliders.
- **[`PRESET_DB_CONTEXT.md`](../PRESET_DB_CONTEXT.md)** — real saved-preset
  storage + a browse UI. Right now "save to presets" just copies text to
  the clipboard, which requires knowing what to *do* with that text
  (paste into a `.txt` file, know git, redeploy). A real save/browse flow
  means anyone can build on top of anyone else's preset without ever
  opening a code editor.

Both need the same small piece of backend (Vercel serverless functions) —
build that groundwork once, both docs point at it.

**If you only do one thing this quarter, do the Gemini integration.** It's
the one most directly aimed at "Min Lee can do this," and it's the smaller
of the two builds.

---

## 3. Repo structure — what's live vs. dead weight

Audited by checking what `index.html` actually imports/references vs. what
sits unreferenced in the root:

**Live — don't touch without understanding the whole chain:**
```
index.html            Document shell and UI markup
app/app.js             App entry: panel, timeline, playback, and subsystem wiring
app/animation/         Pure easing, timeline calculations, layout, and shared-column edits
app/presets/           Preset parser, serializer, and share-link codec
app/runtime/           Boot readiness, public API, and kiosk/query/message coordination
app/state/             Canonical scene settings plus document undo policy
app/scene/             Color helpers and renderer/camera lifecycle adapter
app/thumbnails/        Restorable capture sessions, cache/surfaces, and filmstrip plans
app/ui/                Shared UI primitives, grouped into controls, shell, timeline, and legacy
styles.css            All styling (already separate — good)
firefly-field.js      Current particle renderer (createFireflyField)
cloud-background.js   Background glow, self-contained
sphere-core.js         Core sphere helpers, dynamically imported
field.js               Dynamically imported alongside firefly-field.js
particle-controls.js   Small helper, dynamically imported with the above
glsl.js                Imported by field.js (SIMPLEX_NOISE_3D) — looks
                        orphaned if you only grep index.html directly, but
                        it's a real transitive dependency. Don't delete it.
presets/*.txt           The 4 shipped emotion presets — source of truth
```

**Archived in `legacy/` — historical prototypes that are not imported by the
active application:**
```
legacy/official warm.html, legacy/official_anger.html,
legacy/official_calm.html, legacy/official_sad.html
legacy/fireflies-demo.html (uses legacy/fireflies.js)
legacy/quickstart.html     (uses legacy/app.js)
legacy/prototype1.txt
legacy/fireflies.js, legacy/app.js
```

**Status:** these files are now in `legacy/`, preserving the history and
keeping the active repo root legible. They can be deleted later if nobody
needs the old demos.

---

## 4. Concrete next steps, roughly in order

1. **Surface the link-share flow** (cheap, immediate accessibility win):
   add a line to the README (or better, directly in the tool's UI near the
   link button) saying "no code needed — tune it, click the link icon,
   share the URL." This alone lets Min Lee participate today.
2. **Move the dead files** into `legacy/` (§3). **Completed.**
3. **Build the Gemini integration** per `GEMINI_INTEGRATION.md`. This is
   the accessibility unlock — prioritize it over code refactoring.
4. **Build the saved-presets DB + browse UI** per `PRESET_DB_CONTEXT.md`,
   sharing the serverless groundwork from step 3.
5. **Extend module boundaries only when feature work needs them.** The active
   architecture is already split by responsibility:

   - `app/app.js` is the composition root and frame-facing adapter.
   - `app/bootstrap/` owns subsystem construction and initialization order.
   - `app/animation/`, `app/scene/`, `app/presets/`, and
     `app/thumbnails/` contain domain behavior without panel ownership.
   - `app/ui/controls/`, `app/ui/shell/`, and `app/ui/timeline/` contain
     current DOM presenters.
   - `app/ui/legacy/` contains compatibility adapters for the retained original
     controls. They intentionally share canonical playback, scene, and timeline
     state with the modern editor.

   A deeper legacy extraction should introduce one compatibility facade rather
   than duplicate state. Preserve `window.emotionSphere`, shared-link behavior,
   and the preset text grammar. Run `npm run verify` after structural changes;
   phase columns, asynchronous readiness, and thumbnail restoration are the most
   sensitive integration boundaries.

---

## 5. Testing

Run `npm run verify` after each refactor slice. The fast static gate checks the
module boundaries and source shape before the Playwright suite covers editor
boot, preset and share-link round trips, kiosk behavior, timeline interaction,
undo, and core UI flows. Also manually inspect the visual character of each
emotion after renderer changes; behavioral assertions cannot judge whether a
motion still feels right.

- [ ] Load each of the 4 built-in presets via the color dots — colors and
      motion still match their description in the README
- [ ] Tune a look, hit the link/share button, open that URL fresh — it
      replays correctly
- [ ] Edit a phase's sliders mid-animation — the flash-confirmation still
      fires, and the edit actually sticks on the next loop
- [ ] A preset with only 1–2 layers explicitly defined doesn't leave a
      stray color on layer 3 from whatever was on screen before (the
      "layer-count gotcha" called out in `GEMINI_PRESET_CONTEXT.md`)
- [ ] Resting `glowopacity` is still 0 on load — the known stray-orange-halo
      bug if it isn't

---

## 6. What this doc is *not*

It's not a bug list — nothing in the current build is confirmed broken
beyond the two features that were always meant to be stubs (Gemini
generation, saved presets). If you find an actual bug while working through
§4, file it as you go and add a regression test before continuing the module
split.
