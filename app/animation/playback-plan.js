import { getTrackDuration, getTrackSequence } from './timeline.js';

/**
 * Build the set of timelines eligible for one master playback cycle.
 *
 * A track needs at least two ordered phases and a positive duration. Shorter
 * tracks still participate, but hold their final state until `maxTotal`; this
 * planner only establishes that shared boundary and does not mutate playback.
 */
export function buildTimelinePlaybackPlan({ layers, sceneTimeline, sceneEnabled }) {
  const tracks = [];
  for (const layer of layers) {
    if (layer.anim === false) continue;
    const sequence = getTrackSequence(layer.timeline);
    if (sequence.length < 2) continue;
    const total = getTrackDuration(sequence);
    if (total > 0) tracks.push({ F: layer, seq: sequence, total });
  }

  let sceneSequence = null;
  let sceneTotal = 0;
  if (sceneEnabled) {
    const sequence = getTrackSequence(sceneTimeline);
    if (sequence.length >= 2) {
      const total = getTrackDuration(sequence);
      if (total > 0) {
        sceneSequence = sequence;
        sceneTotal = total;
      }
    }
  }

  return {
    tracks,
    sceneSequence,
    sceneTotal,
    maxTotal: Math.max(sceneTotal, 0, ...tracks.map(track => track.total)),
  };
}

/**
 * Advance and sample every track against the shared master playback clock.
 *
 * The caller owns UI and application globals; this function returns the next
 * clock state and invokes rendering callbacks. Keeping those effects injected
 * makes loop-wrap behavior testable without DOM controls or particle fields.
 */
export function advanceTimelinePlayback({
  deltaTime,
  scrubbing,
  time,
  previousGlobalTime,
  loop,
  plan,
  applyLayer,
  applyScene,
}) {
  let nextTime = scrubbing ? time : time + deltaTime;
  const { tracks, sceneSequence, sceneTotal, maxTotal } = plan;
  if (!tracks.length && !sceneSequence) {
    return {
      hasPlayback: false,
      finished: false,
      time: nextTime,
      previousGlobalTime,
      sampleTime: 0,
      maxTotal: 0,
    };
  }

  let sampleTime;
  let nextPreviousGlobalTime = previousGlobalTime;
  if (loop) {
    sampleTime = nextTime % maxTotal;
    if (sampleTime < previousGlobalTime) {
      // Entrance tracks begin near zero particles and need their GPU birth
      // clocks restarted at a master-loop boundary. Constant-count idle tracks
      // deliberately keep running so their wrap remains visually seamless.
      for (const { F: layer, seq: sequence, total } of tracks) {
        const firstCount = sequence[0].snapshot?.params?.count;
        const counts = sequence
          .map(phase => phase.snapshot?.params?.count)
          .filter(value => typeof value === 'number');
        const maximumCount = counts.length ? Math.max(...counts) : 0;
        if (typeof firstCount === 'number'
          && firstCount <= Math.max(2, maximumCount * 0.05)
          && layer.respawn) {
          layer.respawn(Math.min(layer.params.spawnSpan, total));
        }
      }
    }
    nextPreviousGlobalTime = sampleTime;
  } else {
    sampleTime = Math.min(nextTime, maxTotal);
  }

  for (const { F: layer, seq: sequence, total } of tracks) {
    // “Nothing” retains phase one's authored appearance and only zeros count,
    // allowing an entrance to build without interpolating unrelated defaults.
    const zeroSnapshot = {
      params: { ...sequence[0].snapshot.params, count: 0 },
      colour: sequence[0].snapshot.colour,
    };
    applyLayer({
      layer,
      sequence,
      time: Math.min(sampleTime, total),
      zeroSnapshot,
    });
  }
  if (sceneSequence) {
    applyScene({
      sequence: sceneSequence,
      time: Math.min(sampleTime, sceneTotal),
    });
  }

  const finished = !loop && nextTime >= maxTotal;
  if (finished) nextTime = maxTotal;
  return {
    hasPlayback: true,
    finished,
    time: nextTime,
    previousGlobalTime: nextPreviousGlobalTime,
    sampleTime,
    maxTotal,
  };
}
