// One canonical slider schema feeds both the legacy field panel and the
// redesigned parameter groups. Keeping ranges here prevents the two editors
// from silently accepting different values for the same renderer setting.
export const FIREFLY_SLIDER_DEFINITIONS = Object.freeze([
  ['count', 0, 600, 5],
  ['radius', 0.2, 4, 0.05],
  ['coreBias', 0.3, 3, 0.05],
  ['intensity', 0.2, 6, 0.05],
  ['hot', 0, 1, 0.02],
  ['size', 0.2, 3, 0.05],
  ['blinkSpeed', 0.1, 3, 0.05],
  ['blinkDepth', 0, 1, 0.02],
  ['wander', 0, 3, 0.05],
  ['breath', 0, 1, 0.02],
  ['breathSpeed', 0.1, 3, 0.05],
  ['pulse', 0, 1, 0.02],
  ['pulseSpeed', 0.1, 3, 0.05],
  ['ripple', 0, 1, 0.02],
  ['rippleSpeed', 0.1, 3, 0.05],
  ['rectFill', 0, 1, 0.02],
  ['spawnSpan', 0, 40, 0.5],
  ['orbit', 0, 2, 0.02],
  ['spin', -0.4, 0.4, 0.01],
  ['speed', 0.05, 2, 0.02],
]);

export const fireflyColorHex = color => `#${color.getHexString()}`;

/**
 * Builds the legacy firefly-layer editor and keeps it synchronized with the
 * active renderer layer. Layer creation/disposal stays in the application,
 * while this adapter owns DOM construction, value formatting, and focus-safe
 * refreshes during animation playback.
 */
export function createFireflyFieldControls({
  documentLike,
  getLayers,
  getActiveIndex,
  setActiveIndex,
  getActiveEmotion,
  isAnimating,
  isEditingPhase,
  onAdd,
  onSplit,
  onRemove,
  onSelectionSync = () => {},
  onPanelSync = () => {},
  setPressed,
}) {
  const controls = documentLike.getElementById('firefly-field-controls');
  const tabs = documentLike.getElementById('firefly-layer-tabs');
  const previous = documentLike.createElement('button');
  previous.type = 'button'; previous.className = 'ilayer-arrow'; previous.textContent = '\u2039';
  const title = documentLike.createElement('span'); title.className = 'ilayer-title';
  const next = documentLike.createElement('button');
  next.type = 'button'; next.className = 'ilayer-arrow'; next.textContent = '\u203a';
  tabs.append(previous, title, next);

  // Names are shared with timeline track labels, so notify the application on
  // every edit while preserving the caret during frequent playback refreshes.
  const nameInput = documentLike.createElement('input');
  nameInput.type = 'text'; nameInput.className = 'ilayer-name-input'; nameInput.maxLength = 40;
  tabs.after(nameInput);
  nameInput.addEventListener('input', () => {
    getLayers()[getActiveIndex()].name = nameInput.value.trim() || null;
    onSelectionSync();
  });

  const actions = documentLike.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;';
  const makeAction = (label, buttonTitle) => {
    const button = documentLike.createElement('button');
    button.type = 'button'; button.className = 'anim-cap'; button.style.flex = '1';
    button.textContent = label; button.title = buttonTitle;
    actions.appendChild(button);
    return button;
  };
  const add = makeAction('+ Add', 'New layer with default params');
  const split = makeAction('Split', 'Split this layer into two halves (params and colours copied)');
  const remove = makeAction('\u00d7 Remove', 'Delete this layer');
  tabs.after(actions);

  const applyAction = action => {
    const selected = action(getActiveIndex());
    if (selected == null) return;
    setActiveIndex(selected);
    sync();
  };
  add.addEventListener('click', () => applyAction(onAdd));
  split.addEventListener('click', () => applyAction(onSplit));
  remove.addEventListener('click', () => applyAction(onRemove));

  const colorRow = documentLike.createElement('div'); colorRow.className = 'row';
  const colorLabel = documentLike.createElement('span'); colorLabel.textContent = 'colour';
  const colorInput = documentLike.createElement('input'); colorInput.type = 'color';
  const colorReset = documentLike.createElement('button');
  colorReset.type = 'button'; colorReset.className = 'ilayer-reset';
  colorReset.textContent = '\u21ba'; colorReset.title = 'Follow emotion colour';
  colorRow.append(colorLabel, colorInput, colorReset); controls.appendChild(colorRow);
  colorInput.addEventListener('input', () => {
    getLayers()[getActiveIndex()].overrides[getActiveEmotion()] = colorInput.value;
    colorReset.classList.remove('on');
  });
  colorReset.addEventListener('click', () => {
    delete getLayers()[getActiveIndex()].overrides[getActiveEmotion()];
    sync();
  });

  const rows = {};
  for (const [key, min, max, step] of FIREFLY_SLIDER_DEFINITIONS) {
    const row = documentLike.createElement('label'); row.className = 'row';
    const label = documentLike.createElement('span'); label.textContent = key;
    const input = documentLike.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    const value = documentLike.createElement('em');
    row.append(label, input, value); controls.appendChild(row);
    input.addEventListener('input', () => {
      const number = Number.parseFloat(input.value);
      value.textContent = number.toFixed(step < 1 ? 2 : 0);
      const layer = getLayers()[getActiveIndex()];
      layer.setParams({ [key]: number });
      // Idle is the resting baseline. Timeline playback and phase editing own
      // temporary values and must not accidentally overwrite that baseline.
      if (!isAnimating() && !isEditingPhase()) layer.idle = { ...layer.params };
    });
    rows[key] = { input, value, step };
  }

  function sync() {
    const layers = getLayers();
    const activeIndex = Math.max(0, Math.min(getActiveIndex(), layers.length - 1));
    setActiveIndex(activeIndex);
    const layer = layers[activeIndex];
    const override = layer.overrides[getActiveEmotion()];
    title.textContent = `${activeIndex + 1} / ${layers.length}`;
    nameInput.placeholder = `Layer ${activeIndex + 1}`;
    if (documentLike.activeElement !== nameInput) nameInput.value = layer.name || '';
    onSelectionSync();
    if (documentLike.activeElement !== colorInput) colorInput.value = override || fireflyColorHex(layer.color());
    colorReset.classList.toggle('on', !override);
    setPressed(colorReset, !override);
    for (const [key, , , step] of FIREFLY_SLIDER_DEFINITIONS) {
      const { input, value } = rows[key];
      // Animation can refresh the panel every frame; do not fight the range
      // control currently held by the user.
      if (documentLike.activeElement !== input) input.value = layer.params[key];
      value.textContent = Number(layer.params[key]).toFixed(step < 1 ? 2 : 0);
    }
    onPanelSync();
  }

  previous.addEventListener('click', () => select(getActiveIndex() - 1, true));
  next.addEventListener('click', () => select(getActiveIndex() + 1, true));

  function select(index, wrap = false) {
    const count = getLayers().length;
    const selected = wrap ? (index + count) % count : Math.max(0, Math.min(index, count - 1));
    setActiveIndex(selected);
    sync();
  }

  return { select, sync };
}
