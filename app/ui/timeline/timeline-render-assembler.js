import { createPhaseElements, createTrackElements, createTrackToggle } from './timeline-elements.js';
import { wireTimelinePhaseRow } from './timeline-phase-row.js';
import { wireTimelineTrackLabel } from './timeline-track-label.js';

/**
 * Builds timeline track rows from an already-derived render model.
 *
 * This module owns DOM composition and event-adapter wiring only. Timeline
 * mutation remains in `timeline-render-actions`, while shared measurements and
 * overlays remain in `timeline-render-finalizer`. Keeping those responsibilities
 * separate makes a full rebuild readable without mixing it with application state.
 */
export function assembleTimelineTracks({
  documentLike,
  windowLike,
  renderModel,
  laneWidth,
  thumbnailsEnabled,
  tracksElement,
  actions,
  selection,
  gestures,
  lanes,
  wireResize,
  openEasingMenu,
  trackFactory = createTrackElements,
  phaseFactory = createPhaseElements,
  toggleFactory = createTrackToggle,
  wirePhase = wireTimelinePhaseRow,
  wireTrack = wireTimelineTrackLabel,
}) {
  const pendingThumbnailSegments = [];
  let referenceLane = null;

  for (const trackModel of renderModel.tracks) {
    const {
      index: trackIndex,
      isScene,
      layer,
      timeline,
      label: trackLabel,
      focused,
      enabled,
      phases,
    } = trackModel;
    const elements = trackFactory({
      documentLike,
      labelText: trackLabel,
      laneWidth,
      isEmpty: timeline.length === 0,
    });
    const {
      track, label, lane, labelsRow, durationsRow, bracketsRow,
      segmentsRow, toggleWrapper, viewport,
    } = elements;

    // Resize gestures update these stable records in place, preserving the
    // pointer capture that would be lost if the lane were rebuilt mid-drag.
    const laneRecords = [];
    lane._timeline = timeline;
    lane._segs = laneRecords;

    for (const phaseModel of phases) {
      const {
        phase, phaseIndex, widthPercent, leftPercent, midpointPercent,
        startSeconds, shownName, easingTitle, editing, tint, hasSeam,
      } = phaseModel;
      const phaseElements = phaseFactory({
        documentLike,
        leftPercent,
        widthPercent,
        midpointPercent,
        tint,
        shownName,
        duration: phase.duration,
        easingTitle,
        editing,
        hasSeam,
      });
      const {
        segment, swatch, resizeLeft, resizeRight, deleteButton, name,
        bracket, bracketLeft, bracketRight, durationElement, durationText,
        easingIcon, seam,
      } = phaseElements;

      // Thumbnail slot widths require the final lane pixel width, so capture
      // identity now and defer rendering until every row is attached.
      if (thumbnailsEnabled) {
        pendingThumbnailSegments.push({
          segment,
          phase,
          phaseStartSeconds: startSeconds,
          trackIndex,
        });
      }
      const phaseActions = actions.phaseActions({ phase, phaseIndex, trackIndex });
      wirePhase({
        documentLike,
        windowLike,
        phase,
        phaseIndex,
        lane,
        isScene,
        displayedName: shownName,
        elements: {
          segment, swatch, resizeLeft, resizeRight, deleteButton, name,
          bracketLeft, bracketRight, durationText, easingIcon, seam,
        },
        selection,
        wasLaneDrag: () => gestures.wasLaneDrag(),
        wireResize,
        onSelect: phaseActions.select,
        onDelete: phaseActions.delete,
        onRename: phaseActions.rename,
        onDuration: phaseActions.setDuration,
        onEasing: anchor => openEasingMenu(anchor, phase),
        onInsert: phaseActions.insertAfter,
      });
      segmentsRow.appendChild(segment);
      labelsRow.appendChild(name);
      bracketsRow.appendChild(bracket);
      durationsRow.appendChild(durationElement);
      if (seam) lane.appendChild(seam);
      laneRecords.push({
        phase,
        seg: segment,
        nameEl: name,
        durEl: durationElement,
        durText: durationText,
        seam,
        bracket,
      });
    }
    referenceLane ||= lane;

    const trackActions = actions.trackActions({ trackIndex, isScene, layer, label });
    wireTrack({
      label,
      isScene,
      focused,
      fallbackName: `Layer ${trackIndex + 1}`,
      currentName: layer?.name,
      onFocus: trackActions.focus,
      onRename: trackActions.rename,
    });
    toggleWrapper.appendChild(toggleFactory({
      documentLike,
      label: trackLabel,
      enabled,
      onToggle: trackActions.toggle,
    }));
    if (!enabled) track.classList.add('off');

    gestures.wireLaneScrub(lane);
    lanes.registerViewport(viewport);
    tracksElement.appendChild(track);
  }

  return { pendingThumbnailSegments, referenceLane };
}
