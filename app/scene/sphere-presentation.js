import { emotionPick } from './emotion-cycle.js';

/**
 * Present the live background cloud and core sprite from one frame snapshot.
 *
 * This is intentionally the live-render path only. Thumbnail capture applies
 * its own temporary glow boost and state restoration transaction in app.js;
 * allowing that capture-only concern here would make normal rendering depend
 * on offscreen preview behavior.
 */
export function updateSpherePresentation({
  cloud, core, group, time, radius, sphere, cycleOn, cycleWeights,
  cycleSegment, activeEmotion, params, animScrubbing,
}) {
  const weights = cycleOn ? cycleWeights : null;
  const redMix = emotionPick(weights, 'red', activeEmotion);
  const purpleMix = emotionPick(weights, 'purple', activeEmotion);
  const blueMix = emotionPick(weights, 'blue', activeEmotion);
  const yellowMix = emotionPick(weights, 'yellow', activeEmotion);
  const worldRadius = radius * sphere.scale;

  cloud.update(
    group, sphere.scale, worldRadius, time,
    redMix, purpleMix, blueMix, yellowMix, animScrubbing,
  );

  if (core?.sprite.visible) {
    core.setCycleBlend(cycleOn ? cycleSegment : null);
    core.update(time, {
      params: { ...params, emotion: activeEmotion },
      scale: radius * sphere.innerScale * 1.35,
    });
  }

  return { redMix, purpleMix, blueMix, yellowMix, worldRadius };
}
