/**
 * Prepare an already-built playback plan for a user-initiated start.
 *
 * Starting from zero replays each eligible layer's staggered birth sequence.
 * Mid-timeline resume deliberately leaves particle birth clocks untouched so
 * Pause/Play does not visibly restart the animation.
 */
export function preparePlaybackStart({ time, plan }) {
  if (!(plan.maxTotal > 0)) return { playable: false, previousGlobalTime: null };
  if (time === 0) {
    for (const { F: layer, total } of plan.tracks) {
      layer.respawn?.(Math.min(layer.params.spawnSpan, total));
    }
  }
  return {
    playable: true,
    previousGlobalTime: time === 0 ? 0 : null,
  };
}

/** Build and prepare the canonical plan used by every interactive Play button. */
export function prepareTimelinePlayback({ layers, sceneTimeline, sceneEnabled, time }) {
  return preparePlaybackStart({
    time,
    plan: buildTimelinePlaybackPlan({ layers, sceneTimeline, sceneEnabled }),
  });
}

/**
 * Restore authored resting values without applying Phase 1. Reset means
 * “show the preset's idle look”; phase snapshots remain timeline-only state.
 */
export function restoreIdleLayerState(layers) {
  for (const layer of layers) {
    if (layer.idle) layer.setParams({ ...layer.idle });
  }
}

/**
 * Reset playback for a newly loaded preset or runtime emotion selection.
 * Unlike pause/resume, these entry points always start at zero and must clear
 * any scrub hold that would otherwise pin particle birth ages to an old seek.
 */
export function restartPlaybackFromBeginning({ layers, getSequence, getDuration }) {
  for (const layer of layers) {
    const sequence = getSequence(layer.timeline);
    if (layer.anim !== false && sequence.length >= 2) {
      layer.respawn?.(Math.min(layer.params.spawnSpan, getDuration(sequence)));
    }
  }
  return {
    time: 0,
    previousGlobalTime: 0,
    seekHold: null,
    playing: true,
  };
}
import { buildTimelinePlaybackPlan } from './playback-plan.js';
