# Handoff — repo structure, cleanup, and where to take this next

Written for whoever picks this project up next. The short version: the app
works and the core renderer is solid, but it was built fast and iteratively
("vibe coded") — one 5,600-line `index.html` carrying the entire UI, panel
logic, timeline editor, and playback engine. Nothing here is broken in a way
that blocks using the tool today; the debt is in *navigability*, not
correctness.

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
- **The link/share button already works** (`#rp-share-link`, index.html
  ~3474) — tune a look, click it, get a URL that plays that exact preset.
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
index.html            UI + panel + timeline editor + playback + kiosk API (5,587 lines)
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

**Archived in `legacy/` — six-week-old prototypes, referenced nowhere except
one code comment (`index.html:758`), not linked from the README or the app:**
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
5. **Only after 3–4, if there's still appetite:** split `index.html`'s
   JS out of the markup file into modules. A reasonable seam (based on
   reading the file, not a rewrite) would roughly follow the sections that
   are already visually distinct inside it: panel/collapsible UI wiring,
   the timeline/track editor (phases, playhead, drag-resize), preset
   text parsing (`paramsToText`/`applyPreset`), and the kiosk/embed API
   (`window.emotionSphere`). This is real work and real risk (the phase/
   duration semantics are subtle — see the commit history around "each
   phase's duration now governs arriving at it, not leaving it" for how
   easy this is to get backwards) — don't start it until 1–4 are done,
   since it doesn't move the accessibility goal at all on its own.

---

## 5. Testing — there's no automated test suite

There isn't one, and I'm not recommending you build one before anything
else — but *do* manually re-check these flows after any change, since
they're the ones most likely to silently regress (the preset loader fails
silently on bad input, so breakage often looks like "the sphere is just
wrong," not an error):

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
§4, file it as you go rather than trying to hunt for bugs up front; a
5,600-line file you didn't write is much faster to debug by touching real
flows than by reading it end to end.
