import { seedDefaultTimelines, shouldSeedDefaultTimelines } from './default-timeline.js';

/**
 * Coordinates the default animation with asynchronous editor startup.
 * `seedIfEligible` is deliberately safe to call from multiple readiness paths:
 * after the first seed, the timelines are non-empty and later calls are no-ops.
 */
export function createDefaultTimelineSeeder({
  search,
  getLayerCount,
  getTimelines,
  captureSnapshot,
  render,
  captureDefault,
}) {
  function seed() {
    seedDefaultTimelines({
      timelines: getTimelines(),
      captureSnapshot,
    });
    // Seeded phases establish the initial document; they are not a user edit.
    render();
    captureDefault();
  }

  function seedIfEligible() {
    if (!shouldSeedDefaultTimelines({
      search,
      layerCount: getLayerCount(),
      timelines: getTimelines(),
    })) return false;
    seed();
    return true;
  }

  return { seed, seedIfEligible };
}
