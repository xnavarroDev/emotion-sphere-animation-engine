/** Set every particle system to an empty population without changing its look. */
export function zeroParticleLayers({ innerLayers, fireflyLayers }) {
  for (const layer of innerLayers) layer.field.setParams({ count: 0 });
  for (const layer of fireflyLayers) layer.setParams({ count: 0 });
}

/**
 * Restore the authored layer count, parameters, color overrides, and animation
 * flags. The caller supplies allocation/disposal because those operations own
 * Three.js resources and must remain coupled to the active scene lifecycle.
 */
export function restoreDefaultLayerConfiguration({
  innerLayers,
  fireflyLayers,
  innerDefaults,
  innerPresets,
  fireflyDefaults,
  fireflyPresets,
  fireflyOverrides,
  createFireflyLayer,
  disposeFireflyLayer,
}) {
  innerLayers.forEach((layer, index) => {
    layer.field.setParams({
      ...innerDefaults,
      background: [0, 0, 0, 0],
      glowOscAmp: 0,
      breathAmp: 0,
      breathSpeed: 0,
      ...innerPresets[index],
    });
  });

  while (fireflyLayers.length > fireflyPresets.length) {
    disposeFireflyLayer(fireflyLayers.pop());
  }
  while (fireflyLayers.length < fireflyPresets.length) {
    fireflyLayers.push(createFireflyLayer());
  }
  fireflyLayers.forEach((layer, index) => {
    layer.setParams({ ...fireflyDefaults, ...fireflyPresets[index] });
    // Each layer needs its own map; sharing would let one color edit leak into
    // another layer or mutate the authored defaults used by later resets.
    layer.overrides = { ...fireflyOverrides[index] };
    layer.anim = true;
  });
}

/** Restart birth clocks without altering count, radius, color, or timelines. */
export function respawnFireflyLayers(layers) {
  for (const layer of layers) layer.respawn?.();
}
