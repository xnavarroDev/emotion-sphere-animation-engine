/**
 * Connects pure Scene-track interpolation to mutable renderer and control state.
 *
 * The transition math only emits values. This adapter applies those values to
 * canonical scene settings, the cloud renderer, compatibility inputs, and the
 * modern control card without embedding browser concerns in interpolation.
 */
export function createSceneTransitionAdapters({
  documentLike,
  classic,
  sceneSettings,
  cloud,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setGradientAmount,
  syncClassic,
  syncBackground,
}) {
  return {
    classic,
    onClassicChange: syncClassic,
    onGlowOpacity(opacity) {
      sceneSettings.glowOpacity = opacity;
      cloud.setUserTint(null, opacity);
      const input = documentLike.getElementById('glow-opacity');
      if (input && documentLike.activeElement !== input) input.value = opacity;
    },
    onGlowColor(color) {
      sceneSettings.glowColor = color;
      cloud.setUserTint(color, null);
      const input = documentLike.getElementById('glow-color');
      if (input && documentLike.activeElement !== input) input.value = color;
    },
    onBackgroundColor: setBackgroundColor,
    onSecondaryBackgroundColor: setSecondaryBackgroundColor,
    onGradientAmount: setGradientAmount,
    onBackgroundSync: syncBackground,
  };
}
