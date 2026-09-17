import { ANGER_PULSE_BASE, emotionPreset } from './emotions.js';
import { FLAT_SPHERE_BREATH } from './particle-motion.js';

/**
 * Derive one immutable snapshot of particle motion inputs for a render frame.
 *
 * Emotion selection produces authored parameters, while cycle mode produces
 * blended style weights. This adapter converts either representation into the
 * normalized values consumed by material and position updates. Centralizing
 * that policy prevents neighboring renderer stages from interpreting weights
 * differently.
 */

function emotionBreathPeriod(name) {
  const emotion = emotionPreset(name);
  if (emotion.pulseMode === 'calm') return Math.max(emotion.pulse, 2.75);
  if (emotion.pulseMode === 'wave') return Math.max(emotion.pulse, 5.5);
  if (name === 'red') return ANGER_PULSE_BASE;
  return Math.max(emotion.pulse, 0.4);
}

export function deriveParticleFrameState({
  cycleWeights, paintWeights, cycleOn, target, params,
}) {
  const mode = target.pulseMode || 'breath';
  const style = target.silverStyle || 'droplets';
  const shardsWeight = paintWeights ? paintWeights.wShards : (style === 'shards' ? 1 : 0);
  const calmWeight = cycleWeights ? cycleWeights.calm : (mode === 'calm' ? 1 : 0);
  const purpleWeight = cycleWeights ? cycleWeights.purple : (mode === 'wave' ? 1 : 0);
  const redWeight = cycleWeights ? cycleWeights.red : (mode === 'heartbeat' ? 1 : 0);

  // Yellow currently contributes through palette/appearance treatments, while
  // its dedicated CPU motion remains intentionally disabled in the legacy look.
  const yellowWeight = 0;
  const chaosMotionWeight = redWeight + yellowWeight;
  // Suppress extra high-frequency chaos where authored red/yellow motion is
  // already strong; stacking both produces runaway-looking shell jitter.
  const chaosShellWeight = chaosMotionWeight
    * Math.max(0, 1 - redWeight * 0.95 - yellowWeight * 0.95);
  const chaosInnerWeight = chaosMotionWeight
    * Math.max(0, 1 - redWeight * 0.9 - yellowWeight * 0.9);
  const motionWeightSum = calmWeight + purpleWeight + chaosMotionWeight;
  const motionNormalization = motionWeightSum > 0.001 ? 1 / motionWeightSum : 1;
  const edgeWeight = cycleOn
    ? (target.edgeFlickerAmt != null ? target.edgeFlickerAmt : (target.edgeFlicker ? 1 : 0))
    : (target.edgeFlicker ? 1 : 0);

  let sphere = FLAT_SPHERE_BREATH;
  if (cycleWeights) {
    // Keep this blend explicit even while both endpoints are flat; future
    // emotion-specific breathing can be introduced without changing callers.
    sphere = Object.fromEntries(
      Object.keys(FLAT_SPHERE_BREATH).map(key => [
        key,
        cycleWeights.wa * FLAT_SPHERE_BREATH[key]
          + cycleWeights.wb * FLAT_SPHERE_BREATH[key],
      ]),
    );
  }
  const breath = sphere.breath;
  const breathPeriod = cycleWeights
    ? cycleWeights.wa * emotionBreathPeriod(cycleWeights.a)
      + cycleWeights.wb * emotionBreathPeriod(cycleWeights.b)
    : calmWeight > 0.5
      ? Math.max(target.pulse || 2.75, 2.75)
      : purpleWeight > 0.5
        ? Math.max(target.pulse || 6.5, 5.5)
        : redWeight > 0.5
          ? ANGER_PULSE_BASE
          : Math.max(target.pulse || 0.4, 0.05);

  const chaosFrequency = params.chaosFreq || 0.5;
  const radius = Number.isFinite(params.radius) ? Math.max(params.radius, 0.1) : 1.5;
  const density = Math.max(params.density || 0.5, 0.05);
  const particleSize = Number.isFinite(params.size) ? Math.max(params.size, 0.1) : 2;
  const chaosDisplacement = calmWeight * target.chaos * 0.018
    + purpleWeight * target.chaos * 0.01
    + chaosInnerWeight * target.chaos * 0.032;
  const shimmer = calmWeight * 0.028 + purpleWeight * 0.02 + yellowWeight * 0.012;

  return {
    sphere, breath, radius, density, particleSize, chaosFrequency,
    pulseFrequency: (1 / Math.max(breathPeriod, 0.05)) * Math.PI * 2,
    shardsWeight, calmWeight, purpleWeight, redWeight, yellowWeight,
    chaosMotionWeight, chaosShellWeight, chaosInnerWeight,
    motionNormalization, edgeWeight, chaosDisplacement, shimmer,
  };
}
