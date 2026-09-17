import { advanceEmotionTransition } from './emotion-cycle.js';
import { updateParticleMaterialAppearance } from './particle-appearance.js';
import { applyParticleVisibility } from './particle-colors.js';
import { deriveParticleFrameState } from './particle-frame-state.js';
import {
  updateInnerParticlePositions,
  updateShellParticlePositions,
} from './particle-integrator.js';
import { updateSpherePresentation } from './sphere-presentation.js';

const DEFAULT_OPERATIONS = {
  advanceEmotionTransition,
  deriveParticleFrameState,
  updateParticleMaterialAppearance,
  updateShellParticlePositions,
  updateInnerParticlePositions,
  applyParticleVisibility,
  updateSpherePresentation,
};

/**
 * Orders one complete legacy-particle render frame.
 *
 * The individual math stages remain in focused modules. This coordinator owns
 * their sequencing and GPU dirty flags, which must stay consistent whenever a
 * stage is added or changed. `getState` snapshots mutable editor values once at
 * the start of a frame so every stage observes the same emotion and mode.
 */
export function createSceneFrameRunner({
  classic,
  shell,
  inner,
  materials,
  particleSpawner,
  particleTrails,
  sphereRotation,
  presentation,
  getState,
  updateColors,
  updateInnerLayers,
  render,
  operations = DEFAULT_OPERATIONS,
  maxDeltaTime = 0.05,
}) {
  let previousTime = 0;

  function run(time) {
    const deltaTime = Math.min(Math.max(time - previousTime, 0), maxDeltaTime);
    previousTime = time;
    const state = getState();

    if (state.spawnEnabled) particleSpawner.advance(deltaTime, time);

    operations.advanceEmotionTransition(state.params, state.target, {
      cycleOn: state.cycleOn,
      segment: state.cycleSegment,
    });
    const frame = operations.deriveParticleFrameState({
      cycleWeights: state.cycleWeights,
      paintWeights: state.paintWeights,
      cycleOn: state.cycleOn,
      target: state.target,
      params: state.params,
    });

    operations.updateParticleMaterialAppearance({
      time,
      pulseFrequency: frame.pulseFrequency,
      particleSize: frame.particleSize,
      density: frame.density,
      glowSize: state.params.glowSize,
      glowOpacity: state.params.glowOp,
      sphere: frame.sphere,
      breath: frame.breath,
      classic,
      edgeWeight: frame.edgeWeight,
      calmWeight: frame.calmWeight,
      purpleWeight: frame.purpleWeight,
      redWeight: frame.redWeight,
      yellowWeight: frame.yellowWeight,
      chaosMotionWeight: frame.chaosMotionWeight,
      chaosShellWeight: frame.chaosShellWeight,
      materials,
    });

    operations.updateShellParticlePositions({
      time,
      pulseFrequency: frame.pulseFrequency,
      radius: frame.radius,
      sphere: frame.sphere,
      classic,
      origin: shell.origin,
      positions: shell.positionAttribute.array,
      phases: shell.phases,
      calmWeight: frame.calmWeight,
      purpleWeight: frame.purpleWeight,
      redWeight: frame.redWeight,
      yellowWeight: frame.yellowWeight,
      chaosWeight: frame.chaosShellWeight,
      motionNormalization: frame.motionNormalization,
      shimmer: frame.shimmer,
      chaosAmount: frame.chaosDisplacement,
      chaosFrequency: frame.chaosFrequency,
    });
    shell.positionAttribute.needsUpdate = true;

    operations.updateInnerParticlePositions({
      time,
      now: time,
      pulseFrequency: frame.pulseFrequency,
      radius: frame.radius,
      breath: frame.breath,
      sphere: frame.sphere,
      classic,
      origin: inner.origin,
      positions: inner.positionAttribute.array,
      phases: inner.phases,
      axes: inner.axes,
      births: inner.births,
      visibility: inner.visibility,
      spawnEnabled: state.spawnEnabled,
      resetTrail: index => particleTrails.resetPrevious(index),
      calmWeight: frame.calmWeight,
      purpleWeight: frame.purpleWeight,
      redWeight: frame.redWeight,
      yellowWeight: frame.yellowWeight,
      chaosWeight: frame.chaosInnerWeight,
      shardsWeight: frame.shardsWeight,
      motionNormalization: frame.motionNormalization,
      shimmer: frame.shimmer,
      targetChaos: state.target.chaos,
      chaosDisplacement: frame.chaosDisplacement,
      chaosFrequency: frame.chaosFrequency,
    });
    inner.positionAttribute.needsUpdate = true;

    updateColors(time);
    inner.sizeAttribute.needsUpdate = true;
    // Visibility scales the freshly composed colors, so it must run afterward.
    operations.applyParticleVisibility(inner.colors, inner.visibility);
    inner.colorAttribute.needsUpdate = true;

    particleTrails.update({
      deltaTime,
      particlePositions: inner.positionAttribute.array,
      particleColors: inner.colors,
      visibility: inner.visibility,
    });
    sphereRotation.step({
      deltaTime,
      autoSpeed: state.params.autoSpeed,
      enabled: state.rotationEnabled,
      rotationSpeed: state.rotationSpeed,
    });
    operations.updateSpherePresentation({
      cloud: presentation.cloud,
      core: presentation.getCore(),
      group: presentation.group,
      time,
      radius: frame.radius,
      sphere: frame.sphere,
      cycleOn: state.cycleOn,
      cycleWeights: state.cycleWeights,
      cycleSegment: state.cycleSegment,
      activeEmotion: state.activeEmotion,
      params: state.params,
      animScrubbing: state.scrubbing,
    });

    updateInnerLayers(time, deltaTime);
    render();
    return { deltaTime, frameState: frame };
  }

  return { run };
}
