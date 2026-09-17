/**
 * Run synchronous offscreen work against temporary live-scene state.
 * Restoration belongs in `finally`: GPU readback, canvas conversion, or a
 * future renderer adapter may throw, but the visible editor must never retain
 * the capture-only time, viewport, visibility, or parameter values.
 */
export function runRestorableCapture({ snapshot, capture, restore }) {
  const savedState = snapshot();
  try {
    return capture(savedState);
  } finally {
    restore(savedState);
  }
}
