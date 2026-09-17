/**
 * Apply per-frame size and opacity to the legacy particle materials.
 *
 * Position integration and color composition live in neighboring modules.
 * This helper owns the remaining material-level response to emotion weights,
 * keeping the main frame loop focused on ordering those independent stages.
 */
const SHELL_POINT_MULTIPLIER = 0.018;
const INNER_POINT_MULTIPLIER = 0.054;
const GLOW_POINT_MULTIPLIER = 17.5;

export function updateParticleMaterialAppearance({
  time, pulseFrequency, particleSize, density, glowSize, glowOpacity,
  sphere, breath, classic, edgeWeight, calmWeight, purpleWeight,
  redWeight, yellowWeight, chaosMotionWeight, chaosShellWeight, materials,
}) {
  const glowChaosWeight = Math.max(
    0,
    1 - Math.min(1, calmWeight + purpleWeight + redWeight + yellowWeight),
  );
  const glowWeightSum = calmWeight + purpleWeight + redWeight + yellowWeight + glowChaosWeight;
  const glowNormalization = glowWeightSum > 0.001 ? 1 / glowWeightSum : 1;
  const yellowPulse = yellowWeight > 0.35;
  const purpleGlow = purpleWeight > 0.35;

  materials.shell.size = particleSize * SHELL_POINT_MULTIPLIER * classic.shellSize
    * ((yellowPulse || purpleGlow)
      ? 0.97 + 0.03 * Math.sin(time * pulseFrequency * 0.35)
      : chaosShellWeight > 0.35 ? 0.97 + Math.sin(time * 6) * 0.025 : 1);

  let shellOpacity = calmWeight * density * (0.52 + sphere.breath * 0.08)
    + purpleWeight * density * (0.6 + (breath - 0.5) * 0.18)
    + chaosMotionWeight * density * (0.66 + breath * 0.16);
  if (edgeWeight > 0.001) {
    const flicker = yellowWeight > 0.2
      ? 0.97 + 0.02 * Math.sin(time * pulseFrequency * 0.35)
      : 0.94 + 0.06 * Math.sin(time * 4.2);
    shellOpacity *= 1 - edgeWeight + flicker * edgeWeight;
  }
  if (yellowPulse || purpleGlow) {
    shellOpacity *= 0.97 + 0.028 * Math.sin(time * pulseFrequency * 0.32);
  }
  materials.shell.opacity = Math.min(Math.max(shellOpacity, 0.28), 1);

  const calmGlowBreath = 0.96 + (breath - 0.5) * 0.04;
  const pulseGlowBreath = 0.8 + breath * 0.2;
  const redGlowBreath = 0.92 + (breath - 0.5) * 0.1;
  const glowBreath = (
    calmWeight * calmGlowBreath + purpleWeight * pulseGlowBreath
    + redWeight * redGlowBreath + yellowWeight * pulseGlowBreath
    + glowChaosWeight * pulseGlowBreath
  ) * glowNormalization;
  materials.inner.size = particleSize * INNER_POINT_MULTIPLIER * classic.dotSize * glowBreath;
  materials.inner.opacity = Math.min(
    density * (redWeight * (0.9 + (breath - 0.5) * 0.08)
      + (1 - redWeight) * (0.88 + breath * 0.12)),
    1,
  );

  const redGlowSize = 0.9 + (breath - 0.5) * 0.1;
  const glowSizeMultiplier = (
    calmWeight * 1.08 + purpleWeight + redWeight * redGlowSize + yellowWeight
    + glowChaosWeight * 0.85
  ) * glowNormalization;
  materials.glow.size = (glowSize || 0.03) * GLOW_POINT_MULTIPLIER
    * classic.glowSize * glowBreath * glowSizeMultiplier;
  const calmOpacity = 0.88 + (breath - 0.5) * 0.06;
  const pulseOpacity = 0.75 + breath * 0.25;
  materials.glow.opacity = Math.min(
    density * (glowOpacity || 0.35)
      * (calmWeight * calmOpacity
        + (purpleWeight + redWeight + yellowWeight + glowChaosWeight) * pulseOpacity)
      * glowNormalization,
    0.9,
  );
  materials.halo2.size = materials.glow.size * 1.55;
  materials.halo3.size = materials.glow.size * 2.25;
  materials.halo2.opacity = Math.min(materials.glow.opacity * 0.58, 0.85);
  materials.halo3.opacity = Math.min(materials.glow.opacity * 0.28, 0.6);
}
