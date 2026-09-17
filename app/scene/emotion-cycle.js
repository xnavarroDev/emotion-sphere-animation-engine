import { smootherstep } from '../animation/timeline.js';
import { copyEmotion } from './palette.js';
import {
  COLOR_KEYS,
  CYCLE_ORDER,
  EMOTIONS,
  MOTION_KEYS,
  SLIDER_KEYS,
  emotionPreset,
} from './emotions.js';

/**
 * Pure composition rules for the four-emotion preview cycle.
 *
 * The app owns whether cycling is active and stores the current segment. This
 * module only turns a normalized phase into palette/motion values and visual
 * weights, making transitions testable without a renderer or browser clock.
 */
const HARD_SEGMENTS = new Set(['purple-red', 'yellow-blue']);
const SCALAR_KEYS = ['pulse', 'density', 'chaos', 'radius', 'size', 'autoSpeed', 'pulseAmp', 'glowSize', 'glowOp', 'silver', 'chaosFreq'];
const LOG_KEYS = new Set(['chaos', 'glowOp', 'pulseAmp', 'chaosFreq']);

const segmentKey = segment => `${segment.a}-${segment.b}`;
const lerp = (from, to, amount) => from + (to - from) * amount;
const logLerp = (from, to, amount) => Math.exp(
  Math.log(Math.max(from, 1e-6)) * (1 - amount) + Math.log(Math.max(to, 1e-6)) * amount,
);

export function getCycleSegment(phase) {
  const wrapped = ((phase % 1) + 1) % 1;
  const position = wrapped * CYCLE_ORDER.length;
  const index = Math.min(Math.floor(position), CYCLE_ORDER.length - 1);
  return {
    a: CYCLE_ORDER[index],
    b: CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length],
    t: position - index,
  };
}

export function cycleBlendAmount(segment) {
  let amount = smootherstep(segment.t);
  if (HARD_SEGMENTS.has(segmentKey(segment))) amount = smootherstep(amount);
  return amount;
}

export function isHardCycleSegment(segment) {
  return HARD_SEGMENTS.has(segmentKey(segment));
}

/**
 * Ease the live renderer parameters toward the selected or cycling target.
 *
 * Numeric values deliberately move faster while cycle mode is running, so the
 * renderer can keep pace with the continuously changing cycle target. Colors
 * are only eased in cycle mode; direct emotion selections install their
 * palette elsewhere and use this function to settle motion values.
 *
 * @param {object} current Mutable parameter object consumed by the renderer.
 * @param {object} target Desired emotion parameter object.
 * @param {{cycleOn: boolean, segment?: {a: string, b: string}}} state
 * @returns {object} The same `current` object, for convenient composition.
 */
export function advanceEmotionTransition(current, target, { cycleOn, segment } = {}) {
  const motionAmount = cycleOn ? 0.2 : 0.02;
  for (const key of SLIDER_KEYS) current[key] = lerp(current[key], target[key], motionAmount);
  for (const key of MOTION_KEYS) {
    if (!SLIDER_KEYS.includes(key)) current[key] = lerp(current[key], target[key], motionAmount);
  }

  // Discrete rendering modes cannot be interpolated, so always follow the
  // target immediately. Boolean coercion keeps legacy preset values safe.
  current.edgeFlicker = Boolean(target.edgeFlicker);
  if (target.pulseMode) current.pulseMode = target.pulseMode;
  if (target.silverStyle) current.silverStyle = target.silverStyle;

  if (!cycleOn) return current;

  // Purple/red and yellow/blue are intentionally high-contrast boundaries.
  // Their slower color easing prevents a muddy flash while crossing palettes.
  const colorAmount = isHardCycleSegment(segment) ? 0.045 : 0.1;
  for (const key of COLOR_KEYS) {
    if (!target[key]) {
      delete current[key];
      continue;
    }
    if (!current[key]) current[key] = [...target[key]];
    else for (let channel = 0; channel < 3; channel += 1) {
      current[key][channel] = lerp(current[key][channel], target[key][channel], colorAmount);
    }
  }
  return current;
}

export function cycleColorBlendAmount(segment) {
  if (!HARD_SEGMENTS.has(segmentKey(segment))) return cycleBlendAmount(segment);
  return smootherstep(smootherstep(smootherstep(segment.t)));
}

