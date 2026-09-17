import { setPressed } from '../accessibility.js';

/**
 * Connects the whole-sphere rotation controls to application-owned state.
 *
 * Rotation is intentionally global: the rendered layers share one parent
 * group, so this control changes that group's orientation rather than any
 * layer's particle motion. The caller owns that scene mutation and undo;
 * this module owns only input events and their visible/accessible state.
 */
export function createRotationControls({
  documentLike,
  getState,
  setEnabled,
  setSpeed,
  onChange,
}) {
  const toggle = documentLike.getElementById('rp-rotate-toggle');
  const speedInput = documentLike.getElementById('rp-rotate-speed');
  const speedValue = documentLike.getElementById('rp-rotate-speed-val');
  const speedRow = documentLike.getElementById('rp-rotate-speed-row');

  function sync() {
    const { enabled, speed } = getState();
    toggle.classList.toggle('on', enabled);
    setPressed(toggle, enabled);
    speedRow.classList.toggle('disabled', !enabled);
    // Preset loads and playback may synchronize controls while the user is
    // dragging. Preserve the focused range input instead of moving it under
    // their pointer; its value label can still reflect canonical state.
    if (documentLike.activeElement !== speedInput) speedInput.value = speed;
    speedValue.textContent = Number(speed).toFixed(3);
  }

  toggle.addEventListener('click', () => {
    setEnabled(!getState().enabled);
    sync();
    onChange();
  });
  speedInput.addEventListener('input', () => {
    setSpeed(Number.parseFloat(speedInput.value));
    sync();
    onChange();
  });

  return { sync };
}
