import { setPressed, setSliderValue } from '../accessibility.js';

const clampUnit = value => Math.max(0, Math.min(1, value));

/**
 * Connects the Background parameter card to application-owned scene state.
 *
 * This controller owns DOM synchronization and input gestures only. The caller
 * remains responsible for changing renderer state, recording undo snapshots,
 * and updating a phase under live edit. That separation lets the same controls
 * reflect playback-driven state without teaching this module about animation.
 */
export function createBackgroundControls({
  documentLike,
  getState,
  setGlowColor,
  setGlowOpacity,
  setPrimaryColor,
  setSecondaryColor,
  setGradientAmount,
  onChange,
}) {
  const glowToggle = documentLike.getElementById('rp-glow-toggle');
  const glowColor = documentLike.getElementById('rp-glow-color');
  const glowOpacity = documentLike.getElementById('rp-glow-opacity');
  const glowOpacityValue = documentLike.getElementById('rp-glow-opacity-val');
  const primaryColor = documentLike.getElementById('rp-bg-color-a');
  const secondaryColor = documentLike.getElementById('rp-bg-color-b');
  const primaryStop = documentLike.getElementById('rp-bg-stop-a');
  const secondaryStop = documentLike.getElementById('rp-bg-stop-b');
  const gradientBar = documentLike.getElementById('rp-gradientbar');
  const gradientThumb = documentLike.getElementById('rp-gradient-thumb');
  const gradientToggle = documentLike.getElementById('rp-gradient-toggle');

  let lastGradientAmount = 1;
  let lastGlowOpacity = 1;

  function sync() {
    const state = getState();
    const glowEnabled = state.glowOpacity > 0;
    glowToggle.classList.toggle('on', glowEnabled);
    setPressed(glowToggle, glowEnabled);
    // Do not overwrite a focused native input while the user is manipulating
    // it; sync can run every animation frame when a scene track is playing.
    if (documentLike.activeElement !== glowColor) glowColor.value = state.glowColor;
    if (documentLike.activeElement !== glowOpacity) glowOpacity.value = state.glowOpacity;
    glowOpacityValue.textContent = Number(state.glowOpacity).toFixed(2);
    primaryColor.value = state.primaryColor;
    secondaryColor.value = state.secondaryColor;
    primaryStop.style.background = state.primaryColor;
    secondaryStop.style.background = state.secondaryColor;
    gradientBar.style.background = `linear-gradient(to right, ${state.primaryColor}, ${state.secondaryColor})`;
    gradientThumb.style.left = `${state.gradientAmount * 100}%`;
    gradientToggle.textContent = state.gradientAmount > 0 ? 'on' : 'off';
    setPressed(gradientToggle, state.gradientAmount > 0);
    const gradientPercent = Math.round(state.gradientAmount * 100);
    setSliderValue(gradientThumb, gradientPercent, `${gradientPercent}% blend`);
  }

  function commit(change) {
    change();
    sync();
    onChange();
  }

  // "Off" is represented by opacity zero rather than a separate visibility
  // flag. Opacity is captured and interpolated per phase, so this makes the
  // toggle animate naturally and avoids fighting renderer visibility used by
  // isolated thumbnail capture.
  glowToggle.addEventListener('click', () => {
    const current = getState().glowOpacity;
    if (current > 0) lastGlowOpacity = current;
    commit(() => setGlowOpacity(current > 0 ? 0 : lastGlowOpacity || 1));
  });
  glowColor.addEventListener('input', () => commit(() => setGlowColor(glowColor.value)));
  glowOpacity.addEventListener('input', () => {
    commit(() => setGlowOpacity(Number.parseFloat(glowOpacity.value)));
  });
  primaryStop.addEventListener('click', () => primaryColor.click());
  secondaryStop.addEventListener('click', () => secondaryColor.click());
  primaryColor.addEventListener('input', () => commit(() => setPrimaryColor(primaryColor.value)));
  secondaryColor.addEventListener('input', () => commit(() => setSecondaryColor(secondaryColor.value)));
  gradientToggle.addEventListener('click', () => {
    const current = getState().gradientAmount;
    if (current > 0) lastGradientAmount = current;
    commit(() => setGradientAmount(current > 0 ? 0 : lastGradientAmount || 1));
  });

  let draggingGradient = false;
  function commitGradientAmount(amount) {
    commit(() => setGradientAmount(clampUnit(amount)));
  }
  function setGradientFromClientX(clientX) {
    const rect = gradientBar.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    commitGradientAmount((clientX - rect.left) / rect.width);
  }
  gradientThumb.addEventListener('pointerdown', event => {
    draggingGradient = true;
    try { gradientThumb.setPointerCapture(event.pointerId); } catch (_) { /* Pointer may already be gone. */ }
    setGradientFromClientX(event.clientX);
  });
  gradientThumb.addEventListener('pointermove', event => {
    if (draggingGradient) setGradientFromClientX(event.clientX);
  });
  const finishGradientDrag = event => {
    draggingGradient = false;
    try { gradientThumb.releasePointerCapture(event.pointerId); } catch (_) { /* Cancellation releases capture automatically. */ }
  };
  gradientThumb.addEventListener('pointerup', finishGradientDrag);
  gradientThumb.addEventListener('pointercancel', finishGradientDrag);
  gradientThumb.addEventListener('keydown', event => {
    const current = getState().gradientAmount;
    let next = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - 0.05;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + 0.05;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 1;
    if (next === null) return;
    event.preventDefault();
    commitGradientAmount(next);
  });

  return { sync };
}
