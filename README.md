# Emotion Sphere

An interactive particle sphere that visualizes emotion. A field of soft glowing
circles ("fireflies") blooms, breathes, ripples, and disperses to express four
emotions — **calm, sad, warm, anger** — each as a looping, animated preset.

Built for the IPMD Emotion Sphere project — a digital art installation intended
to help children explore and reflect their emotional state.
*Project Manager: Myranoush Khan.*

Live: https://lost-in-space-light.vercel.app

**Design reference:** [Figma — Emotion Sphere Particle Engine redesign](https://www.figma.com/design/FCQj42AClQLDXKuxpvuuHb/emotion-sphere-particle-engine-redesign?node-id=0-1&t=rJTidOnDuIgeaBHB-1)
— the panel UI in `index.html` follows this for layout/visual direction; not
every screen is built yet, and implementation may diverge in small ways.

**Docs:**
- [User guide](docs/USER_GUIDE.md) — UI controls, every parameter, easing curves
- [Preset format reference](GEMINI_PRESET_CONTEXT.md) — the `.txt` grammar, for hand-editing or generating presets

**Not built yet — implementation specs for whoever picks these up:**
- [Gemini integration](docs/GEMINI_INTEGRATION.md) — wiring up "Describe a feeling"
- [Saved-presets database](PRESET_DB_CONTEXT.md) — real save/browse/delete

Both need a backend (`api/` serverless functions); neither exists today.

---

## Two ways to use it

The same app runs in two modes, selected by a URL parameter:

| Mode | URL | For |
|---|---|---|
| **Tuning tool** | `index.html` | The team — full parameter UI to design/edit the emotion looks |
| **Runtime (kiosk)** | `index.html?mode=kiosk` | Production — just the sphere playing an emotion, no UI |

The renderer is shared, so any visual improvement made in the tool automatically
applies to the runtime — there is no separate build or fork.

---

## Run locally

It's a static site (no build step). Serve the folder over HTTP and open it:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

(Opening `index.html` via `file://` will not work — the ES modules and the
preset `fetch` require an HTTP server.)

---

## Runtime / embedding (the handoff)

To drop the sphere into another website, embed the kiosk URL in an iframe and
control it from your code.

**1. Embed:**

```html
<iframe
  src="https://lost-in-space-light.vercel.app/index.html?mode=kiosk&emotion=calm"
  style="width:100%; height:100%; border:0;"
  allow="autoplay">
</iframe>
```

- `?mode=kiosk` hides all the authoring UI (leaves only the sphere + the emotion dots).
- `?emotion=calm` sets the emotion that plays on load.

**2. Change the emotion at runtime** (e.g. from an emotion-detection system):

```js
const sphere = document.querySelector('iframe');
sphere.contentWindow.postMessage({ type: 'emotion', value: 'sad' }, '*');
```

**Valid emotion values:** `calm`, `sad`, `warm` (alias `happy`), `anger` (alias `angry`).

**3. Or call the API directly** (if importing the page rather than iframing):

```js
window.emotionSphere.play('sad');   // returns a Promise, resolves once loaded
window.emotionSphere.emotions;      // list of valid names
```

In kiosk mode the on-screen **color dots** (top-right) are also a live selector:
🔵 blue = sad · 🟡 yellow = warm · 🔴 red = anger · 🟣 purple = calm.

---

## Emotions & presets

Each emotion is a text preset in `presets/`. These are the **editable source of
truth** — updating a default means editing/replacing the preset file (no code
change), then redeploying.

| Emotion | Preset file | Character |
|---|---|---|
| **calm** | `firefly-calm.txt` | Purple field, ripples out from center, a slow 40s "deep breath" that expands and contracts; silver flush at the peak |
| **sad** | `firefly-sad.txt` | Cool blue; builds to fullness, then suddenly disperses into an empty void, then slowly returns |
| **warm** | `firefly-warm.txt` | Gold/amber; a 40s arc that blooms, glows, and breathes at the climax with a warm background wash |
| **anger** | `firefly-anger.txt` | Red; erupts from calm into a fast, churning, tightly-packed storm |

The runtime maps an emotion name → preset file in `index.html` (the
`PRESET_FILES` object). Other files in `presets/`
(`firefly-bloom-reference.txt`, `firefly-anger-calm.txt`) are earlier drafts /
references, not wired into the runtime.

### Editing a preset

1. Open the tuning tool (`index.html`, no params).
2. Adjust the sliders / animation phases for a layer.
3. Click **save to presets** to copy the full preset text to your clipboard
   (despite the label, there's no saved-preset library yet — it's a
   clipboard copy). The older toolbar's **Save** button downloads it as a
   `.txt` file instead.
4. Paste it into the matching file in `presets/` and redeploy.

You can also reload a preset by copying its text and clicking the older
toolbar's **Load** button (it reads from the clipboard).

For the full walkthrough of every control, parameter, and easing curve, see
[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).

---

## The parameter system (tuning tool)

An emotion is a **field of up to 3 particle layers**, each animated by a
**timeline of phases**. Key per-layer parameters:

- **count / radius / coreBias** — how many particles, how far they spread, and how they cluster toward the center
- **intensity / hot / size** — brightness, white-hot blowout, and dot size
- **blinkSpeed / blinkDepth** — twinkle rate and depth
- **wander / orbit / spin** — in-place drift, per-particle tumble, whole-layer rotation
- **breath / pulse** — whole-layer swell, and per-particle size pulsing
- **ripple** — a swell that travels from the center outward
- **rectFill** — morph the sphere outward into a screen-filling rectangle
- **colour** — the layer's particle color; animatable per phase, so a preset can shift color at a climax (e.g. a silver flush) and back
- **speed** — global motion-rate multiplier

**Animation:** each layer has a phase timeline; the animation smoothly
interpolates between phases and loops. A separate **Scene** track animates the
background color and glow. Cycle length is the sum of a preset's phase durations
(calm 40s, sad 30s, warm 40s, anger 30s).

The renderer lives in **`firefly-field.js`** (`createFireflyField`); the
background glow in **`cloud-background.js`**; the UI, animation playback, and
save/load glue in **`index.html`**.

---

## Deployment

Deployed on Vercel, connected directly to **this repo**
(`emotion-sphere-animation-engine`) with **`colour-switch` as the production
branch** — every push to `colour-switch` auto-deploys to
https://lost-in-space-light.vercel.app, no manual step needed.

(This wasn't always the case: the Vercel project used to be connected to a
different repo, `lost-in-space-light`, which is why old commit messages or
docs might reference it. If a push isn't showing up on the live site, check
Vercel → Project → Settings → Git to confirm it's still pointed at this repo.)

Manual/local deploy is still available if needed:

```bash
npx vercel --prod
```

The whole folder is served statically, including `presets/` (the runtime fetches
preset files at that path).

---

## Project structure

```
index.html               App: tuning UI + playback engine + kiosk runtime
firefly-field.js         The particle renderer (createFireflyField)
cloud-background.js      Background glow (procedural, self-contained)
sphere-core.js           Core sphere helpers
presets/                 Emotion presets (editable source of truth)
  firefly-calm.txt         calm
  firefly-sad.txt          sad
  firefly-warm.txt         warm
  firefly-anger.txt        anger
docs/
  USER_GUIDE.md           Full UI/parameter/easing walkthrough
  GEMINI_INTEGRATION.md   Spec: wiring "Describe a feeling" to Gemini (unbuilt)
GEMINI_PRESET_CONTEXT.md  Preset .txt format grammar + parameter reference
PRESET_DB_CONTEXT.md      Spec: saved-presets database (unbuilt)
```
