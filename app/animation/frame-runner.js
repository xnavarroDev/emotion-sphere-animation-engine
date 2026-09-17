import { advanceTimelinePlayback, buildTimelinePlaybackPlan } from './playback-plan.js';

/**
 * Coordinates one timeline playback tick without knowing about renderer state.
 * Layer/scene interpolation and UI progress are injected adapters; this module
 * owns the ordering and stop policy shared by normal playback and scrubbing.
 */
export function createTimelineFrameRunner({
  isReady,
  getPlaying,
  getScrubbing,
  getTime,
  getPreviousTime,
  getLoop,
  getLayers,
  sceneTimeline,
  getSceneEnabled,
  applyLayer,
  applyScene,
  setClock,
  stopPlayback,
  onFrame,
  buildPlan = buildTimelinePlaybackPlan,
  advance = advanceTimelinePlayback,
}) {
  function run(deltaTime) {
    const scrubbing = getScrubbing();
    if (!isReady() || (!getPlaying() && !scrubbing)) return null;

    const plan = buildPlan({
      layers: getLayers(),
      sceneTimeline,
      sceneEnabled: getSceneEnabled(),
    });
    const playback = advance({
      deltaTime,
      scrubbing,
      time: getTime(),
      previousGlobalTime: getPreviousTime(),
      loop: getLoop(),
      plan,
      applyLayer,
      applyScene,
    });
    setClock(playback.time, playback.previousGlobalTime);
    if (!playback.hasPlayback) {
      stopPlayback();
      return playback;
    }
    onFrame(playback);
    if (playback.finished) stopPlayback();
    return playback;
  }

  return { run };
}
