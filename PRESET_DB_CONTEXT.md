# Saved-presets persistence — reference for whoever wires up the database

This is the reference doc for whoever builds real save/browse/delete for
**user-created presets**. Right now there is no backend at all — this is a
static site with zero server code — so this is greenfield: pick a DB, add
serverless functions, wire three existing (currently stubbed/disabled) UI
spots to them.

---

## 1. Current state (what's real vs. stubbed)

- **"save to presets" button** (`#rp-save-btn`, [index.html:102](index.html#L102),
  handler at [index.html:1780](index.html#L1780)) — currently just copies the
  preset text to the clipboard. Does not persist anywhere.
- **"Browse saved presets" button** (`#rp-browse-btn`, [index.html:39](index.html#L39))
  — `disabled`, title says "Saving and browsing your own custom presets isn't
  built yet". No browse UI exists yet at all.
- **The 3 cards + arrow row** (`.rp-card-stub` x3, `.rp-cards-arrow`,
  [index.html:41-44](index.html#L41-L44), wired at
  [index.html:1730-1752](index.html#L1730-L1752)) — currently cycle through
  the 4 **built-in** emotion presets (calm/sad/warm/anger) via
  `window.emotionSphere.play(emo)`. This is a quick-load shortcut for the
  built-ins, not the saved-presets browser — leave this behavior alone and
  build saved-preset browsing as its own thing (see §4).
- **Preset name field** (`#rp-preset-name`, [index.html:98](index.html#L98)) —
  already tracks a name + dirty state (`rpPresetName`, `rpDirty`,
  [index.html:1771-1778](index.html#L1771-L1778)). Reuse this as the name for
  a saved preset.
- The 4 built-in presets live as static files in `presets/*.txt` and are
  **not** what you're building — those stay as shipped files. You're adding
  storage for presets the team creates in the tool.

## 2. The data itself

A preset is a single opaque plain-text blob (the exact format described in
`GEMINI_PRESET_CONTEXT.md` §3, if you want the grammar — you don't need to
parse it, just store/retrieve it as text). It's produced by `paramsToText()`
([index.html:2608](index.html#L2608)) and consumed by
`window.emotionSphere.applyPreset(text)` ([index.html:2886](index.html#L2886)).

Treat it as a string. Don't parse or validate its internal structure — that's
the tool's job, not the DB layer's.

Minimal schema:

| column | type | notes |
|---|---|---|
| `id` | uuid / serial | pk |
| `name` | text | from `#rp-preset-name`; not unique, no enforced constraint needed |
| `preset_text` | text | full output of `paramsToText()` |
| `created_at` | timestamp | default now() |

No auth/multi-tenancy exists in this app (it's an internal team tool, no
login system) — a single shared table is fine. Don't build user accounts
unless someone explicitly asks for that.

## 3. Suggested architecture

This is deployed on Vercel as a static site with **no build step** (see
README.md "Run locally" / "Deployment"). Keep it that way:

- **API**: Vercel Serverless Functions under `api/` (e.g. `api/presets.js`
  handling GET/POST, `api/presets/[id].js` handling DELETE). Vercel picks
  these up automatically — no framework needed, no change to how the rest of
  the site deploys (`npx vercel --prod` still just works).
- **DB**: Vercel Postgres (or Neon/Supabase Postgres, which Vercel also
  integrates with) is the path of least friction given the existing Vercel
  project — but pick whatever you're fastest with, it's one small table.
- **Env vars**: put the DB connection string in Vercel project env vars
  (`.env.local` already exists locally for other secrets — follow the same
  pattern, don't commit credentials).

## 4. Suggested API contract

```
GET    /api/presets        -> [{ id, name, created_at }, ...]   (list, no full text — keep it light)
GET    /api/presets/:id    -> { id, name, preset_text, created_at }
POST   /api/presets        <- { name, preset_text }             -> { id }
DELETE /api/presets/:id
```

(Rename/update is a maybe — not clearly needed yet; skip it unless asked.)

## 5. Wiring points in the UI

Keep your footprint in `index.html` small — write your logic in a new module
(e.g. `presets-store.js`, dynamically imported the same way
`field.js`/`firefly-field.js`/`sphere-core.js` already are, see
[index.html:1034](index.html#L1034) and
[index.html:2568](index.html#L2568)) exposing something like:

```js
export async function listPresets() { ... }        // GET /api/presets
export async function loadPreset(id) { ... }        // GET /api/presets/:id -> preset_text
export async function savePreset(name, text) { ... } // POST /api/presets
export async function deletePreset(id) { ... }       // DELETE /api/presets/:id
```

Then in `index.html`:

1. **Save**: in the `#rp-save-btn` handler ([index.html:1780](index.html#L1780)),
   call `savePreset(rpPresetName, paramsToText())` alongside (or instead of)
   the clipboard copy.
2. **Browse**: enable `#rp-browse-btn` (drop `disabled`, update the title),
   wire it to open a list (new small panel/modal — match the existing
   `.rp-float-card` pattern used for Background/Animation, e.g.
   [index.html:107](index.html#L107)) populated from `listPresets()`.
   Clicking an entry: `loadPreset(id)` then
   `window.emotionSphere.applyPreset(text)` — same entry point the Gemini
   integration uses, so this is the shared "apply a preset" seam.
3. **Delete**: a trash icon (already in `icons/trash.svg`, used elsewhere for
   layer-clear) per row in the browse list, calling `deletePreset(id)`.
4. Once browsing works, you can drop `.rp-stub-note`
   ([index.html:46](index.html#L46)).

Leave `RP_BUILTIN_PRESETS` / the cards-row quick-load
([index.html:1730-1752](index.html#L1730-L1752)) untouched — that's a
separate, already-finished feature for the 4 shipped emotions.
