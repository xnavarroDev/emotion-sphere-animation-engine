/**
 * Stable text boundary for saved and shared presets.
 * Serialization emits the current format; parsing also recognizes historical
 * section names so compatibility remains isolated from restoration logic.
 */
function formatNumber(value, digits) {
  return Number(value).toFixed(digits);
}

export function serializePresetDocument(state) {
  const lines = [];

  state.fireflyLayers.forEach((layer, index) => {
    if (index > 0) lines.push('');
    lines.push(`Firefly Layer ${index + 1}`);
    if (layer.name) lines.push(`name ${layer.name}`);
    for (const [key, step] of state.fireflySliderDefs) {
      const value = layer.params[key];
      if (typeof value === 'number') {
        lines.push(`${key} ${formatNumber(value, step < 1 ? 2 : 0)}`);
      }
    }
    for (const [emotion, colour] of Object.entries(layer.overrides)) {
      lines.push(`@${emotion} ${colour}`);
    }
  });

  lines.push('', 'Classic');
  for (const [key, step] of state.classicSliderDefs) {
    const value = state.classic[key];
    if (typeof value === 'number') {
      lines.push(`${key} ${formatNumber(value, step < 1 ? 2 : 0)}`);
    }
  }

  state.fireflyLayers.forEach((layer, index) => {
    lines.push('', `Anim Layer ${index + 1}`, `animate ${layer.anim === false ? 0 : 1}`);
    layer.timeline.forEach((phase, phaseIndex) => {
      lines.push(`Phase ${phaseIndex + 1} @ ${formatNumber(phase.duration, 2)}`);
      if (phase.ease) lines.push(`ease ${phase.ease}`);
      if (phase.name) lines.push(`name ${phase.name}`);
      if (phase.snapshot?.params) {
        for (const [key, value] of Object.entries(phase.snapshot.params)) {
          if (typeof value === 'number') lines.push(`${key} ${formatNumber(value, 3)}`);
        }
      }
      if (phase.snapshot?.colour) lines.push(`colour ${phase.snapshot.colour}`);
    });
  });

  lines.push('', 'Anim Scene', `animate ${state.scene.anim === false ? 0 : 1}`);
  state.scene.timeline.forEach((phase, phaseIndex) => {
    lines.push(`Phase ${phaseIndex + 1} @ ${formatNumber(phase.duration, 2)}`);
    if (phase.ease) lines.push(`ease ${phase.ease}`);
    if (phase.name) lines.push(`name ${phase.name}`);
    if (phase.snapshot?.classic) {
      for (const [key, value] of Object.entries(phase.snapshot.classic)) {
        if (typeof value === 'number') lines.push(`${key} ${formatNumber(value, 3)}`);
      }
    }
    if (typeof phase.snapshot?.glowOpacity === 'number') {
      lines.push(`glowopacity ${formatNumber(phase.snapshot.glowOpacity, 2)}`);
    }
    if (phase.snapshot?.glowColor) lines.push(`glowcolor ${phase.snapshot.glowColor}`);
    if (phase.snapshot?.bgColor) lines.push(`bgcolor ${phase.snapshot.bgColor}`);
    if (phase.snapshot?.bgColor2) lines.push(`bgcolor2 ${phase.snapshot.bgColor2}`);
    if (typeof phase.snapshot?.bgGradientAmount === 'number') {
      lines.push(`bggradient ${formatNumber(phase.snapshot.bgGradientAmount, 2)}`);
    }
  });

  const view = state.view;
  lines.push('', 'View',
    `emotion ${view.emotion}`,
    `mode ${view.mode}`,
    `loop ${view.loop ? 1 : 0}`,
    `glow ${view.glow ? 1 : 0}`,
    `fireflies ${view.fireflies ? 1 : 0}`,
    `glowcolor ${view.glowColor}`,
    `glowopacity ${formatNumber(view.glowOpacity, 2)}`,
    `bgcolor ${view.bgColor}`,
    `bgcolor2 ${view.bgColor2}`,
    `bggradient ${formatNumber(view.bgGradientAmount, 2)}`,
    `rotate ${view.rotate ? 1 : 0}`,
    `rotatespeed ${formatNumber(view.rotateSpeed, 3)}`);
  if (view.presetName) lines.push(`presetname ${view.presetName}`);

  return lines.join('\n');
}

