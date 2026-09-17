// Inserts one visual phase column across every timeline. The reference track
// chooses append/before/after/split once; reusing that decision for all tracks
// prevents lanes with different durations from drifting into different phase
// counts or assigning the same column to different indices.
export function insertPhaseSpan({
  timelines,
  startSeconds,
  endSeconds,
  minimumDuration = 0.5,
  focusedTrackIndex = 0,
  cloneSnapshot,
  captureSnapshot,
}) {
  const duration = Math.max(minimumDuration, endSeconds - startSeconds);
  const reference = timelines.find(timeline => timeline.length) || [];
  let elapsed = 0;
  let index = reference.length;
  let fraction = 0;

  for (let phaseIndex = 0; phaseIndex < reference.length; phaseIndex += 1) {
    const phase = reference[phaseIndex];
    if (startSeconds < elapsed + phase.duration - 1e-6) {
      index = phaseIndex;
      fraction = (startSeconds - elapsed) / phase.duration;
      break;
    }
    elapsed += phase.duration;
  }
  fraction = Math.max(0, Math.min(1, fraction));

  // Near-boundary drops snap to that boundary. Creating a tiny remainder
  // would produce a segment too narrow to read or resize in the editor.
  const mode = index >= reference.length
    ? 'append'
    : fraction * reference[index].duration <= minimumDuration
      ? 'before'
      : (1 - fraction) * reference[index].duration <= minimumDuration
        ? 'after'
        : 'split';

  const focusedIndex = Math.max(0, Math.min(focusedTrackIndex, timelines.length - 1));
  let focusedPhase = null;

  timelines.forEach((timeline, trackIndex) => {
    const fallbackSnapshot = () => captureSnapshot(trackIndex);
    const makePhase = snapshot => ({ duration, snapshot });
    let placed;

    if (mode === 'append' || index >= timeline.length) {
      const last = timeline[timeline.length - 1];
      placed = makePhase(cloneSnapshot(last?.snapshot) || fallbackSnapshot());
      timeline.push(placed);
    } else {
      const host = timeline[index];
      if (mode === 'before') {
        placed = makePhase(cloneSnapshot(host.snapshot) || fallbackSnapshot());
        timeline.splice(index, 0, placed);
      } else if (mode === 'after') {
        placed = makePhase(cloneSnapshot(host.snapshot) || fallbackSnapshot());
        timeline.splice(index + 1, 0, placed);
      } else {
        // A split preserves the host's leading phase and inserts a cloned
        // trailing phase so edits to any of the three snapshots stay isolated.
        const leadingDuration = Math.max(minimumDuration * 0.2, host.duration * fraction);
        const trailingDuration = Math.max(minimumDuration * 0.2, host.duration - leadingDuration);
        host.duration = leadingDuration;
        placed = makePhase(cloneSnapshot(host.snapshot));
        timeline.splice(index + 1, 0, placed, {
          duration: trailingDuration,
          snapshot: cloneSnapshot(host.snapshot),
          ease: host.ease,
        });
      }
    }

    if (trackIndex === focusedIndex) focusedPhase = placed;
  });

  return focusedPhase;
}

/**
 * Removes one phase index from every track that contains it.
 *
 * Phase indices represent visual columns shared by all lanes. Removing a phase
 * from only one timeline would shift every later beat in that lane and make
 * labels, hover grouping, and seam insertion refer to different moments.
 */
export function removePhaseColumn(timelines, phaseIndex) {
  if (!Number.isInteger(phaseIndex) || phaseIndex < 0) return [];
  return timelines.map(timeline => (
    phaseIndex < timeline.length ? timeline.splice(phaseIndex, 1)[0] : null
  ));
}

/**
 * Inserts a new shared column immediately after an existing phase index.
 *
 * Each lane receives its own cloned snapshot so editing one track cannot mutate
 * another by reference. Uneven timelines are supported: a lane missing the
 * source index falls back to a fresh track-specific capture and appends the new
 * phase at its nearest valid position.
 */
export function insertPhaseColumnAfter({
  timelines,
  phaseIndex,
  fallbackDuration,
  minimumDuration = 0.5,
  cloneSnapshot,
  captureSnapshot,
}) {
  return timelines.map((timeline, trackIndex) => {
    const source = timeline[phaseIndex];
    const sourceDuration = source?.duration ?? fallbackDuration;
    const inserted = {
      duration: Math.max(minimumDuration, sourceDuration / 2),
      snapshot: cloneSnapshot(source?.snapshot) || captureSnapshot(trackIndex),
    };
    timeline.splice(phaseIndex + 1, 0, inserted);
    return inserted;
  });
}

// Animation flags are historically optional: undefined means enabled. This
// helper preserves that storage format while giving UI toggles one clear rule.
export function toggleAnimationEnabled(currentValue) {
  return currentValue === false;
}

export function clearTimeline(timeline) {
  return timeline.splice(0, timeline.length);
}
