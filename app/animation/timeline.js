/**
 * Canonical timeline model, easing catalog, duration helpers, and interpolation.
 * Phase snapshots describe target states; each phase's easing controls the
 * transition from the preceding snapshot into that target.
 */
export const smoothstep = value => value * value * (3 - 2 * value);
export const smootherstep = value => value * value * value * (value * (value * 6 - 15) + 10);

const backStrength = 1.70158;
const backInOutStrength = backStrength * 1.525;
const backEndStrength = backStrength + 1;

export const EASINGS = {
  smootherstep,
  linear: value => value,
  easeinout: value => value < 0.5
    ? 2 * value * value
    : 1 - Math.pow(-2 * value + 2, 2) / 2,
  easein: value => value * value,
  easeout: value => 1 - (1 - value) * (1 - value),
  sineinout: value => -(Math.cos(Math.PI * value) - 1) / 2,
  sinein: value => 1 - Math.cos((value * Math.PI) / 2),
  sineout: value => Math.sin((value * Math.PI) / 2),
  expoinout: value => value <= 0 ? 0 : value >= 1 ? 1 : value < 0.5
    ? Math.pow(2, 20 * value - 10) / 2
    : (2 - Math.pow(2, -20 * value + 10)) / 2,
  expoin: value => value <= 0 ? 0 : Math.pow(2, 10 * value - 10),
  expoout: value => value >= 1 ? 1 : 1 - Math.pow(2, -10 * value),
  backinout: value => value < 0.5
    ? (Math.pow(2 * value, 2) * ((backInOutStrength + 1) * 2 * value - backInOutStrength)) / 2
    : (Math.pow(2 * value - 2, 2) * ((backInOutStrength + 1) * (value * 2 - 2) + backInOutStrength) + 2) / 2,
  backin: value => backEndStrength * value * value * value - backStrength * value * value,
  backout: value => 1 + backEndStrength * Math.pow(value - 1, 3) + backStrength * Math.pow(value - 1, 2),
};

export const EASING_MENU = [
  ['Basic', [['smootherstep', 'Smootherstep (default)'], ['linear', 'Linear']]],
  ['Ease', [['easeinout', 'Ease in out'], ['easein', 'Ease in'], ['easeout', 'Ease out']]],
  ['Sine', [['sineinout', 'Sine in out'], ['sinein', 'Sine in'], ['sineout', 'Sine out']]],
  ['Exponential', [['expoinout', 'Exponential in out'], ['expoin', 'Exponential in'], ['expoout', 'Exponential out']]],
  ['Back', [['backinout', 'Back in out'], ['backin', 'Back in'], ['backout', 'Back out']]],
];

export const EASING_LABELS = Object.fromEntries(EASING_MENU.flatMap(([, items]) => items));

export function createTimeline() {
  return [];
}

export function getTrackSequence(timeline) {
  return timeline.filter(phase => phase.snapshot);
}

export function getTrackDuration(sequence) {
  return sequence.reduce((total, phase) => total + phase.duration, 0);
}

export function interpolateTrack(sequence, time, apply, zeroSnapshot) {
  let elapsed = 0;
  for (let index = 0; index < sequence.length; index += 1) {
    const phase = sequence[index];
    if (time < elapsed + phase.duration || index === sequence.length - 1) {
      const previous = index === 0 && zeroSnapshot
        ? zeroSnapshot
        : sequence[(index - 1 + sequence.length) % sequence.length].snapshot;
      const ease = EASINGS[phase.ease] || smootherstep;
      const fraction = Math.min(1, (time - elapsed) / phase.duration);
      apply(previous, phase.snapshot, ease(fraction));
      return;
    }
    elapsed += phase.duration;
  }
}
