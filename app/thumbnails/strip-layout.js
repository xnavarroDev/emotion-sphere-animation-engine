// Plans equal-width thumbnail frames inside one phase. Frames sample their
// opening instant (rather than their midpoint) so the displayed hover time is
// exactly the state represented by the image.
export function planPhaseThumbnailFrames({
  phaseDuration,
  phaseStartSeconds,
  laneWidth,
  timeScaleSeconds,
  stripHeight,
  aspect,
}) {
  if (laneWidth <= 0 || timeScaleSeconds <= 0 || phaseDuration <= 0) return [];

  const pixelsPerSecond = laneWidth / timeScaleSeconds;
  // A slot should be at least as wide as a complete frame at strip height.
  // Narrower slots force background-size: cover to crop most of the image and
  // make the remaining center particles look artificially enlarged.
  const idealDuration = (stripHeight * aspect) / pixelsPerSecond;
  const frameCount = Math.max(1, Math.round(phaseDuration / idealDuration));
  const frameDuration = phaseDuration / frameCount;

  return Array.from({ length: frameCount }, (_, index) => {
    const sampleSeconds = phaseStartSeconds + index * frameDuration;
    return {
      sampleSeconds,
      frameDuration,
      localLeftPercent: (index / frameCount) * 100,
      localWidthPercent: 100 / frameCount,
      axisLeftPercent: (sampleSeconds / timeScaleSeconds) * 100,
      axisWidthPercent: (frameDuration / timeScaleSeconds) * 100,
    };
  });
}

// Plans a composed strip across phase boundaries. Planning each phase
// independently avoids chopped grid frames such as 4s + 2s followed by 2s +
// 4s; every frame belongs to one phase and has an equal width within it.
export function planTimelineThumbnailFrames(timeline, options) {
  let phaseStartSeconds = 0;
  return timeline.flatMap((phase, phaseIndex) => {
    const frames = planPhaseThumbnailFrames({
      ...options,
      phaseDuration: phase.duration,
      phaseStartSeconds,
    }).map(frame => ({ ...frame, phaseIndex }));
    phaseStartSeconds += phase.duration;
    return frames;
  });
}
