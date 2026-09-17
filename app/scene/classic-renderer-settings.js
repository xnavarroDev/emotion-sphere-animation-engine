const CLASSIC_RENDERER_DEFAULTS = Object.freeze({
  scale: 1,
  coreBias: 0.45,
  interval: 0.65,
  life: 5.8,
  fade: 1.2,
  swirl: 0.34,
  dotSize: 1,
  shellSize: 1,
  glowSize: 1,
  trailLife: 1.55,
});

/**
 * Creates mutable settings for the retained one-by-one particle renderer.
 * Presets and scene animation intentionally mutate this object in place, while
 * fresh construction always starts from an untouched authored baseline.
 */
export function createClassicRendererSettings(overrides = {}) {
  return { ...CLASSIC_RENDERER_DEFAULTS, ...overrides };
}
