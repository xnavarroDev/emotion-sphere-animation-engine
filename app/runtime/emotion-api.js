export const DEFAULT_PRESET_FILES = Object.freeze({
  calm: 'presets/firefly-calm.txt',
  sad: 'presets/firefly-sad.txt',
  warm: 'presets/firefly-warm.txt',
  happy: 'presets/firefly-warm.txt',
  anger: 'presets/firefly-anger.txt',
  angry: 'presets/firefly-anger.txt',
});

/**
 * Build the small public runtime API used by kiosk pages and integrations.
 * Readiness and playback remain injected so this module cannot apply a preset
 * before independently loaded renderer layers exist.
 */
export function createEmotionSphereApi({
  presetFiles = DEFAULT_PRESET_FILES,
  fetchLike,
  applyPresetWhenReady,
  setAnimationSpeed = () => 1,
}) {
  return {
    emotions: Object.keys(presetFiles),
    play(name) {
      const normalized = String(name || '').toLowerCase();
      const file = presetFiles[normalized];
      if (!file) return Promise.reject(new Error(`unknown emotion: ${name}`));
      return fetchLike(file)
        .then(response => {
          if (!response.ok) throw new Error(`preset fetch failed: ${file}`);
          return response.text();
        })
        .then(applyPresetWhenReady);
    },
    // External generators use the same readiness gate as built-in emotions;
    // they never need access to authoring-panel internals.
    applyPreset(text) {
      // Normalize synchronous test/host adapters to the same promise contract
      // as fetched presets, including conversion of thrown errors to rejection.
      return Promise.resolve().then(() => applyPresetWhenReady(text));
    },
    // Hosts can change particle-layer playback without reaching into renderer
    // state. The renderer owns normalization and returns the applied value.
    setSpeed(multiplier) {
      return setAnimationSpeed(multiplier);
    },
  };
}
