/**
 * Own structural mutations for the shared firefly-layer array. Both editor
 * panels and preset restoration use this collection, so capacity, minimum
 * layer count, and renderer-resource disposal cannot drift between callers.
 */
export function createFireflyLayerCollection({
  factory,
  presets = [],
  overrides = [],
  minimumLayers = 1,
}) {
  const layers = presets.map((preset, index) => factory.create(preset, overrides[index]));

  function add(preset = {}, layerOverrides = {}) {
    if (layers.length >= factory.maxLayers) return null;
    const layer = factory.create(preset, layerOverrides);
    layers.push(layer);
    return layer;
  }

  function remove(index) {
    if (layers.length <= minimumLayers || !layers[index]) return null;
    factory.dispose(layers[index]);
    layers.splice(index, 1);
    return Math.min(index, layers.length - 1);
  }

  function removeLast() {
    if (layers.length <= minimumLayers) return false;
    factory.dispose(layers.pop());
    return true;
  }

  function split(index) {
    const source = layers[index];
    if (!source || layers.length >= factory.maxLayers) return null;
    const firstCount = Math.round(source.params.count / 2);
    const twin = factory.create(
      { ...source.params, count: source.params.count - firstCount },
      source.overrides,
    );
    // A split is a visual subdivision, so both halves retain animation and
    // the source's current resolved color rather than resetting to defaults.
    twin.anim = source.anim;
    twin.color().copy(source.color());
    source.setParams({ count: firstCount });
    layers.splice(index + 1, 0, twin);
    return index + 1;
  }

  return { add, layers, remove, removeLast, split };
}
