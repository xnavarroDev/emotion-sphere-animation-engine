/**
 * Coordinates live writes into the selected phase without owning timeline DOM.
 * The injected selection presenter is re-read after rendering because a full
 * timeline rebuild replaces the segment and swatch elements.
 */
export function createLivePhaseEditor({
  captureSnapshot,
  getSelection,
  segmentTint,
  invalidateTrack,
  getActiveTrackIndex,
  isTimelineOpen,
  render,
  onStop,
  schedule = setTimeout,
  cancel = clearTimeout,
  settleDelay = 600,
}) {
  let phase = null;
  let settleTimer = null;

  function flashSaved(element) {
    if (!element) return;
    element.classList.remove('rp-save-flash');
    // Reading layout lets repeated commits restart the same CSS animation.
    void element.offsetWidth;
    element.classList.add('rp-save-flash');
  }

  function commit() {
    if (!phase) return false;
    phase.snapshot = captureSnapshot();

    // Timing did not change, so repaint only the selected segment immediately.
    const phaseView = getSelection()?.getPhaseView(phase);
    if (phaseView) {
      phaseView.swatch.style.background = segmentTint(phase, phaseView.isScene, phaseView.pi);
    }

    // Snapshot contents are part of thumbnail cache identity. Invalidate now,
    // then wait until rapid slider updates settle before doing GPU work.
    invalidateTrack(getActiveTrackIndex());
    cancel(settleTimer);
    const savedPhase = phase;
    settleTimer = schedule(() => {
      if (isTimelineOpen()) render();
      const freshView = getSelection()?.getPhaseView(savedPhase);
      if (freshView) flashSaved(freshView.swatch);
    }, settleDelay);
    return true;
  }

  function clear() {
    phase = null;
    onStop();
  }

  return {
    get phase() { return phase; },
    setPhase(nextPhase) { phase = nextPhase; },
    clear,
    commit,
  };
}