export function composeCycleTarget(phase) {
  const segment = getCycleSegment(phase);
  const amount = cycleBlendAmount(segment);
  const hard = HARD_SEGMENTS.has(segmentKey(segment));
  const from = emotionPreset(segment.a);
  const to = emotionPreset(segment.b);
  const target = copyEmotion(from, COLOR_KEYS);

  for (const key of SCALAR_KEYS) {
    target[key] = hard && LOG_KEYS.has(key)
      ? logLerp(from[key], to[key], amount)
      : from[key] * (1 - amount) + to[key] * amount;
  }
  for (const key of ['pulseMode', 'silverStyle']) target[key] = amount >= 0.5 ? to[key] : from[key];
  target.edgeFlicker = Boolean(EMOTIONS[segment.a].edgeFlicker || EMOTIONS[segment.b].edgeFlicker);
  target.edgeFlickerAmt = (EMOTIONS[segment.a].edgeFlicker ? 1 - amount : 0)
    + (EMOTIONS[segment.b].edgeFlicker ? amount : 0);

  for (const key of COLOR_KEYS) {
    const a = EMOTIONS[segment.a][key];
    const b = EMOTIONS[segment.b][key];
    if (a && b) target[key] = a.map((value, index) => value * (1 - amount) + b[index] * amount);
    else if (a) target[key] = [...a];
    else if (b) target[key] = [...b];
    else delete target[key];
  }
  target.label = `${segment.a.toUpperCase()} ${((1 - amount) * 100).toFixed(0)}% · ${segment.b.toUpperCase()} ${(amount * 100).toFixed(0)}%`;
  return { activeEmotion: amount >= 0.5 ? segment.b : segment.a, segment, target };
}

export function getCycleStyleWeights(segment) {
  const amount = cycleBlendAmount(segment);
  const weights = {
    calm: 0, purple: 0, red: 0, yellow: 0,
    wa: 1 - amount, wb: amount, a: segment.a, b: segment.b,
    st: amount, colorSt: cycleColorBlendAmount(segment),
  };
  const add = (name, weight) => {
    const emotion = EMOTIONS[name];
    if (emotion.pulseMode === 'calm') weights.calm += weight;
    if (emotion.pulseMode === 'wave') weights.purple += weight;
    if (emotion.pulseMode === 'heartbeat') weights.red += weight;
    if (emotion.pulseMode === 'burst' || emotion.silverStyle === 'sparks') weights.yellow += weight;
  };
  add(segment.a, weights.wa);
  add(segment.b, weights.wb);
  return weights;
}

export function getCyclePaintWeights(weights) {
  if (!weights) return null;
  const from = test => (test(EMOTIONS[weights.a]) ? weights.wa : 0)
    + (test(EMOTIONS[weights.b]) ? weights.wb : 0);
  return {
    wYellow: from(emotion => emotion.silverStyle === 'sparks'),
    wShards: from(emotion => emotion.silverStyle === 'shards'),
    wOrbs: (weights.a === 'purple' ? weights.wa : 0) + (weights.b === 'purple' ? weights.wb : 0),
    wCalmBlue: (weights.a === 'blue' ? weights.wa : 0) + (weights.b === 'blue' ? weights.wb : 0),
  };
}

export function emotionPick(weights, name, activeEmotion) {
  if (!weights) return activeEmotion === name ? 1 : 0;
  return (weights.a === name ? weights.wa : 0) + (weights.b === name ? weights.wb : 0);
}

export function shellShimmerRgb(weights, params, target) {
  const pick = name => {
    const emotion = EMOTIONS[name];
    return emotion.hot || emotion.highlight || emotion.mid || emotion.base || emotion.accent || [0.5, 0.5, 0.5];
  };
  if (weights) {
    const a = pick(weights.a); const b = pick(weights.b);
    return a.map((value, index) => value * weights.wa + b[index] * weights.wb);
  }
  const palette = target || params;
  const color = palette.hot || palette.highlight || palette.mid || palette.base || palette.accent;
  return color ? [...color] : [0.5, 0.5, 0.5];
}

export function silverShellAmount(style, silver) {
  if (style === 'shards') return silver * 0.12;
  if (style === 'sparks' || style === 'orbs') return silver * 0.08;
  return silver * 0.05;
}

export function silverInnerAmount(style, silver) {
  if (style === 'sparks') return silver * 0.45;
  if (style === 'shards') return silver * 0.35;
  if (style === 'orbs') return silver * 0.38;
  return silver * 0.25;
}

export function cycleEmotionOffset(from, steps) {
  const index = CYCLE_ORDER.indexOf(from);
  if (index < 0) return from;
  return CYCLE_ORDER[(index + steps + CYCLE_ORDER.length) % CYCLE_ORDER.length];
}
