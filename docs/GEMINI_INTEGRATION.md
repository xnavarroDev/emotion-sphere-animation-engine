# Wiring up "Describe a feeling" — the Gemini preset generator

Implementation guide for turning the stubbed **"Describe a feeling…"** box
into a working feature: user types a feeling in plain English → Gemini
returns a preset → the sphere plays it.

**Read first:** [`GEMINI_PRESET_CONTEXT.md`](../GEMINI_PRESET_CONTEXT.md) —
that's the *content* spec (the preset grammar and parameter meanings you
feed Gemini as context). **This** doc is the *plumbing* spec (how to
actually call the API, safely, and wire it to the UI).

Related: [`PRESET_DB_CONTEXT.md`](../PRESET_DB_CONTEXT.md) — the saved-presets
database. Both features need the same backend groundwork (§2), so if you're
building both, do that part once.

---

## 0. Current state

Everything is stubbed, nothing is wired:

| Piece | Where | State |
|---|---|---|
| The textarea | `index.html:52` (`#rp-describe-textarea`) | `disabled` |
| The ✦ sparkle button | `index.html:53` (`.rp-sparkle`) | No click handler, `title="AI generation not built yet"` |
| The section wrapper | `index.html:48` (`#rp-describe-section`) | Collapsible, works fine |
| The apply seam | `index.html:4099` (`window.emotionSphere.applyPreset(text)`) | **Works.** This is your target — generate text, pass it here |
| Preset name field | `index.html:101` (`#rp-preset-name`) | Works; good place to put a generated name |

There is **no** Gemini code anywhere in the repo, and **no** API key in
`.env.local` (it currently holds only a Vercel OIDC token). This is
greenfield.

---

## 1. The blocker: the API key cannot live in the browser

This is a **static site with no backend**. If you put a Gemini API key in
`index.html` or any `.js` file, it ships to every visitor in plain text —
view-source, network tab, or the deployed bundle all expose it. Keys found
this way get scraped and billed against your quota within hours.

So: **do not** do this, no matter how convenient it looks:

```js
// ❌ NEVER. The key is public the moment you deploy.
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIza...')
```

The key must stay server-side. Since the site is already on Vercel, the
cheapest path is a **serverless function that proxies the call** — the
browser talks to your function, your function talks to Gemini with the key.

---

## 2. Architecture

```
browser (index.html)
   │  POST /api/generate-preset  { description: "anxious, jittery, orange" }
   ▼
Vercel serverless function (api/generate-preset.js)   ← GEMINI_API_KEY lives here
   │  POST generativelanguage.googleapis.com ... :generateContent
   ▼
Gemini  →  preset text  →  validated  →  returned to browser
   │
   ▼
window.emotionSphere.applyPreset(text)
```

Vercel auto-detects any file under `api/` as a serverless function — **no
build step, no framework, no change to how the site deploys.** `npx vercel
--prod` keeps working exactly as it does today.

**Set the key** in Vercel project settings → Environment Variables →
`GEMINI_API_KEY` (get one from [Google AI Studio](https://aistudio.google.com/apikey)).
For local dev, add it to `.env.local` — already gitignored via `.env*`, so
it won't be committed. **Never commit the key.**

---

## 3. The serverless function

`api/generate-preset.js`:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The context doc + one real preset are the whole prompt. Read them from
// disk at cold start rather than pasting a copy here — otherwise the prompt
// silently drifts out of sync every time someone edits the docs.
let cachedPrompt = null;
async function systemPrompt() {
  if (cachedPrompt) return cachedPrompt;
  const root = process.cwd();
  const [spec, example] = await Promise.all([
    readFile(path.join(root, 'GEMINI_PRESET_CONTEXT.md'), 'utf8'),
    readFile(path.join(root, 'presets/firefly-calm.txt'), 'utf8'),
  ]);
  cachedPrompt =
    spec +
    '\n\n---\n\nHere is a complete, real preset as a worked example:\n\n' +
    example +
    '\n\n---\n\nReturn ONLY the preset text, in exactly this format. ' +
    'No markdown fences, no commentary, no explanation before or after.';
  return cachedPrompt;
}

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const description = String(req.body?.description || '').trim();
  if (!description) return res.status(400).json({ error: 'description required' });
  if (description.length > 500) return res.status(400).json({ error: 'description too long' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: await systemPrompt() }] },
        contents: [{
          role: 'user',
          parts: [{ text: `Generate a preset for this feeling: ${description}` }],
        }],
        generationConfig: {
          // Low-ish: the format is rigid and must be obeyed exactly. Too high
          // and it invents parameter names the loader silently ignores.
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'text/plain',
        },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Gemini error', r.status, detail);
      return res.status(502).json({ error: 'generation failed' });
    }

    const data = await r.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Models like wrapping output in ```; strip it if present.
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();

    if (!text) return res.status(502).json({ error: 'empty response' });
    return res.status(200).json({ preset: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'generation failed' });
  }
}
```

