import { copyEmotion, emotionPalette } from './palette.js';

/**
 * Authored visual defaults for the legacy emotion selector and cycle mode.
 *
 * This is configuration, not renderer state. Keeping it in one catalog makes
 * palette tuning reviewable while `emotionPreset` guarantees callers receive
 * mutable copies instead of accidentally changing the shared definitions.
 */
export const COLOR_KEYS = ['shadow', 'deep', 'base', 'mid', 'highlight', 'hot', 'core'];
export const MOTION_KEYS = ['pulse', 'chaos', 'radius', 'size', 'density', 'autoSpeed', 'pulseAmp', 'glowSize', 'glowOp', 'silver', 'chaosFreq', 'pulseMode', 'edgeFlicker', 'silverStyle'];
export const SLIDER_KEYS = ['pulse', 'density', 'chaos', 'radius', 'size'];
export const ANGER_PULSE_BASE = 0.4;
export const CYCLE_ORDER = ['blue', 'purple', 'red', 'yellow'];
export const CYCLE_SECONDS = 28;

export const LOCKED_PARAMS = {
  blue: { size: 6 },
  purple: { size: 4 },
  yellow: { size: 4.75 },
  red: { size: 6 },
};

export const EMOTIONS = {
  blue: emotionPalette({
    label: 'BLUE · CALM · FRIENDLY · SAFE',
    shadowHex: '#040a18', deepHex: '#0a2848', baseHex: '#22b8e8', midHex: '#5ce4ff', highlightHex: '#e8fcff',
    coreHex: '#f6feff', hotHex: '#88f0ff', accentHex: '#ffcf66',
    pulse: 6.5, pulseMode: 'wave', pulseAmp: 0.095, chaos: 0.035, chaosFreq: 0.12, edgeFlicker: false,
    glowSize: 0.034, glowOp: 0.48, silver: 0.09, silverStyle: 'orbs',
    autoSpeed: 0.0016, density: 0.68, size: 6, radius: 1.85,
  }),
  yellow: emotionPalette({
    label: 'YELLOW · CURIOUS · PROCESSING · TRANSITION',
    shadowHex: '#2A1800', deepHex: '#5A4200', baseHex: '#F0C820', midHex: '#FFE878', highlightHex: '#FFFDE8',
    accentHex: '#6fb0ff',
    pulse: 6.5, pulseMode: 'wave', pulseAmp: 0.095, chaos: 0.035, chaosFreq: 0.12, edgeFlicker: false,
    glowSize: 0.034, glowOp: 0.48, silver: 0.09, silverStyle: 'orbs',
    autoSpeed: 0.0016, density: 0.68, size: 4.75, radius: 1.85,
  }),
  red: emotionPalette({
    label: 'RED · DANGER · AGGRESSION · ALERT',
    shadowHex: '#280808', deepHex: '#7A2828', baseHex: '#F04048', hotHex: '#FF7060', coreHex: '#FF8878',
    accentHex: '#74e8ff',
    pulse: 6.5, pulseMode: 'wave', pulseAmp: 0.095, chaos: 0.035, chaosFreq: 0.12, edgeFlicker: false,
    glowSize: 0.034, glowOp: 0.48, silver: 0.09, silverStyle: 'orbs',
    autoSpeed: 0.0016, density: 0.68, size: 6, radius: 1.85,
  }),
  purple: emotionPalette({
    label: 'PURPLE · EMPATHY · BOND · CONNECTION',
    shadowHex: '#140a12', deepHex: '#321828', baseHex: '#8e5888', midHex: '#c890b0', highlightHex: '#f0d0e0',
    accentHex: '#58e1c0',
    pulse: 6.5, pulseMode: 'wave', pulseAmp: 0.095, chaos: 0.035, chaosFreq: 0.12, edgeFlicker: false,
    glowSize: 0.034, glowOp: 0.48, silver: 0.09, silverStyle: 'orbs',
    autoSpeed: 0.0016, density: 0.68, size: 4, radius: 1.85,
  }),
};

export function emotionPreset(name) {
  const preset = copyEmotion(EMOTIONS[name], COLOR_KEYS);
  Object.assign(preset, LOCKED_PARAMS[name]);
  return preset;
}
