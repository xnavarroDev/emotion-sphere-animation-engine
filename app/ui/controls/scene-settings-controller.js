import { mixHex } from '../../scene/color.js';
import { setPressed } from '../accessibility.js';

const clampUnit = value => Math.max(0, Math.min(1, value));

/**
 * Applies canonical scene settings to the legacy controls and page backdrop.
 *
 * Both preset restoration and modern controls call this adapter. Keeping the
 * DOM and renderer side effects together prevents either path from updating
 * state without also refreshing the visible gradient or compatibility UI.
 */
export function createSceneSettingsController({ documentLike, settings, sceneRuntime }) {
  function applyBackground() {
    const bottom = mixHex(
      settings.backgroundColor,
      settings.secondaryBackgroundColor,
      settings.gradientAmount,
    );
    sceneRuntime.setTransparentBackground();
    documentLike.body.style.background = `linear-gradient(to bottom, ${settings.backgroundColor}, ${bottom})`;
  }

  function setPrimaryColor(color) {
    settings.backgroundColor = color;
    const input = documentLike.getElementById('bg-color');
    if (input) input.value = color;
    applyBackground();
  }

  function setSecondaryColor(color) {
    settings.secondaryBackgroundColor = color;
    const input = documentLike.getElementById('bg-color-2');
    if (input) input.value = color;
    applyBackground();
  }

  function setGradientAmount(value) {
    settings.gradientAmount = clampUnit(value);
    const toggle = documentLike.getElementById('toggle-bg-gradient');
    const enabled = settings.gradientAmount > 0;
    toggle?.classList.toggle('active', enabled);
    setPressed(toggle, enabled);
    applyBackground();
  }

  function setRotationEnabled(enabled) {
    settings.rotationEnabled = enabled;
    const toggle = documentLike.getElementById('toggle-rotate');
    toggle?.classList.toggle('active', enabled);
    setPressed(toggle, enabled);
    const speed = documentLike.getElementById('rotate-speed');
    if (speed) speed.style.display = enabled ? '' : 'none';
  }

  function setRotationSpeed(value) {
    settings.rotationSpeed = value;
    const input = documentLike.getElementById('rotate-speed');
    if (input && documentLike.activeElement !== input) input.value = value;
  }

  return {
    applyBackground,
    setPrimaryColor,
    setSecondaryColor,
    setGradientAmount,
    setRotationEnabled,
    setRotationSpeed,
  };
}
