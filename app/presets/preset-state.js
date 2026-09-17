import { serializePresetDocument } from './preset-format.js';

/** Read key/precision pairs from generated slider rows. */
export function readSliderDefinitions(documentLike, selector, { excludeColour = false } = {}) {
  return [...documentLike.querySelectorAll(selector)]
    .map(row => [
      row.querySelector('span')?.textContent.trim(),
      Number.parseFloat(row.querySelector('input')?.step) || 1,
    ])
    .filter(([key]) => key && (!excludeColour || key !== 'colour'));
}

/**
 * Collect and serialize one complete live preset document.
 *
 * The text format remains owned by preset-format.js. This adapter only maps
 * generated controls and application state into that stable schema, keeping
 * DOM selectors out of the serializer and out of app.js.
 */
export function serializeLivePreset({
  documentLike,
  fireflyLayers,
  classic,
  sceneTimeline,
  sceneAnimation,
  viewState,
}) {
  const presetName = documentLike.getElementById('rp-preset-name')?.value.trim() || null;
  return serializePresetDocument({
    fireflySliderDefs: readSliderDefinitions(
      documentLike,
      '#firefly-field-controls .row',
      { excludeColour: true },
    ),
    fireflyLayers,
    classicSliderDefs: readSliderDefinitions(documentLike, '#classic-controls .row'),
    classic,
    scene: { anim: sceneAnimation, timeline: sceneTimeline },
    view: {
      ...viewState,
      glow: documentLike.getElementById('toggle-glow')?.classList.contains('active'),
      fireflies: documentLike.getElementById('toggle-fireflies')?.classList.contains('active'),
      presetName,
    },
  });
}
