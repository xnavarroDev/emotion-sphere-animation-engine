import { wireAccordionGroup } from '../shell/disclosures.js';

/**
 * Builds and synchronizes the per-layer parameter accordions.
 *
 * Group definitions describe presentation only. Particle-layer mutation,
 * idle-state policy, live-phase capture, and undo remain caller callbacks.
 * This keeps generated DOM reusable without making it aware of renderer data.
 */
export function createParameterGroups({
  documentLike,
  container,
  groups,
  sliderDefinitions,
  getState,
  onColorChange,
  onParameterChange,
  motionExtraRow,
}) {
  const definitionByKey = new Map(sliderDefinitions.map(definition => [definition[0], definition]));
  const sliderElements = new Map();
  let colorInput = null;

  for (const group of groups) {
    const wrapper = documentLike.createElement('div');
    wrapper.className = 'rp-group';
    const groupKey = group.name.toLowerCase();
    const header = documentLike.createElement('button');
    header.type = 'button';
    header.className = 'rp-group-head';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `<span>${group.name}</span><span class="chev"><img class="rp-ico rp-ico-18" src="icons/chevron-down.svg" alt=""></span>`;
    const body = documentLike.createElement('div');
    body.className = 'rp-group-body';
    body.id = `rp-${groupKey}-group-body`;
    header.setAttribute('aria-controls', body.id);

    if (group.color) {
      const row = documentLike.createElement('div');
      row.className = 'rp-color-row';
      const label = documentLike.createElement('span');
      label.textContent = 'colour';
      colorInput = documentLike.createElement('input');
      colorInput.type = 'color';
      colorInput.setAttribute('aria-label', `${group.name} layer colour`);
      colorInput.addEventListener('input', () => onColorChange(colorInput.value));
      row.append(label, colorInput);
      body.appendChild(row);
    }

    for (const key of group.keys) {
      const definition = definitionByKey.get(key);
      if (!definition) continue;
      const [, min, max, step] = definition;
      const row = documentLike.createElement('div');
      row.className = 'rp-slider-row';
      const label = documentLike.createElement('span');
      label.textContent = key;
      const input = documentLike.createElement('input');
      input.type = 'range';
      Object.assign(input, { min, max, step });
      input.setAttribute('aria-label', `${group.name} ${key}`);
      const value = documentLike.createElement('em');
      input.addEventListener('input', () => {
        const next = Number.parseFloat(input.value);
        value.textContent = next.toFixed(step < 1 ? 2 : 0);
        onParameterChange(key, next);
      });
      row.append(label, input, value);
      body.appendChild(row);
      sliderElements.set(key, { input, value, step });
    }

    // Whole-sphere rotation is global, but placing its existing row alongside
    // layer spin makes the distinction discoverable without duplicating it.
    if (group.name === 'Motion' && motionExtraRow) body.appendChild(motionExtraRow);
    wrapper.append(header, body);
    wireAccordionGroup({ trigger: header, group: wrapper });
    container.appendChild(wrapper);
  }

  function sync() {
    const { color, params } = getState();
    if (colorInput && documentLike.activeElement !== colorInput) colorInput.value = color;
    for (const [key, record] of sliderElements) {
      const current = params[key];
      // Animation playback may sync every frame; preserve a slider currently
      // under the pointer while still refreshing its canonical value label.
      if (documentLike.activeElement !== record.input) record.input.value = current;
      record.value.textContent = Number(current).toFixed(record.step < 1 ? 2 : 0);
    }
  }

  return { sync };
}
