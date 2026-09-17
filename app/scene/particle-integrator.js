import { smoothstep, smootherstep } from '../animation/timeline.js';
import { PARTICLE_SWIRL, innerJitter, inwardSwirl } from './particle-motion.js';

/**
 * Integrate the legacy CPU particle clouds into their next position buffers.
 *
 * These functions own only position math. The app remains responsible for
 * materials, colors, GPU invalidation, and lifecycle scheduling. Keeping that
 * boundary explicit makes the dense formulas testable without constructing a
 * Three.js scene and prevents the animation coordinator growing another loop.
 */

export function updateShellParticlePositions({
  time, pulseFrequency, radius, sphere, classic, origin, positions, phases,
  calmWeight, purpleWeight, redWeight, yellowWeight, chaosWeight,
  motionNormalization, shimmer, chaosAmount, chaosFrequency,
}) {
  for (let index = 0; index < phases.length; index += 1) {
    const offset = index * 3;
    const originX = origin[offset];
    const originY = origin[offset + 1];
    const originZ = origin[offset + 2];
    const length = Math.sqrt(originX * originX + originY * originY + originZ * originZ) || 1;
    const rippleWave = Math.sin(time * pulseFrequency + phases[index]) * 0.5 + 0.5;
    const ripple = redWeight * sphere.breath + (1 - redWeight) * rippleWave;
    const rippleAmount = calmWeight * 0.018 + purpleWeight * 0.022
      + yellowWeight * 0.014 + redWeight * 0.016 + chaosWeight * 0.012;
    let dx = 0; let dy = 0; let dz = 0;
    let expand = 1 + sphere.disperse;

    if (calmWeight > 0.001) {
      const phase = phases[index];
      const edge = Math.max(0, Math.min(1, (length - 0.88) / 0.24));
      const shellShimmer = shimmer * (1 + edge * 2.4);
      const calmX = Math.sin(time * 0.38 + originY * 1.6 + phase) * shellShimmer
        + Math.sin(time * 0.28 + originZ * 2 + phase * 0.7) * shellShimmer * 0.6;
      const calmY = Math.sin(time * 0.33 + originZ * 1.8 + phase * 1.1) * shellShimmer
        + Math.cos(time * 0.44 + originX * 1.4 + phase) * shellShimmer * 0.5;
      const calmZ = Math.sin(time * 0.41 + originX * 2 + phase * 0.9) * shellShimmer;
      dx += calmWeight * motionNormalization * (calmX + edge * Math.sin(time * 0.47 + phase * 2.3 + originY * 1.2) * 0.038);
      dy += calmWeight * motionNormalization * (calmY + edge * Math.cos(time * 0.39 + phase * 1.7 + originZ * 1.4) * 0.038);
      dz += calmWeight * motionNormalization * (calmZ + edge * Math.sin(time * 0.52 + phase * 2.9 + originX * 1.1) * 0.034);
      expand += calmWeight * motionNormalization * edge
        * (Math.sin(time * 0.44 + phase * 1.8) * 0.09 + Math.sin(time * 0.33 + phase * 3.1 + originY) * 0.06);
    }
    if (purpleWeight > 0.001) {
      const phase = phases[index];
      const wave = Math.sin(time * pulseFrequency * 0.28 + phase + originY * 0.6 + originZ * 0.4) * 0.5 + 0.5;
      const shellShimmer = shimmer * (0.75 + wave * 0.5);
      dx += purpleWeight * motionNormalization * (Math.sin(time * 0.2 + originY * 1.1 + phase) * shellShimmer + Math.sin(time * 0.16 + originZ * 1.3 + phase * 0.65) * shellShimmer * 0.55);
      dy += purpleWeight * motionNormalization * (Math.sin(time * 0.18 + originZ * 1.5 + phase * 0.9) * shellShimmer + Math.cos(time * 0.22 + originX * 1.2 + phase) * shellShimmer * 0.5);
      dz += purpleWeight * motionNormalization * Math.sin(time * 0.21 + originX * 1.4 + phase * 0.75) * shellShimmer;
      expand += purpleWeight * motionNormalization * (sphere.swell * 0.045 + wave * 0.04 * Math.sin(time * pulseFrequency * 0.22 + phase * 1.4));
    }
    if (redWeight > 0.001) {
      const phase = phases[index];
      const edge = Math.max(0, Math.min(1, (length - 0.86) / 0.22));
      const wave = Math.sin(time * pulseFrequency * 0.3 + phase + originX * 0.55) * 0.5 + 0.5;
      const shellShimmer = shimmer * (0.65 + wave * 0.4) * (1 + edge * 1.6);
      dx += redWeight * motionNormalization * (Math.sin(time * 0.23 + originY * 1.25 + phase) * shellShimmer + Math.sin(time * 0.19 + originZ * 1.35 + phase * 0.7) * shellShimmer * 0.5);
      dy += redWeight * motionNormalization * (Math.sin(time * 0.21 + originZ * 1.45 + phase * 0.95) * shellShimmer + Math.cos(time * 0.25 + originX * 1.15 + phase) * shellShimmer * 0.48);
      dz += redWeight * motionNormalization * (Math.sin(time * 0.24 + originX * 1.35 + phase * 0.8) * shellShimmer + edge * Math.sin(time * 0.48 + phase * 2.1 + originY) * 0.018);
      expand += redWeight * motionNormalization * edge * (Math.sin(time * 0.41 + phase * 1.6) * 0.04 + wave * 0.03);
    }
    if (yellowWeight > 0.001) {
      const phase = phases[index];
      const edge = Math.max(0, Math.min(1, (length - 0.84) / 0.24));
      const wave = Math.sin(time * pulseFrequency * 0.26 + phase + originY * 0.5) * 0.5 + 0.5;
      const shellShimmer = shimmer * (0.7 + wave * 0.45) * (1 + edge * 1.4);
      dx += yellowWeight * motionNormalization * (Math.sin(time * 0.36 + originY * 1.4 + phase) * shellShimmer + Math.sin(time * 0.31 + originZ * 1.6 + phase * 0.75) * shellShimmer * 0.55);
      dy += yellowWeight * motionNormalization * (Math.sin(time * 0.34 + originZ * 1.5 + phase * 1.05) * shellShimmer + Math.cos(time * 0.4 + originX * 1.3 + phase) * shellShimmer * 0.5);
      dz += yellowWeight * motionNormalization * (Math.sin(time * 0.37 + originX * 1.5 + phase * 0.85) * shellShimmer + edge * Math.cos(time * 0.44 + phase * 1.9 + originZ) * 0.018);
      expand += yellowWeight * motionNormalization * edge * (Math.sin(time * 0.42 + phase * 1.7) * 0.04 + wave * 0.03);
    }
    if (chaosWeight > 0.001) {
      const shellFrequency = chaosFrequency * 0.55;
      dx += chaosWeight * motionNormalization * Math.sin(time * shellFrequency * 0.9 + originY * 2.2 + phases[index]) * chaosAmount;
      dy += chaosWeight * motionNormalization * Math.sin(time * shellFrequency * 0.7 + originZ * 1.8 + phases[index] * 1.1) * chaosAmount;
      dz += chaosWeight * motionNormalization * Math.sin(time * shellFrequency * 1.1 + originX * 2.5 + phases[index] * 0.7) * chaosAmount;
    }

    const swirl = inwardSwirl(time, phases[index], originX, originY, originZ, length,
      PARTICLE_SWIRL.shellTangential, PARTICLE_SWIRL.shellInward * (0.7 + sphere.breath * 0.35));
    dx += swirl.dx; dy += swirl.dy; dz += swirl.dz;
    const scaledRadius = radius * sphere.scale * classic.scale * (1 + (ripple - 0.5) * rippleAmount);
    const projectedRadius = length * scaledRadius * expand * swirl.radScale;
    positions[offset] = originX / length * projectedRadius + dx;
    positions[offset + 1] = originY / length * projectedRadius + dy;
    positions[offset + 2] = originZ / length * projectedRadius + dz;
  }
  return positions;
}

