import { smoothstep } from '../animation/timeline.js';
import { emotionPick, getCyclePaintWeights, shellShimmerRgb, cycleEmotionOffset } from './emotion-cycle.js';
import { emotionPreset } from './emotions.js';
import { purpleEmpathyGlow, yellowSparkFlicker } from './particle-effects.js';
import { buildStops, lerpRgb, sampleStops, tintBrightYellow, tintPurpleGlow } from './palette.js';

/**
 * Multiply composed RGB values by particle lifecycle visibility.
 *
 * Call this after color composition: the renderer rebuilds RGB buffers every
 * frame, so applying visibility earlier would be immediately overwritten.
 * Geometry invalidation stays with the caller that owns the Three.js buffer.
 */
export function applyParticleVisibility(colors, visibility) {
  for (let index = 0; index < visibility.length; index += 1) {
    const amount = visibility[index];
    if (amount >= 0.999) continue;
    const offset = index * 3;
    colors[offset] *= amount;
    colors[offset + 1] *= amount;
    colors[offset + 2] *= amount;
  }
  return colors;
}

/**
 * Creates the legacy sphere's color-buffer renderer.
 *
 * Position/motion code owns the geometry arrays, while this renderer owns only
 * RGB composition and the final `needsUpdate` flags. `getState` is evaluated
 * once per frame so live editor state stays in app.js without hidden globals.
 */
