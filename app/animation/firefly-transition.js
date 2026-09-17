import { mixHex } from '../scene/color.js';

/**
 * Apply one interpolated timeline snapshot to a firefly field.
 *
 * `coreBias` is excluded because changing it rebuilds spawn positions, while
 * `spawnSpan` changes birth timing; interpolating either every frame creates
 * visible resets instead of a smooth transition. Count is rounded because the
 * field cannot render a fractional particle.
 */
export function applyFireflySnapshotTransition(field, from, to, fraction) {
  const parameters = {};
  for (const key of Object.keys(from.params)) {
    if (typeof from.params[key] !== 'number' || typeof to.params[key] !== 'number') continue;
    if (key === 'coreBias' || key === 'spawnSpan') continue;
    const value = from.params[key] + (to.params[key] - from.params[key]) * fraction;
    parameters[key] = key === 'count' ? Math.round(value) : value;
  }
  field.setParams(parameters);

  if (from.colour && to.colour) {
    field.setColor(mixHex(from.colour, to.colour, fraction));
    // The live emotion-follow pass checks this marker before applying its own
    // easing, preventing it from fighting a timeline-authored color this frame.
    field._phaseColourActive = true;
  }
  return parameters;
}
