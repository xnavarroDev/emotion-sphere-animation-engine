const DEFAULT_SCENE_SETTINGS = Object.freeze({
  glowColor: '#ffffff',
  glowOpacity: 0,
  backgroundColor: '#000000',
  secondaryBackgroundColor: '#c9d0d6',
  gradientAmount: 0,
  rotationEnabled: false,
  rotationSpeed: 0.10,
});

/**
 * Create the canonical mutable state for settings shared by every layer.
 * Controls, presets, animation snapshots, and thumbnail transactions all
 * receive this same object instead of maintaining parallel global values.
 */
export function createSceneSettings(initial = {}) {
  const settings = { ...DEFAULT_SCENE_SETTINGS, ...initial };
  Object.defineProperty(settings, 'snapshot', {
    enumerable: false,
    value: () => ({
      glowColor: settings.glowColor,
      glowOpacity: settings.glowOpacity,
      backgroundColor: settings.backgroundColor,
      secondaryBackgroundColor: settings.secondaryBackgroundColor,
      gradientAmount: settings.gradientAmount,
      rotationEnabled: settings.rotationEnabled,
      rotationSpeed: settings.rotationSpeed,
    }),
  });
  return settings;
}