export function createParticleColorRenderer({ shell, inner, getState, onError = console.error }) {
  if (!shell || !inner || !getState) throw new TypeError('shell, inner, and getState are required');
  const rgb = [0, 0, 0];
  const scratch = [0, 0, 0];

  function sampleGradient(distance, stops, stopsA, stopsB, blend, out) {
    if (!stopsA) {
      sampleStops(distance, stops, out);
      return;
    }
    sampleStops(distance, stopsA, out);
    sampleStops(distance, stopsB, scratch);
    lerpRgb(out, scratch, blend, out);
  }

  function sampleEmotionInner(emotion, distance, out) {
    const preset = emotionPreset(emotion);
    sampleStops(Math.max(0, Math.min(1, distance * 0.42)), buildStops(preset, preset), out);
  }

  function update(shimmerTime = 0) {
    try {
      const time = shimmerTime || 0;
      const { params, target, cycleWeights, activeEmotion } = getState();
      const stops = buildStops(params, target);
      const stopsA = cycleWeights ? buildStops(params, emotionPreset(cycleWeights.a)) : null;
      const stopsB = cycleWeights ? buildStops(params, emotionPreset(cycleWeights.b)) : null;
      const blend = cycleWeights ? cycleWeights.colorSt : 0;
      const paint = getCyclePaintWeights(cycleWeights);
      const style = target.silverStyle || params.silverStyle || 'droplets';
      const yellowWeight = paint ? paint.wYellow : (activeEmotion === 'yellow' && style === 'sparks' ? 1 : 0);
      const purpleWeight = emotionPick(cycleWeights, 'purple', activeEmotion);
      const shardWeight = paint ? paint.wShards : (style === 'shards' ? 1 : 0);
      const shimmer = shellShimmerRgb(cycleWeights, params, target);

      // Shell order is intentional: establish the radial gradient, add the
      // emotion treatment, then blend the moving edge accent last.
      for (let index = 0; index < shell.count; index += 1) {
        const offset = index * 3;
        const ox = shell.origin[offset];
        const oy = shell.origin[offset + 1];
        const oz = shell.origin[offset + 2];
        const distance = Math.sqrt(ox * ox + oy * oy + oz * oz) / 1.05;
        sampleGradient(distance, stops, stopsA, stopsB, blend, rgb);
        let r = rgb[0]; let g = rgb[1]; let b = rgb[2];

        if (yellowWeight > 0.001) {
          const weight = smoothstep(Math.min(1, yellowWeight)) * 0.48;
          const flicker = yellowSparkFlicker(shimmerTime, shell.phase[index], ox, oy, oz);
          tintBrightYellow(r * flicker.mul, g * flicker.mul, b * flicker.mul, flicker.flash * 0.2, rgb);
          r = r * (1 - weight) + rgb[0] * weight;
          g = g * (1 - weight) + rgb[1] * weight;
          b = b * (1 - weight) + rgb[2] * weight;
        }
        if (purpleWeight > 0.001) {
          const weight = smoothstep(Math.min(1, purpleWeight));
          const glow = purpleEmpathyGlow(shimmerTime, shell.phase[index], ox, oy, oz);
          tintPurpleGlow(r * glow.mul, g * glow.mul, b * glow.mul, glow.glow * weight * 0.5, rgb);
          r = r * (1 - weight) + rgb[0] * weight;
          g = g * (1 - weight) + rgb[1] * weight;
          b = b * (1 - weight) + rgb[2] * weight;
        }

        const edge = Math.max(0, Math.min(1, (distance - 0.62) / 0.38));
        const wave = 0.38 + 0.62 * Math.sin(time * (8.4 + shell.phase[index] * 0.17)
          + shell.phase[index] * 5.3 + ox * 2.7 + oy * 2.1 + oz * 1.4);
        const accent = edge * (0.14 + wave * wave * 0.62);
        shell.colors[offset] = Math.min(r * (1 - accent) + shimmer[0] * accent, 1);
        shell.colors[offset + 1] = Math.min(g * (1 - accent) + shimmer[1] * accent, 1);
        shell.colors[offset + 2] = Math.min(b * (1 - accent) + shimmer[2] * accent, 1);
      }
      shell.geometry.attributes.color.needsUpdate = true;

      // Inner particles use a tighter portion of the same gradient. Sequence
      // tinting happens before sparkle/glow so those effects illuminate the
      // final authored color instead of being overwritten afterward.
      for (let index = 0; index < inner.count; index += 1) {
        const offset = index * 3;
        const ox = inner.origin[offset];
        const oy = inner.origin[offset + 1];
        const oz = inner.origin[offset + 2];
        const distance = Math.sqrt(ox ** 2 + oy ** 2 + oz ** 2) / 0.75;
        sampleGradient(distance * 0.42, stops, stopsA, stopsB, blend, rgb);
        let r = rgb[0]; let g = rgb[1]; let b = rgb[2];
        let boost = 1.42 + (shardWeight > 0.001 ? 0.08 * shardWeight : 0);

        const tintStep = inner.sequenceTint[index];
        if (tintStep > 0) {
          sampleEmotionInner(cycleEmotionOffset(activeEmotion, tintStep), distance, rgb);
          const amount = tintStep === 1 ? 0.32 : 0.2;
          r = r * (1 - amount) + rgb[0] * amount;
          g = g * (1 - amount) + rgb[1] * amount;
          b = b * (1 - amount) + rgb[2] * amount;
        }
        if (yellowWeight > 0.001) {
          const weight = smoothstep(Math.min(1, yellowWeight)) * 0.48;
          const flicker = yellowSparkFlicker(shimmerTime, inner.phase[index], ox, oy, oz);
          tintBrightYellow(r * flicker.mul * 1.08, g * flicker.mul * 1.08, b * flicker.mul * 1.06, flicker.flash * 0.2, rgb);
          r = r * (1 - weight) + rgb[0] * weight;
          g = g * (1 - weight) + rgb[1] * weight;
          b = b * (1 - weight) + rgb[2] * weight;
          boost = 1 + (1 - weight) * (boost - 1);
        }
        if (purpleWeight > 0.001) {
          const weight = smoothstep(Math.min(1, purpleWeight));
          const glow = purpleEmpathyGlow(shimmerTime, inner.phase[index], ox, oy, oz);
          tintPurpleGlow(r * glow.mul * 1.05, g * glow.mul * 1.05, b * glow.mul * 1.04, glow.glow * weight * 0.45, rgb);
          r = r * (1 - weight) + rgb[0] * weight;
          g = g * (1 - weight) + rgb[1] * weight;
          b = b * (1 - weight) + rgb[2] * weight;
          boost = 1 + (1 - weight) * (boost - 1);
        }
        inner.colors[offset] = Math.min(r * boost, 1);
        inner.colors[offset + 1] = Math.min(g * boost, 1);
        inner.colors[offset + 2] = Math.min(b * boost, 1);
      }
      inner.geometry.attributes.color.needsUpdate = true;
    } catch (error) {
      onError('updateColors', error);
    }
  }

  return { update };
}
