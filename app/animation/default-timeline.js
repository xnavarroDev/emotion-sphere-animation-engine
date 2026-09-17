export const DEFAULT_PHASE_DURATIONS = Object.freeze([6, 6, 6]);

/**
 * Copies every mutable branch in a phase snapshot. Timeline editing relies on
 * snapshots being value objects: changing a newly inserted phase must never
 * modify the phase it was cloned from.
 */
export function cloneTimelineSnapshot(snapshot) {
  if (!snapshot) return null;
  const copy = {};
  if (snapshot.params) copy.params = { ...snapshot.params };
  if (snapshot.colour) copy.colour = snapshot.colour;
  if (snapshot.classic) copy.classic = { ...snapshot.classic };
  if (typeof snapshot.glowOpacity === 'number') copy.glowOpacity = snapshot.glowOpacity;
  if (snapshot.glowColor) copy.glowColor = snapshot.glowColor;
  if (snapshot.bgColor) copy.bgColor = snapshot.bgColor;
  if (snapshot.bgColor2) copy.bgColor2 = snapshot.bgColor2;
  if (typeof snapshot.bgGradientAmount === 'number') copy.bgGradientAmount = snapshot.bgGradientAmount;
  return copy;
}

/**
 * Seeds empty tracks with a gentle settle → swell → settle loop. Particle
 * tracks receive the swell; scene tracks intentionally hold their backdrop so
 * opening the editor does not introduce an unsolicited background pulse.
 */
export function seedDefaultTimelines({
  timelines,
  captureSnapshot,
  durations = DEFAULT_PHASE_DURATIONS,
}) {
  for (let index = 0; index < timelines.length; index += 1) {
    const timeline = timelines[index];
    if (timeline.length) continue;
    const base = captureSnapshot(index);
    const swell = cloneTimelineSnapshot(base);
    if (swell?.params) {
      swell.params.count = Math.round((swell.params.count || 0) * 1.35);
      swell.params.radius = (swell.params.radius || 1.6) * 1.12;
      swell.params.breath = Math.max(swell.params.breath || 0, 0.25);
    }
    timeline.push(
      { duration: durations[0], snapshot: base, name: null },
      { duration: durations[1], snapshot: swell, name: null },
      { duration: durations[2], snapshot: cloneTimelineSnapshot(base), name: null },
    );
  }
}

/** Return whether boot may seed defaults without replacing explicit state. */
export function shouldSeedDefaultTimelines({ search, layerCount, timelines }) {
  const query = new URLSearchParams(search);
  if (query.get('preset') || query.get('emotion')) return false;
  return layerCount > 0 && timelines.every(timeline => timeline.length === 0);
}