export function updateInnerParticlePositions({
  time, now, pulseFrequency, radius, breath, sphere, classic, origin, positions,
  phases, axes, births, visibility, spawnEnabled, resetTrail,
  calmWeight, purpleWeight, redWeight, yellowWeight, chaosWeight, shardsWeight,
  motionNormalization, shimmer, targetChaos, chaosDisplacement, chaosFrequency,
}) {
  for (let index = 0; index < phases.length; index += 1) {
    const offset = index * 3;
    const originX = origin[offset]; const originY = origin[offset + 1]; const originZ = origin[offset + 2];
    const length = Math.sqrt(originX * originX + originY * originY + originZ * originZ) || 1;
    const rippleWave = Math.sin(time * pulseFrequency + phases[index]) * 0.5 + 0.5;
    const ripple = redWeight * breath + (1 - redWeight) * rippleWave;
    const rippleAmount = calmWeight * 0.01 + purpleWeight * 0.016
      + yellowWeight * 0.01 + redWeight * 0.01 + chaosWeight * 0.01;
    let dx = 0; let dy = 0; let dz = 0;
    if (calmWeight > 0.001) {
      const phase = phases[index];
      dx += calmWeight * motionNormalization * Math.sin(time * 0.35 + originY * 1.5 + phase) * shimmer * 0.8;
      dy += calmWeight * motionNormalization * Math.sin(time * 0.3 + originZ * 1.7 + phase * 1.2) * shimmer * 0.8;
      dz += calmWeight * motionNormalization * Math.cos(time * 0.39 + originX * 1.6 + phase * 0.8) * shimmer * 0.7;
    }
    if (purpleWeight > 0.001) {
      const phase = phases[index];
      const wave = Math.sin(time * pulseFrequency * 0.25 + phase + originY * 0.5) * 0.5 + 0.5;
      const innerShimmer = shimmer * (0.7 + wave * 0.45);
      dx += purpleWeight * motionNormalization * Math.sin(time * 0.19 + originY * 1.2 + phase) * innerShimmer;
      dy += purpleWeight * motionNormalization * Math.sin(time * 0.17 + originZ * 1.4 + phase * 1.1) * innerShimmer;
      dz += purpleWeight * motionNormalization * Math.cos(time * 0.2 + originX * 1.3 + phase * 0.85) * innerShimmer;
    }
    if (chaosWeight > 0.001) {
      const innerFrequency = chaosFrequency * 0.5;
      dx += chaosWeight * motionNormalization * Math.sin(time * innerFrequency * 0.9 + originY * 2.5 + phases[index]) * chaosDisplacement;
      dy += chaosWeight * motionNormalization * Math.sin(time * innerFrequency * 0.7 + originZ * 2 + phases[index] * 1.1) * chaosDisplacement;
      dz += chaosWeight * motionNormalization * Math.sin(time * innerFrequency * 1.1 + originX * 2.8 + phases[index] * 0.7) * chaosDisplacement;
    }
    const jitterAmount = targetChaos * (calmWeight * 0.028 + purpleWeight * 0.038 + redWeight * 0.012
      + yellowWeight * 0.011 + chaosWeight * (shardsWeight * 0.028 + (1 - shardsWeight) * 0.022)) + 0.01;
    const jitter = innerJitter(time, phases[index], originX, originY, originZ, jitterAmount);
    dx += jitter.x; dy += jitter.y; dz += jitter.z;
    const swirl = inwardSwirl(time, phases[index], originX, originY, originZ, length,
      PARTICLE_SWIRL.innerTangential, PARTICLE_SWIRL.innerInward * (0.75 + breath * 0.3));
    dx += swirl.dx; dy += swirl.dy; dz += swirl.dz;

    const expand = 1 + sphere.disperse * (purpleWeight * 0.92 + chaosWeight * 0.12);
    const scaledRadius = radius * sphere.innerScale * classic.scale * (1 + (ripple - 0.5) * rippleAmount) * swirl.radScale;
    const innerChaos = targetChaos * (purpleWeight * 0.016 + yellowWeight * 0.022 + redWeight * 0.012
      + chaosWeight * (shardsWeight * 0.028 + 0.022 * (1 - shardsWeight)));
    const streakMultiplier = redWeight * 0.85 + purpleWeight * 0.32 + yellowWeight * 0.55 + chaosWeight * 0.45;
    const streakWave = Math.sin(time * streakMultiplier + phases[index]) * innerChaos;
    const streak = redWeight * sphere.swell * innerChaos + (1 - redWeight) * streakWave;
    const targetX = originX * scaledRadius * expand + dx * 0.82 + jitter.x * 0.35 + originX / length * streak;
    const targetY = originY * scaledRadius * expand + dy * 0.82 + jitter.y * 0.35 + originY / length * streak;
    const targetZ = originZ * scaledRadius * expand + dz * 0.82 + jitter.z * 0.35 + originZ / length * streak;

    if (!spawnEnabled) {
      visibility[index] = 1;
      positions[offset] = targetX; positions[offset + 1] = targetY; positions[offset + 2] = targetZ;
      continue;
    }

    const born = births[index];
    if (born < 0 || now - born >= classic.life) {
      if (born >= 0) births[index] = -1;
      visibility[index] = 0;
      positions[offset] = positions[offset + 1] = positions[offset + 2] = 0;
      resetTrail(index);
      continue;
    }

    const age = now - born;
    const progress = Math.max(0, Math.min(1, age / Math.max(0.1, classic.life - classic.fade)));
    const easedProgress = smootherstep(progress);
    const blend = smoothstep(easedProgress);
    const inverseProgress = 1 - easedProgress;
    let particleVisibility = 1;
    if (age > classic.life - classic.fade) {
      particleVisibility = smootherstep(Math.max(0, (classic.life - age) / classic.fade));
    } else if (age < classic.fade) {
      particleVisibility = smootherstep(age / classic.fade);
    }

    const normalX = originX / length; const normalY = originY / length; const normalZ = originZ / length;
    const projectedRadius = length * scaledRadius * expand * swirl.radScale;
    const axisX = axes[offset]; const axisY = axes[offset + 1]; const axisZ = axes[offset + 2];
    let tangentX = axisY * normalZ - axisZ * normalY;
    let tangentY = axisZ * normalX - axisX * normalZ;
    let tangentZ = axisX * normalY - axisY * normalX;
    const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ) || 1;
    tangentX /= tangentLength; tangentY /= tangentLength; tangentZ /= tangentLength;
    const binormalX = normalY * tangentZ - normalZ * tangentY;
    const binormalY = normalZ * tangentX - normalX * tangentZ;
    const binormalZ = normalX * tangentY - normalY * tangentX;
    const angle = now * 1.25 + phases[index] * 8.6;
    const cosine = Math.cos(angle); const sine = Math.sin(angle);
    const amplitude = projectedRadius * classic.swirl * Math.pow(inverseProgress, 1.75);
    const spawnX = normalX * projectedRadius * easedProgress + (tangentX * cosine + binormalX * sine) * amplitude;
    const spawnY = normalY * projectedRadius * easedProgress + (tangentY * cosine + binormalY * sine) * amplitude;
    const spawnZ = normalZ * projectedRadius * easedProgress + (tangentZ * cosine + binormalZ * sine) * amplitude;
    positions[offset] = spawnX * (1 - blend) + targetX * blend;
    positions[offset + 1] = spawnY * (1 - blend) + targetY * blend;
    positions[offset + 2] = spawnZ * (1 - blend) + targetZ * blend;
    visibility[index] = particleVisibility;
  }
  return positions;
}
