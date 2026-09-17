/**
 * Finish a full timeline rebuild after every track has entered the DOM.
 * Measurements and thumbnail slots depend on real lane dimensions, so this
 * work must happen after row creation and in this order: establish the shared
 * axis, add overlays/thumbnails, then recache geometry and restore scroll.
 */
export function finalizeTimelineRender({
  timelineLanes,
  thumbnailStrip,
  timelineGestures,
  tracksElement,
  timelines,
  pendingThumbnailSegments,
  referenceLane,
  maxDuration,
  axisSeconds,
  laneWidth,
  thumbnailsEnabled,
  preservedScroll,
  updatePlayhead,
}) {
  // One playhead and overlay span every track against the first lane's shared
  // x-axis. Per-lane playheads would read as unrelated markers.
  timelineLanes.setAxis({
    lane: referenceLane,
    duration: maxDuration,
    visibleSeconds: axisSeconds,
  });
  if (referenceLane) timelineLanes.createOverlay();

  if (pendingThumbnailSegments.length) {
    thumbnailStrip.fillSegments({
      segments: pendingThumbnailSegments,
      referenceLane,
      // Sampling cadence follows real animation time, not padded axis time.
      timeScaleSeconds: maxDuration,
    });
  }
  if (thumbnailsEnabled) {
    const summaryViewport = thumbnailStrip.buildSummary({
      tracksElement,
      referenceTimeline: timelines.find(timeline => timeline.length),
      referenceLane,
      axisSeconds,
      laneWidth,
      onScrub: timelineGestures.wireLaneScrub,
      onScroll: timelineLanes.syncScroll,
    });
    if (summaryViewport) timelineLanes.registerViewport(summaryViewport, { listen: false });
  }

  // The summary strip changes vertical geometry. Cache only after insertion,
  // then restore both scroll axes that were preserved before the rebuild.
  timelineLanes.cacheGeometry();
  timelineLanes.restoreScroll(preservedScroll);
  updatePlayhead();
}
