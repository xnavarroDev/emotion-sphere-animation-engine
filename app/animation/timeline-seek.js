import { timelineTimeFromClientX } from './timeline-layout.js';

/**
 * Sample the timeline at a pointer position and make particle counts match the
 * sampled instant. Timeline interpolation changes target counts; `snapCount`
 * is also required because a zero-delta scrub has no frame time in which to
 * ease the visible count toward that target.
 */
export function seekTimelineFromClientX({
  clientX,
  laneRect,
  axisSeconds,
  maximumDuration,
  layers,
  getSequence,
  getDuration,
  sample,
}) {
  const axisTime = timelineTimeFromClientX(clientX, laneRect, axisSeconds);
  if (axisTime === null) return null;

  // The displayed axis has a minimum width and can extend past actual content.
  // Empty visual space must clamp to the last authored animation instant.
  const time = Math.min(axisTime, maximumDuration);
  sample(time);

  for (const layer of layers) {
    const sequence = getSequence(layer.timeline);
    if (layer.setSpawnAge && layer.anim !== false && sequence.length >= 2) {
      layer.setSpawnAge(time, Math.min(layer.params.spawnSpan, getDuration(sequence)));
    }
    layer.snapCount?.();
  }
  return time;
}
