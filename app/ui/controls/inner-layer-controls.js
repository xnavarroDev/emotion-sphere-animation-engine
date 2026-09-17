/**
 * Builds the compatibility editor for canvas-based inner particle layers.
 * The adapter owns navigation, color overrides, clipboard text, and feedback;
 * renderer defaults and timeline capture remain application callbacks because
 * they depend on scene-wide state.
 */
export function createInnerLayerControls({
  documentLike,
  clipboard,
  sliderDefinitions,
  getLayers,
  getActiveEmotion,
  getFallbackColor,
  hexToRgb,
  rgbToHex,
  resetLayer,
  capturePhase,
  setPressed,
  schedule = setTimeout,
}) {
  const tabs = documentLike.getElementById('inner-layer-tabs');
  const actions = documentLike.getElementById('inner-layer-actions');
  const controls = documentLike.getElementById('inner-layer-controls');
  if (!tabs || !controls) return null;
  let activeIndex = 0;

  const flash = (button, message) => {
    const original = button.textContent;
    button.textContent = message;
    schedule(() => { button.textContent = original; }, 1200);
  };
  const makeButton = (text, title = '') => {
    const button = documentLike.createElement('button');
    button.type = 'button'; button.textContent = text; button.title = title;
    return button;
  };
  const copy = makeButton('Copy');
  const paste = makeButton('Paste');
  const reset = makeButton('↺', 'Reset this layer to defaults');
  const phase = makeButton('+ Phase', 'Add current state as a new animation phase');
  actions.append(copy, paste, reset, phase);

  const previous = makeButton('‹'); previous.className = 'ilayer-arrow';
  const title = documentLike.createElement('span'); title.className = 'ilayer-title';
  const next = makeButton('›'); next.className = 'ilayer-arrow';
  tabs.append(previous, title, next);

  const colorRow = documentLike.createElement('div'); colorRow.className = 'row';
  const colorLabel = documentLike.createElement('span'); colorLabel.textContent = 'colour';
  const colorInput = documentLike.createElement('input'); colorInput.type = 'color';
  const colorReset = makeButton('↺', 'Follow emotion colour'); colorReset.className = 'ilayer-reset';
  colorRow.append(colorLabel, colorInput, colorReset); controls.appendChild(colorRow);

  colorInput.addEventListener('input', () => {
    getLayers()[activeIndex].overrides[getActiveEmotion()] = hexToRgb(colorInput.value);
    colorReset.classList.remove('on');
  });
  colorReset.addEventListener('click', () => {
    delete getLayers()[activeIndex].overrides[getActiveEmotion()];
    sync();
  });

  const rows = {};
  for (const [key, min, max, step] of sliderDefinitions) {
    const row = documentLike.createElement('label'); row.className = 'row';
    const label = documentLike.createElement('span'); label.textContent = key;
    const input = documentLike.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    const value = documentLike.createElement('em');
    row.append(label, input, value); controls.appendChild(row);
    input.addEventListener('input', () => {
      const number = Number.parseFloat(input.value);
      value.textContent = number.toFixed(step < 1 ? 2 : 0);
      getLayers()[activeIndex].field.setParams({ [key]: number });
    });
    rows[key] = { input, value };
  }

  function sync() {
    const layers = getLayers();
    activeIndex = Math.max(0, Math.min(activeIndex, layers.length - 1));
    const layer = layers[activeIndex];
    const override = layer.overrides[getActiveEmotion()];
    title.textContent = `Layer ${activeIndex + 1} / ${layers.length}`;
    colorInput.value = rgbToHex(override || getFallbackColor());
    colorReset.classList.toggle('on', !override);
    setPressed(colorReset, !override);
    for (const [key, , , step] of sliderDefinitions) {
      const { input, value } = rows[key];
      input.value = layer.field.params[key];
      value.textContent = Number(layer.field.params[key]).toFixed(step < 1 ? 2 : 0);
    }
  }

  previous.addEventListener('click', () => { activeIndex = (activeIndex - 1 + getLayers().length) % getLayers().length; sync(); });
  next.addEventListener('click', () => { activeIndex = (activeIndex + 1) % getLayers().length; sync(); });
  reset.addEventListener('click', () => { resetLayer(activeIndex); sync(); });

  copy.addEventListener('click', () => {
    const layer = getLayers()[activeIndex];
    const lines = [`Layer ${activeIndex + 1}`];
    for (const [key, , , step] of sliderDefinitions) {
      const value = layer.field.params[key];
      if (typeof value === 'number') lines.push(`${key} ${value.toFixed(step < 1 ? 2 : 0)}`);
    }
    for (const [emotion, color] of Object.entries(layer.overrides)) lines.push(`@${emotion} ${rgbToHex(color)}`);
    clipboard?.writeText(lines.join('\n')).then(() => flash(copy, 'Copied')).catch(() => flash(copy, 'Failed'));
  });
  paste.addEventListener('click', () => {
    if (!clipboard?.readText) { flash(paste, 'No clip'); return; }
    clipboard.readText().then(text => {
      if (!text?.trim()) { flash(paste, 'Empty'); return; }
      try {
        const layer = getLayers()[activeIndex];
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.trim();
          let match = line.match(/^@(\w+)\s+(#[0-9a-fA-F]{6})$/);
          if (match) { layer.overrides[match[1].toLowerCase()] = hexToRgb(match[2]); continue; }
          match = line.match(/^([a-zA-Z]\w*)\s+(-?[\d.]+)$/);
          if (match) layer.field.setParams({ [match[1]]: Number.parseFloat(match[2]) });
        }
        sync(); flash(paste, 'Loaded');
      } catch { flash(paste, 'Failed'); }
    }).catch(() => flash(paste, 'Failed'));
  });
  phase.addEventListener('click', () => {
    capturePhase();
    flash(phase, 'Added!');
    documentLike.getElementById('anim-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  sync();
  return { sync };
}
