import { cycleColorBlendAmount } from './emotion-cycle.js';
import { getTrackDuration, getTrackSequence } from '../animation/timeline.js';

/**
 * Update canvas-backed inner layers and Three.js firefly layers for one frame.
 *
 * Ordering is part of the contract: clear last frame's timeline-color marker,
 * apply timeline animation, then let only unclaimed fields ease toward the live
 * emotion palette. This prevents timeline colors and emotion colors fighting.
 */
export function updateInnerLayerPresentation({
  time,
  deltaTime,
  canvasLayers,
  fireflyLayers,
  cycleSegment,
  activeEmotion,
  getActiveColor,
  getEmotionCoreColor,
  defaultFireflyColors,
  targetColor,
  blendColor,
  seekHold,
  applyAnimationFrame,
}) {
  for (const field of fireflyLayers) field._phaseColourActive = false;
  applyAnimationFrame(deltaTime || 0);

  const cycling = Boolean(cycleSegment);
  const segmentA = cycling ? cycleSegment.a : activeEmotion;
  const segmentB = cycling ? cycleSegment.b : null;
  const blend = cycling ? cycleColorBlendAmount(cycleSegment) : 0;
  const activeColor = getActiveColor();

  for (const layer of canvasLayers) {
    let color = layer.overrides[activeEmotion] || activeColor;
    if (cycling) {
      const from = layer.overrides[segmentA] || getEmotionCoreColor(segmentA);
      const to = layer.overrides[segmentB] || getEmotionCoreColor(segmentB);
      color = from.map((value, index) => value + (to[index] - value) * blend);
    }
    layer.field.params.color = color;
    if (layer.sprite.visible) {
      layer.field.draw(time);
      layer.tex.needsUpdate = true;
    }
  }

  // Firefly overrides may be CSS colors or numeric Three.js colors; Color.set
  // intentionally accepts both forms, so this module preserves either format.
  for (const field of fireflyLayers) {
    const overrideA = field.overrides[segmentA];
    targetColor.set(overrideA || defaultFireflyColors[segmentA] || 0xffc24a);
    if (cycling) {
      const overrideB = field.overrides[segmentB];
      blendColor.set(overrideB || defaultFireflyColors[segmentB] || 0xffc24a);
      targetColor.lerp(blendColor, blend);
    }
    if (!field._phaseColourActive) field.color().lerp(targetColor, 0.05);
    field.update(time);

    // A stationary seek must re-pin GPU birth age every frame; otherwise its
    // reveal keeps advancing under a playhead that appears not to move.
    if (seekHold != null && field.setSpawnAge && field.anim !== false) {
      const sequence = getTrackSequence(field.timeline);
      if (sequence.length >= 2) {
        field.setSpawnAge(
          seekHold,
          Math.min(field.params.spawnSpan, getTrackDuration(sequence)),
        );
      }
    }
    if (field.params.spin && field.spinAxis) {
      field.points.rotateOnAxis(
        field.spinAxis,
        field.params.spin * field.params.speed * (deltaTime || 0),
      );
    }
  }

  return { cycling, segmentA, segmentB, blend };
}