export function parsePresetDocument(text) {
  const tokens = [];
  let section = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (/^core particles$/i.test(line)) {
      section = 'core';
      tokens.push({ type: 'section', section });
      continue;
    }

    let match = line.match(/^layer\s+(\d+)$/i);
    if (match) {
      section = 'layer';
      tokens.push({ type: 'section', section, index: Number(match[1]) - 1 });
      continue;
    }

    if (/^firefly field$/i.test(line)) {
      section = 'firefly';
      tokens.push({ type: 'section', section, index: 0, legacy: true });
      continue;
    }

    match = line.match(/^firefly layer\s+(\d+)$/i);
    if (match) {
      section = 'firefly';
      tokens.push({ type: 'section', section, index: Number(match[1]) - 1 });
      continue;
    }

    match = line.match(/^anim layer\s+(\d+)$/i);
    if (match) {
      section = 'animation';
      tokens.push({ type: 'section', section, index: Number(match[1]) - 1 });
      continue;
    }

    if (/^anim scene$/i.test(line)) {
      section = 'animation';
      tokens.push({ type: 'section', section, index: -2 });
      continue;
    }

    if (/^classic$/i.test(line)) {
      section = 'classic';
      tokens.push({ type: 'section', section });
      continue;
    }

    if (/^(view|toggles)$/i.test(line)) {
      section = 'view';
      tokens.push({ type: 'section', section });
      continue;
    }

    match = line.match(/^phase\s+\d+\s*@\s*(-?[\d.]+)$/i);
    if (match && section === 'animation') {
      tokens.push({ type: 'phase', duration: Math.max(0.1, Number.parseFloat(match[1]) || 5) });
      continue;
    }

    match = line.match(/^ease\s+(\w+)$/i);
    if (match && section === 'animation') {
      tokens.push({ type: 'ease', value: match[1].toLowerCase() });
      continue;
    }

    match = line.match(/^mode\s+(circles|fireflies)$/i);
    if (match) {
      tokens.push({ type: 'mode', value: match[1].toLowerCase() });
      continue;
    }

    match = line.match(/^@(\w+)\s+(#[0-9a-fA-F]{6})$/);
    if (match) {
      tokens.push({ type: 'override', emotion: match[1].toLowerCase(), colour: match[2] });
      continue;
    }

    match = line.match(/^name\s+(.+)$/i);
    if (match) {
      tokens.push({ type: 'name', value: match[1].trim() });
      continue;
    }

    match = line.match(/^colour\s+(#[0-9a-fA-F]{6})$/i);
    if (match) {
      tokens.push({ type: 'colour', value: match[1] });
      continue;
    }

    match = line.match(/^emotion\s+(\w+)$/i);
    if (match) {
      tokens.push({ type: 'emotion', value: match[1].toLowerCase() });
      continue;
    }

    match = line.match(/^presetname\s+(.+)$/i);
    if (match) {
      tokens.push({ type: 'presetName', value: match[1].trim() });
      continue;
    }

    match = line.match(/^(glowcolor|bgcolor2|bgcolor)\s+(#[0-9a-fA-F]{6})$/i);
    if (match) {
      tokens.push({ type: 'colourSetting', key: match[1].toLowerCase(), value: match[2] });
      continue;
    }

    match = line.match(/^([a-zA-Z]\w*)\s+(-?[\d.]+)$/);
    if (match) {
      tokens.push({ type: 'number', key: match[1], value: Number.parseFloat(match[2]) });
    }
  }

  return {
    tokens,
    hasFireflyLayers: tokens.some(token => token.type === 'section' && token.section === 'firefly' && !token.legacy),
    hasInnerLayers: tokens.some(token => token.type === 'section' && token.section === 'layer'),
  };
}
