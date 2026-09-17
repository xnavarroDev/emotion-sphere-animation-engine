import { hexToRgb } from './color.js';

/**
 * Pure palette construction and tint operations for the legacy sphere.
 *
 * These helpers deliberately know nothing about animation state, Three.js,
 * or geometry buffers. The renderer decides which treatment applies; this
 * module only calculates RGB values so the authored look can be tested in
 * isolation and reused without pulling scene orchestration into the caller.
 */

export const WARM_SHELL = hexToRgb('#FFB848');

export const WARM_RED_STOPS = [
  { at: 0, c: hexToRgb('#FFD060') },
  { at: 0.22, c: hexToRgb('#FF9838') },
  { at: 0.48, c: hexToRgb('#E87028') },
  { at: 0.72, c: hexToRgb('#8A4020') },
  { at: 1, c: hexToRgb('#2A1408') },
];

const YELLOW_FLASH = hexToRgb('#FFFFD0');
const WARM_PURPLE_GLOW = hexToRgb('#F0C0D8');
const CYAN_CORE = hexToRgb('#E8FCFF');
const RED_SHELL = hexToRgb('#FF7868');
const RED_SPARK = hexToRgb('#FF6458');
const WARM_SPARK = hexToRgb('#FFE070');
const AMBER_SHELL = hexToRgb('#FFE878');

export function emotionPalette(config) {
  const palette = { ...config };
  palette.shadow = hexToRgb(config.shadowHex);
  palette.deep = hexToRgb(config.deepHex);
  palette.base = hexToRgb(config.baseHex);
  for (const key of ['hot', 'core', 'mid', 'highlight', 'accent']) {
    const hex = config[`${key}Hex`];
    if (hex) palette[key] = hexToRgb(hex);
  }
  return palette;
}

// Palette arrays are mutable during interpolation, so snapshots must not
// share their RGB triplets with the immutable emotion definitions.
export function copyEmotion(emotion, colorKeys) {
  const copy = { ...emotion };
  for (const key of colorKeys) {
    if (emotion[key]) copy[key] = [...emotion[key]];
  }
  return copy;
}

/**
 * Resolve the representative core color used by layer controls and blending.
 * Missing authored stops fall back toward `base`, matching the legacy palette
 * behavior without duplicating the weighting formula in UI/rendering code.
 */
export function emotionCoreRgb(palette) {
  const base = palette.base || [0.627, 0.792, 0.937];
  const mid = palette.mid || base;
  const hot = palette.hot || mid;
  const between = base.map((value, index) => value + (mid[index] - value) * 0.55);
  return between.map((value, index) => value + (hot[index] - value) * 0.25);
}

export function lerpRgb(from, to, fraction, out) {
  if (!from || !to) {
    out[0] = out[1] = out[2] = 0.5;
    return;
  }
  out[0] = from[0] + (to[0] - from[0]) * fraction;
  out[1] = from[1] + (to[1] - from[1]) * fraction;
  out[2] = from[2] + (to[2] - from[2]) * fraction;
}

function colorOr(params, target, key) {
  return (target && target[key]) || (params && params[key]) || [0.5, 0.5, 0.5];
}

export function buildStops(params, target) {
  const copy = key => [...colorOr(params, target, key)];
  if (target.core && target.hot) {
    return [
      { at: 0, c: copy('core') },
      { at: 0.22, c: copy('hot') },
      { at: 0.48, c: copy('base') },
      { at: 0.72, c: copy('deep') },
      { at: 1, c: copy('shadow') },
    ];
  }
  return [
    { at: 0, c: copy('highlight') },
    { at: 0.28, c: copy('mid') },
    { at: 0.52, c: copy('base') },
    { at: 0.74, c: copy('deep') },
    { at: 1, c: copy('shadow') },
  ];
}

export function sampleStops(value, stops, out) {
  const clamped = Math.max(0, Math.min(1, value));
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clamped <= stops[index + 1].at) {
      const start = stops[index];
      const end = stops[index + 1];
      lerpRgb(start.c, end.c, (clamped - start.at) / (end.at - start.at), out);
      return;
    }
  }
  const last = stops.at(-1).c;
  out[0] = last[0]; out[1] = last[1]; out[2] = last[2];
}

export function tintCyanGlow(r, g, b, glowAmount, sparkleAmount, out) {
  const glow = Math.min(glowAmount, 0.52);
  const sparkle = Math.min(sparkleAmount, 0.42);
  out[0] = Math.min(r * (1 + glow * 0.45 + sparkle * 0.35) + CYAN_CORE[0] * (glow * 0.38 + sparkle * 0.32), 1);
  out[1] = Math.min(g * (1 + glow * 0.5 + sparkle * 0.42) + CYAN_CORE[1] * (glow * 0.42 + sparkle * 0.38), 1);
  out[2] = Math.min(b * (1 + glow * 0.62 + sparkle * 0.55) + CYAN_CORE[2] * (glow * 0.52 + sparkle * 0.48), 1);
}

