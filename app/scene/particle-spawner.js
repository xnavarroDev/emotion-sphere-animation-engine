/**
 * Accumulates frame time and allocates particle slots in round-robin order.
 *
 * The scheduler deliberately does not mutate geometry. Its callback marks a
 * slot as newborn, allowing the renderer to keep distribution and buffer
 * ownership while timing remains deterministic and independently testable.
 */
export function createParticleSpawner({ particleCount, getInterval, onSpawn }) {
  if (!Number.isInteger(particleCount) || particleCount < 1) {
    throw new RangeError('particleCount must be a positive integer');
  }
  if (typeof getInterval !== 'function' || typeof onSpawn !== 'function') {
    throw new TypeError('getInterval and onSpawn are required');
  }
  let cursor = 0;
  let accumulated = 0;

  return {
    reset() {
      cursor = 0;
      accumulated = 0;
    },
    advance(deltaTime, currentTime) {
      accumulated += deltaTime;
      // A positive floor prevents malformed loaded presets from trapping the
      // animation frame in an infinite spawn loop.
      const interval = Math.max(0.001, Number(getInterval()) || 0);
      while (accumulated >= interval) {
        accumulated -= interval;
        onSpawn(cursor % particleCount, currentTime);
        cursor += 1;
      }
    },
    get pendingTime() { return accumulated; },
  };
}
