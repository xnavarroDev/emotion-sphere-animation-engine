import { setPressed } from '../accessibility.js';

/**
 * Keeps the original view controls functional beside the redesigned editor.
 *
 * Preset files and regression workflows still address these element IDs, so
 * they remain compatibility inputs. Callbacks route every change into the
 * canonical scene state instead of allowing this older UI to own a second,
 * potentially divergent model.
 */
export function createLegacyViewControls({
  documentLike,
  getGradientAmount,
  getRotationEnabled,
  setGlowVisible,
  setFirefliesVisible,
  setGlowColor,
  setGlowOpacity,
  setPrimaryBackground,
  setSecondaryBackground,
  setGradientAmount,
  setRotationEnabled,
  setRotationSpeed,
}) {
  const glowButton = documentLike.getElementById('toggle-glow');
  const firefliesButton = documentLike.getElementById('toggle-fireflies');
  const glowColor = documentLike.getElementById('glow-color');
  const glowOpacity = documentLike.getElementById('glow-opacity');

  glowButton?.addEventListener('click', () => {
    const visible = glowButton.classList.toggle('active');
    setPressed(glowButton, visible);
    setGlowVisible(visible);
  });
  firefliesButton?.addEventListener('click', () => {
    const visible = firefliesButton.classList.toggle('active');
    setPressed(firefliesButton, visible);
    setFirefliesVisible(visible);
  });
  glowColor?.addEventListener('input', () => setGlowColor(glowColor.value));
  glowOpacity?.addEventListener('input', () => setGlowOpacity(Number.parseFloat(glowOpacity.value)));
  documentLike.getElementById('bg-color')?.addEventListener('input', event => {
    setPrimaryBackground(event.target.value);
  });
  documentLike.getElementById('bg-color-2')?.addEventListener('input', event => {
    setSecondaryBackground(event.target.value);
  });
  documentLike.getElementById('toggle-bg-gradient')?.addEventListener('click', () => {
    setGradientAmount(getGradientAmount() > 0 ? 0 : 1);
  });
  documentLike.getElementById('toggle-rotate')?.addEventListener('click', () => {
    setRotationEnabled(!getRotationEnabled());
  });
  documentLike.getElementById('rotate-speed')?.addEventListener('input', event => {
    setRotationSpeed(Number.parseFloat(event.target.value));
  });
}