export function tintRedShell(r, g, b, glowAmount, out) {
  const glow = Math.min(glowAmount, 0.62);
  out[0] = Math.min(r * (1 + glow * 0.38) + RED_SHELL[0] * glow * 0.52, 1);
  out[1] = Math.min(g * (1 + glow * 0.1) + RED_SHELL[1] * glow * 0.06, 1);
  out[2] = Math.min(b * (1 + glow * 0.08) + RED_SHELL[2] * glow * 0.05, 1);
}

export function tintRedSpark(r, g, b, flash, out) {
  const amount = Math.min(flash * 0.62, 0.48);
  out[0] = Math.min(r * (1 + amount * 0.34) + RED_SPARK[0] * amount * 0.48, 1);
  out[1] = Math.min(g * (1 + amount * 0.06), 1);
  out[2] = Math.min(b * (1 + amount * 0.05), 1);
}

export function pushRedSaturation(r, g, b, amount, out) {
  const weight = Math.min(1, Math.max(0, amount));
  const red = Math.min(r * (1 + weight * 0.18) + RED_SHELL[0] * weight * 0.12, 1);
  out[0] = red;
  out[1] = Math.min(g, red * (1 - weight * 0.38));
  out[2] = Math.min(b, red * (1 - weight * 0.42));
}

export function tintWarmShell(r, g, b, glowAmount, out) {
  const glow = Math.min(glowAmount, 0.62);
  out[0] = Math.min(r * (1 + glow * 0.32) + WARM_SHELL[0] * glow * 0.42, 1);
  out[1] = Math.min(g * (1 + glow * 0.28) + WARM_SHELL[1] * glow * 0.38 + AMBER_SHELL[1] * glow * 0.1, 1);
  out[2] = Math.min(b * (1 + glow * 0.06) + WARM_SHELL[2] * glow * 0.04, 1);
}

export function tintWarmSpark(r, g, b, flash, out) {
  const amount = Math.min(flash * 0.62, 0.48);
  out[0] = Math.min(r * (1 + amount * 0.26) + WARM_SPARK[0] * amount * 0.36, 1);
  out[1] = Math.min(g * (1 + amount * 0.34) + WARM_SPARK[1] * amount * 0.42 + AMBER_SHELL[1] * amount * 0.16, 1);
  out[2] = Math.min(b * (1 + amount * 0.06) + WARM_SPARK[2] * amount * 0.05, 1);
}

export function pushWarmSaturation(r, g, b, amount, out) {
  const weight = Math.min(1, Math.max(0, amount));
  const red = Math.min(r * (1 + weight * 0.14) + WARM_SHELL[0] * weight * 0.1, 1);
  const green = Math.min(Math.max(g, red * 0.38), red * (0.62 + weight * 0.22) + WARM_SHELL[1] * weight * 0.18, 1);
  out[0] = red;
  out[1] = green;
  out[2] = Math.min(b, red * (1 - weight * 0.48));
}

export function tintYellowShell(r, g, b, glowAmount, out) {
  const glow = Math.min(glowAmount, 0.38);
  out[0] = Math.min(r * (1 + glow * 0.38) + AMBER_SHELL[0] * glow * 0.3, 1);
  out[1] = Math.min(g * (1 + glow * 0.34) + AMBER_SHELL[1] * glow * 0.28, 1);
  out[2] = Math.min(b * (1 + glow * 0.18) + AMBER_SHELL[2] * glow * 0.12, 1);
}

export function tintPurpleGlow(r, g, b, glowAmount, out) {
  const glow = Math.min(glowAmount * 0.55, 0.35);
  out[0] = Math.min(r * (1 + glow * 0.48) + WARM_PURPLE_GLOW[0] * glow * 0.38, 1);
  out[1] = Math.min(g * (1 + glow * 0.36) + WARM_PURPLE_GLOW[1] * glow * 0.28, 1);
  out[2] = Math.min(b * (1 + glow * 0.22) + WARM_PURPLE_GLOW[2] * glow * 0.18, 1);
}

export function tintBrightYellow(r, g, b, flash, out) {
  const amount = Math.min(flash * 0.6, 0.5);
  out[0] = Math.min(r * (1 + amount * 0.5) + YELLOW_FLASH[0] * amount * 0.34, 1);
  out[1] = Math.min(g * (1 + amount * 0.45) + YELLOW_FLASH[1] * amount * 0.32, 1);
  out[2] = Math.min(b * (1 + amount * 0.22) + YELLOW_FLASH[2] * amount * 0.14, 1);
}
