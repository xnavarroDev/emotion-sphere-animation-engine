/**
 * Pure temporal/spatial waveforms used by particle color and size rendering.
 *
 * These functions intentionally accept every input instead of reading scene
 * state. That keeps the renderer's authored visual character deterministic
 * and lets palette orchestration decide how strongly each effect is applied.
 */
export function cyanDropletGlow(t, phase, ox, oy, oz) {
  const ripple = Math.sin(t * 2.4 + oy * 2.6 + phase * 1.1) * Math.sin(t * 1.7 + oz * 2.1 + phase * 0.75);
  const spark = Math.pow(Math.abs(Math.sin(t * 9.5 + phase * 3.2 + ox * 4.2 + oz * 1.8)), 0.5);
  const drift = Math.sin(t * 1.2 + ox * 1.4 + oz * 1.4 + phase) * 0.5 + 0.5;
  return { glow: 0.035 + ripple * 0.14 + spark * 0.2 + drift * 0.06, mul: 0.92 + ripple * 0.12 + spark * 0.28 + drift * 0.05, spark };
}

export function purpleEmpathyGlow(t, phase, ox, oy, oz) {
  const wave = (Math.sin(t * 3.6 + phase * 1.5) + Math.sin(t * 2.2 + ox * 2.4 + oy * 2.1)) * 0.5 + 0.5;
  const shimmer = Math.sin(t * 5.2 + phase * 0.9 + oz * 3.2) * 0.5 + 0.5;
  return { glow: 0.02 + wave * 0.07 + shimmer * 0.04, mul: 0.96 + wave * 0.07 + shimmer * 0.04 };
}

export function sparkleGate(index, phase, ox, oy, oz, threshold) {
  const hash = Math.abs(Math.sin(index * 127.1 + phase * 311.7 + ox * 89.3 + oy * 53.9 + oz * 71.2) * 43758.5453) % 1;
  return Math.pow(Math.max(0, hash - threshold) / (1 - threshold), 0.58);
}

export function redShellGlow(t, phase, ox, oy, oz, index) {
  const j = index * 0.17 + phase * 0.31;
  const a = Math.sin(t * (4.8 + j) + phase * (1.7 + j * 0.4) + ox * (1.9 + index * 0.08));
  const b = Math.cos(t * (3.6 + j * 1.3) + oy * (2.1 + index * 0.06) + phase * 1.2);
  const c = Math.sin(t * (5.9 + j * 0.9) + oz * (1.6 + index * 0.05) + phase * 0.7);
  const chaos = Math.pow(Math.abs(a * b * c), 0.68);
  const wave = Math.sin(t * 2.1 + phase * 1.3 + oy * 0.9 + ox * 0.5 + index * 0.22) * 0.5 + 0.5;
  const s1 = Math.sin(t * (6.2 + index * 0.41) + phase * (2.4 + index * 0.13) + ox * 1.7 + oz * 0.9);
  const s2 = Math.sin(t * (4.1 + index * 0.29) + phase * (1.8 + index * 0.09) + oy * 2.1 + ox * 0.6);
  const spark = Math.pow(Math.max(0, s1 * s2), 2.35);
  return { mul: 0.96 + chaos * 0.03 + wave * 0.02, glow: 0.014 + chaos * 0.04 + wave * 0.03 + spark * 0.035, spark, jitter: chaos * 0.015 + wave * 0.01 };
}

export function redShardSparkle(t, phase, ox, oy, oz, index) {
  const j = index * 0.23 + phase * 0.19;
  const a = Math.sin(t * (5.4 + j) + phase * (2.1 + j * 0.5) + ox * (2.4 + index * 0.11));
  const b = Math.cos(t * (4.3 + j * 1.1) + oy * (1.9 + index * 0.07) + phase * (1.4 + j * 0.3));
  const c = Math.sin(t * (7.1 + j * 0.8) + oz * (1.7 + index * 0.09) + phase * 0.6);
  const spike = Math.pow(Math.abs(a * b * c), 0.72);
  return { mul: 0.97 + spike * 0.03, flash: spike };
}

export function yellowShellGlow(t, phase, ox, oy, oz) {
  const wave = Math.sin(t * 3.1 + phase * 1.1 + ox * 1.7) * Math.cos(t * 2.3 + oy * 2 + phase * 0.8);
  const drift = Math.sin(t * 1.4 + oz * 1.9 + phase * 0.6) * 0.5 + 0.5;
  const shimmer = Math.sin(t * 6.8 + phase * 2.8 + ox * oy * 2.2) * 0.5 + 0.5;
  return { mul: 0.94 + Math.abs(wave) * 0.09 + drift * 0.05, glow: 0.015 + drift * 0.055 + shimmer * 0.04, jitter: Math.abs(wave) * 0.03 + drift * 0.025 };
}

export function yellowSparkFlicker(t, phase, ox, oy, oz) {
  const chaos = Math.pow(Math.abs(Math.sin(t * 4.2 + phase * 1.6) * Math.sin(t * 5.8 + phase * 2.1 + ox * 1.4) * Math.cos(t * 3.4 + phase * 1.2 + oy * 1.8 + oz * 1.1)), 0.55);
  const spike = Math.pow(Math.max(0, Math.sin(t * 5.2 + phase * 2.1 + ox * 1.1) * Math.sin(t * 6.4 + phase * 1.4 + oy * 1.6)), 2.1);
  return { mul: 0.97 + chaos * 0.05 + spike * 0.22, flash: spike * (0.12 + 0.28 * chaos) };
}

export function specularShine(ox, oy, oz, lux, luy, luz, exponent, amount) {
  const inverseLength = 1 / (Math.sqrt(ox * ox + oy * oy + oz * oz) || 1);
  const dot = Math.max(0, ox * inverseLength * lux + oy * inverseLength * luy + oz * inverseLength * luz);
  return Math.pow(dot, exponent) * amount;
}

export function particleSparkle(t, phase, ox, oy, oz, index, shell) {
  const twinkleA = 0.5 + 0.5 * Math.sin(t * 14.5 + phase * 3.7 + ox * 5.2 + oy * 4.1);
  const twinkleB = 0.5 + 0.5 * Math.sin(t * 22.3 + phase * 5.1 + oz * 6.8);
  const twinkle = Math.pow(twinkleA * twinkleB, 1.35) * (shell ? 0.3 : 0.38);
  const gate = Math.sin(t * 3.1 + phase * 11.3 + index * 0.17);
  const pop = gate > 0.92 ? (gate - 0.92) / 0.08 * (shell ? 0.38 : 0.5) : 0;
  return twinkle + pop;
}
