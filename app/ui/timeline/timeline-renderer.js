import { calculateTimelineAxis } from '../../animation/timeline-layout.js';
import { assembleTimelineTracks } from './timeline-render-assembler.js';
import { finalizeTimelineRender } from './timeline-render-finalizer.js';
import { buildTimelineRenderModel } from './timeline-render-model.js';

/**
 * Coordinates one complete timeline DOM rebuild.
 *
 * State is supplied through getters because layers, focus, selection, and
 * durations remain application-owned. The renderer controls only the ordered
 * pipeline: preserve UI state, derive geometry/model, assemble rows, then
 * measure and restore scrolling after those rows enter the document.
 */
export function createTimelineRenderer({
  documentLike,
  windowLike,
  tracksElement,
  isOpen,
  getLayers,
  sceneTimeline,
  getSceneEnabled,
  getActiveTrackIndex,
  getEditingPhase,
  getTimelines,
  getTrackCount,
  getMaximumDuration,
  easingLabels,
  minimumAxisSeconds,
  pixelsPerSecond,
  gutterWidth,
  thumbnailPreview,
  getThumbnailCaptures,
  thumbnailStrip,
  lanes,
  selection,
  gestures,
  actions,
  wireResize,
  openEasingMenu,
  updatePlayhead,
  calculateAxis = calculateTimelineAxis,
  buildModel = buildTimelineRenderModel,
  assemble = assembleTimelineTracks,
  finalize = finalizeTimelineRender,
}) {
  function render() {
    if (!tracksElement) return false;
    // Rebuilds can detach a hovered thumbnail before mouseleave is delivered.
    thumbnailPreview.hide();
    const preservedScroll = lanes.reset();
    tracksElement.innerHTML = '';
    selection.reset();

    // Track index participates in thumbnail identity, so collection changes
    // invalidate every index after the insertion/removal point.
    getThumbnailCaptures()?.resetTrackCount(getTrackCount());
    const thumbnailsEnabled = isOpen();
    const maxDuration = getMaximumDuration() || 1;
    const { axisSeconds, laneWidth } = calculateAxis({
      maxDuration,
      containerWidth: tracksElement.clientWidth,
      gutterWidth,
      minimumSeconds: minimumAxisSeconds,
      pixelsPerSecond,
    });
    const renderModel = buildModel({
      layers: getLayers(),
      sceneTimeline,
      sceneEnabled: getSceneEnabled(),
      activeTrackIndex: getActiveTrackIndex(),
      editingPhase: getEditingPhase(),
      axisSeconds,
      easingLabels,
    });
    const { pendingThumbnailSegments, referenceLane } = assemble({
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
    });
    finalize({
      timelineLanes: lanes,
      thumbnailStrip,
      timelineGestures: gestures,
      tracksElement,
      timelines: getTimelines(),
      pendingThumbnailSegments,
      referenceLane,
      maxDuration,
      axisSeconds,
      laneWidth,
      thumbnailsEnabled,
      preservedScroll,
      updatePlayhead,
    });
    return true;
  }

  return { render };
}
