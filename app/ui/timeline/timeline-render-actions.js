import {
  insertPhaseColumnAfter,
  removePhaseColumn,
  toggleAnimationEnabled,
} from '../../animation/timeline-edit.js';

/**
 * Creates application commands used by the timeline renderer.
 *
 * DOM row adapters should only translate gestures into these commands. This
 * coordinator preserves the important cross-cutting rules: phase columns are
 * structural across every track, selection establishes the snapshot edit
 * target, and every authored mutation creates one dirty boundary and rebuild.
 */
export function createTimelineRenderActions({
  getTimelines,
  getEditingPhase,
  clearEditingPhase,
  setEditingPhase,
  setActiveTrack,
  applyTrackSnapshot,
  captureTrackSnapshot,
  cloneSnapshot,
  captureSnapshotForTrack,
  markDirty,
  render,
  tracksElement,
  syncParameters,
  syncLegacyLayers,
  getSceneEnabled,
  setSceneEnabled,
}) {
  function phaseActions({ phase, phaseIndex, trackIndex }) {
    return {
      select() {
        setActiveTrack(trackIndex);
        applyTrackSnapshot(phase.snapshot || captureTrackSnapshot());
        setEditingPhase(phase);
        render();
      },
      delete() {
        if (getEditingPhase() === phase) clearEditingPhase();
        removePhaseColumn(getTimelines(), phaseIndex);
        markDirty();
        render();
      },
      rename(nextName) {
        // A phase name describes one visual column, so propagate it across all
        // tracks instead of allowing contradictory labels for the same beat.
        for (const timeline of getTimelines()) {
          if (timeline[phaseIndex]) timeline[phaseIndex].name = nextName;
        }
        markDirty();
        render();
      },
      setDuration(nextDuration) {
        phase.duration = nextDuration;
        markDirty();
        render();
      },
      insertAfter() {
        insertPhaseColumnAfter({
          timelines: getTimelines(),
          phaseIndex,
          fallbackDuration: phase.duration,
          minimumDuration: 0.5,
          cloneSnapshot,
          captureSnapshot: captureSnapshotForTrack,
        });
        markDirty();
        render();
      },
    };
  }

  function trackActions({ trackIndex, isScene, layer, label }) {
    return {
      focus() {
        setActiveTrack(trackIndex);
        if (isScene) {
          render();
          return;
        }
        tracksElement.querySelectorAll('.rp-track-label.focused')
          .forEach(element => element.classList.remove('focused'));
        label.classList.add('focused');
        syncParameters();
      },
      rename(nextName) {
        layer.name = nextName;
        syncLegacyLayers();
        markDirty();
        syncParameters();
        render();
      },
      toggle() {
        if (isScene) setSceneEnabled(toggleAnimationEnabled(getSceneEnabled()));
        else layer.anim = toggleAnimationEnabled(layer.anim);
        markDirty();
        render();
      },
    };
  }

  return { phaseActions, trackActions };
}
