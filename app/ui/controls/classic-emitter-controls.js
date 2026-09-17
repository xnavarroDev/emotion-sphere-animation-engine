// This schema is the public editing surface for the older one-by-one emitter.
// Keeping it beside the DOM adapter makes range changes easy to review without
// mixing them into renderer setup or animation playback code.
export const CLASSIC_SLIDER_DEFINITIONS = Object.freeze([
  ['scale', 0.3, 2, 0.02],
  ['coreBias', 0.2, 3, 0.05],
  ['interval', 0.1, 3, 0.05],
  ['life', 1, 15, 0.1],
  ['fade', 0.1, 3, 0.05],
  ['swirl', 0, 1, 0.02],
  ['dotSize', 0.2, 3, 0.05],
  ['shellSize', 0.2, 3, 0.05],
  ['glowSize', 0.2, 3, 0.05],
  ['trailLife', 0, 4, 0.05],
]);

/**
 * Builds the legacy emitter sliders around a mutable state object.
 * Animation playback may call sync every frame, so focused inputs are never
 * overwritten while a person is actively dragging them.
 */
export function createClassicEmitterControls({ documentLike, state }) {
  const container = documentLike.getElementById('classic-controls');
  const rows = {};

  for (const [key, min, max, step] of CLASSIC_SLIDER_DEFINITIONS) {
    const row = documentLike.createElement('label'); row.className = 'row';
    const label = documentLike.createElement('span'); label.textContent = key;
    const input = documentLike.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    input.value = state[key];
    const value = documentLike.createElement('em');
    value.textContent = Number(state[key]).toFixed(2);
    row.append(label, input, value); container.appendChild(row);
    input.addEventListener('input', () => {
      state[key] = Number.parseFloat(input.value);
      value.textContent = state[key].toFixed(2);
    });
    rows[key] = { input, value };
  }

  function sync() {
    for (const [key] of CLASSIC_SLIDER_DEFINITIONS) {
      const { input, value } = rows[key];
      if (documentLike.activeElement !== input) input.value = state[key];
      value.textContent = Number(state[key]).toFixed(2);
    }
  }

  return { sync };
}
