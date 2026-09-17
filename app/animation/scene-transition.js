import { mixHex } from '../scene/color.js';

/**
 * Interpolate one Scene-track snapshot through explicit application adapters.
 *
 * The transition rules stay independent of DOM and Three.js state. Callers
 * provide small adapters for applying values, which keeps renderer ownership
 * visible and lets the same interpolation be tested without browser controls.
 */
export function applySceneSnapshotTransition(from, to, fraction, {
  classic,
  onClassicChange = () => {},
  onGlowOpacity = () => {},
  onGlowColor = () => {},
  onBackgroundColor = () => {},
  onSecondaryBackgroundColor = () => {},
  onGradientAmount = () => {},
  onBackgroundSync = () => {},
}) {
  const applied = {};
  if (from.classic && to.classic) {
    for (const key of Object.keys(from.classic)) {
      if (typeof from.classic[key] !== 'number' || typeof to.classic[key] !== 'number') continue;
      classic[key] = from.classic[key] + (to.classic[key] - from.classic[key]) * fraction;
    }
    applied.classic = classic;
    onClassicChange(classic);
  }
  if (typeof from.glowOpacity === 'number' && typeof to.glowOpacity === 'number') {
    applied.glowOpacity = from.glowOpacity + (to.glowOpacity - from.glowOpacity) * fraction;
    onGlowOpacity(applied.glowOpacity);
  }
  if (from.glowColor && to.glowColor) {
    applied.glowColor = mixHex(from.glowColor, to.glowColor, fraction);
    onGlowColor(applied.glowColor);
  }
  if (from.bgColor && to.bgColor) {
    applied.bgColor = mixHex(from.bgColor, to.bgColor, fraction);
    onBackgroundColor(applied.bgColor);
  }
  if (from.bgColor2 && to.bgColor2) {
    applied.bgColor2 = mixHex(from.bgColor2, to.bgColor2, fraction);
    onSecondaryBackgroundColor(applied.bgColor2);
  }
  if (typeof from.bgGradientAmount === 'number' && typeof to.bgGradientAmount === 'number') {
    applied.bgGradientAmount = from.bgGradientAmount
      + (to.bgGradientAmount - from.bgGradientAmount) * fraction;
    onGradientAmount(applied.bgGradientAmount);
  }
  // The card presenter also reflects values unaffected by a particular pair
  // of snapshots, so preserve the original unconditional final sync.
  onBackgroundSync();
  return applied;
}
