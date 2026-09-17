/** Pure timeline geometry shared by rendering, seeking, and resize gestures. */
export function formatTimelineTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(Math.floor(safeSeconds % 60)).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function calculateTimelineAxis({
  maxDuration,
  containerWidth,
  gutterWidth,
  minimumSeconds,
  pixelsPerSecond,
}) {
  const effectiveWidth = containerWidth || 900;
  const availableWidth = Math.max(240, effectiveWidth - gutterWidth);
  const axisSeconds = Math.max(maxDuration, minimumSeconds, availableWidth / pixelsPerSecond);
  return {
    axisSeconds,
    laneWidth: axisSeconds * pixelsPerSecond,
  };
}

export function calculatePhaseSpans(timeline, axisSeconds) {
  const total = axisSeconds || 1;
  let elapsed = 0;
  return timeline.map(phase => {
    const startSeconds = elapsed;
    elapsed += phase.duration;
    const leftPercent = (startSeconds / total) * 100;
    const widthPercent = (phase.duration / total) * 100;
    return {
      startSeconds,
      endSeconds: elapsed,
      leftPercent,
      widthPercent,
      midpointPercent: leftPercent + widthPercent / 2,
    };
  });
}

export function timelineTimeFromClientX(clientX, laneRect, axisSeconds) {
  if (!laneRect?.width) return null;
  const fraction = Math.max(0, Math.min(1, (clientX - laneRect.left) / laneRect.width));
  return fraction * axisSeconds;
}