**Notes on the above:**
- `maxOutputTokens` needs real headroom — a full 3-layer preset with 4–5
  phases each runs ~400 lines. Truncation here is a common failure and it
  looks like "the sphere half-loaded," not like an error.
- Model names move fast. `gemini-2.5-flash` is the sensible default (fast,
  cheap, more than capable of structured text). Verify what's current at
  [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
  before shipping, and prefer Flash over Pro unless quality is visibly bad —
  this task is format-following, not deep reasoning.

---

## 4. Validation — do not skip this

**The preset loader never throws.** From `GEMINI_PRESET_CONTEXT.md` §3:
unknown or malformed lines are *silently ignored*. So a subtly wrong
response doesn't error — it renders wrong, or renders as the *previous*
look, and you'll waste an afternoon wondering why "orange" came out red.

Validate before applying. Put this in the serverless function (reject and
retry server-side) or in a shared module — either way, run it:

```js
export function validatePreset(text) {
  const errors = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const SECTION = /^(firefly layer [123]|classic|anim layer [123]|anim scene|view|core particles|layer [123])$/i;
  const PHASE   = /^phase\s+\d+\s*@\s*[\d.]+$/i;
  const NUMERIC = /^[a-z]\w*\s+-?[\d.]+$/i;
  const HEXLINE = /^[a-z]\w*\s+#[0-9a-f]{6}$/i;
  const NAMED   = /^(ease|name|@\w+)\b/i;

  // 1. every line is something the parser understands
  for (const l of lines) {
    if (SECTION.test(l) || PHASE.test(l) || NUMERIC.test(l) || HEXLINE.test(l) || NAMED.test(l)) continue;
    errors.push(`unparseable line: "${l}"`);
  }

  // 2. all three layers present, each with a matching anim track
  for (const n of [1, 2, 3]) {
    if (!new RegExp(`^firefly layer ${n}$`, 'im').test(text)) errors.push(`missing Firefly Layer ${n}`);
    if (!new RegExp(`^anim layer ${n}$`, 'im').test(text))    errors.push(`missing Anim Layer ${n}`);
  }

  // 3. every track sums to the same total (they must stay in sync)
  const totals = {};
  let current = null;
  for (const l of lines) {
    if (SECTION.test(l)) { current = l.toLowerCase(); continue; }
    const m = l.match(/^phase\s+\d+\s*@\s*([\d.]+)$/i);
    if (m && current && /^anim /.test(current)) {
      totals[current] = (totals[current] || 0) + parseFloat(m[1]);
    }
  }
  const vals = Object.values(totals);
  if (vals.length && Math.max(...vals) - Math.min(...vals) > 1.0) {
    errors.push(`track durations disagree: ${JSON.stringify(totals)}`);
  }

  // 4. resting glow must be off, or you get a stray warm halo
  if (!/^glowopacity\s+0(\.0+)?$/im.test(text)) {
    errors.push('View must set glowopacity 0.00');
  }

  // 5. every color is a real hex
  for (const m of text.matchAll(/^(colour|glowcolor|bgcolor2?)\s+(\S+)$/gim)) {
    if (!/^#[0-9a-f]{6}$/i.test(m[2])) errors.push(`bad color: ${m[1]} ${m[2]}`);
  }

  return { ok: errors.length === 0, errors };
}
```

**Retry once on failure**, appending the errors to the prompt — models
correct format mistakes reliably when told what broke:

```js
let { ok, errors } = validatePreset(text);
if (!ok) {
  text = await callGemini(`${description}\n\nYour previous attempt was invalid:\n${errors.join('\n')}\nFix these and return only the corrected preset.`);
  ({ ok, errors } = validatePreset(text));
}
if (!ok) return res.status(502).json({ error: 'could not generate a valid preset' });
```

---

## 5. Client wiring

Keep `index.html`'s footprint small. New module `describe-feeling.js`,
dynamically imported the way `field.js` / `sphere-core.js` already are
(see `index.html:1194` and `index.html:3719`):

```js
export async function generateFromDescription(description) {
  const r = await fetch('/api/generate-preset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'generation failed');
  return (await r.json()).preset;
}
```

Then in `index.html`, near the other panel wiring (~line 2044, where
`rp-describe-head` is already toggled):

```js
const describeBox   = document.getElementById('rp-describe-textarea');
const describeSpark = document.querySelector('.rp-sparkle');

describeBox.disabled = false;                    // drop the stub state
describeBox.placeholder = "e.g. 'a slow deep breath that ripples outward'";
describeSpark.title = 'Generate a preset from this description';

async function runGenerate() {
  const description = describeBox.value.trim();
  if (!description || describeSpark.dataset.busy) return;

  describeSpark.dataset.busy = '1';
  describeSpark.classList.add('rp-spinning');    // add a CSS spin/pulse
  describeBox.disabled = true;
  try {
    const { generateFromDescription } = await import('./describe-feeling.js');
    const preset = await generateFromDescription(description);
    await window.emotionSphere.applyPreset(preset);
    // Seed the name field so the result is savable/identifiable
    const nameEl = document.getElementById('rp-preset-name');
    if (nameEl && !nameEl.value) nameEl.value = description.slice(0, 60);
  } catch (err) {
    console.warn(err);
    // Surface it — a silent failure here is indistinguishable from a slow one
    alert('Could not generate a preset: ' + err.message);
  } finally {
    delete describeSpark.dataset.busy;
    describeSpark.classList.remove('rp-spinning');
    describeBox.disabled = false;
  }
}

describeSpark.addEventListener('click', runGenerate);
describeBox.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runGenerate();
});
```

**Also remember to:**
- Remove the `disabled` attribute from `index.html:52` in the markup itself.
- Guard against losing unsaved work — generation replaces the current look
  entirely. Reuse the existing `rpDirty` flag (`index.html:2051`) and the
  same confirm pattern as `rpStartNewPreset` (`index.html:2001`).

---

## 6. UX states worth building

Generation takes **3–10 seconds**. Without feedback it reads as broken:

| State | Treatment |
|---|---|
| Idle | Sparkle icon normal, box enabled |
| Generating | Spin/pulse the ✦, disable the box, ideally disable the Parameters sliders |
| Success | Sphere visibly changes — that's its own confirmation. Seed the name field. |
| Invalid after retry | Explicit message. Don't leave the old look up silently — the user will think it worked |
| Network/500 | Same. Log the real error to console, show a short message |

---

## 7. Local development

```bash
npm i -g vercel     # if you don't have it
vercel dev          # serves the static site AND runs api/ functions locally
# open http://localhost:3000
```

Plain `python3 -m http.server` **won't** run the `api/` function — you'll
get a 404 on `/api/generate-preset`. Use `vercel dev` once a backend exists.

---

## 8. Cost and abuse

The endpoint is public once deployed — anyone who finds `/api/generate-preset`
can spend your quota. For an internal team tool that's usually fine, but at
minimum:

- Cap `description` length (done in §3).
- Consider a simple rate limit (per-IP, in-memory is enough for a team tool).
- Watch usage in Google AI Studio for the first week.
- Flash-tier models make this genuinely cheap at team scale — check current
  pricing at [ai.google.dev/pricing](https://ai.google.dev/pricing) rather
  than trusting a number written here.

---

## 9. Testing checklist

- [ ] Key is in Vercel env vars and `.env.local`, committed nowhere
- [ ] A vivid description ("a panic attack", "drifting off to sleep") produces
      a visibly matching look
- [ ] Generated presets pass `validatePreset` — log failures for a week and
      see which rule trips most; that tells you what to strengthen in the prompt
- [ ] Nonsense input ("asdfgh") fails gracefully, doesn't blank the sphere
- [ ] All 3 layers change color — if layer 2/3 keep the *previous* preset's
      color, the model omitted them (the single most common failure; see the
      layer-count gotcha in `GEMINI_PRESET_CONTEXT.md` §3)
- [ ] No stray orange halo → resting `glowopacity` really is `0.00`
- [ ] The generated preset's phase durations sum equal across all 4 tracks
