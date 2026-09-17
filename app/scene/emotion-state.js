import { COLOR_KEYS, CYCLE_SECONDS, EMOTIONS, emotionPreset } from './emotions.js';
import {
  composeCycleTarget,
  getCyclePaintWeights,
  getCycleStyleWeights,
} from './emotion-cycle.js';
import { copyEmotion } from './palette.js';

/**
 * Owns the mutable emotion selection and automatic-cycle clock.
 *
 * Rendering, controls, and presets all read this same object. Centralizing the
 * transition target, displayed emotion, and cycle segment prevents a consumer
 * from observing a new target with the previous segment or active dot.
 */
export function createEmotionState({ initialEmotion = 'red' } = {}) {
  const initial = EMOTIONS[initialEmotion] || EMOTIONS.red;
  const state = {
    cycleOn: false,
    cycleStartAt: 0,
    cycleSegment: { a: 'blue', b: 'purple', t: 0 },
    activeEmotion: initialEmotion,
    params: copyEmotion(initial, COLOR_KEYS),
    target: copyEmotion(initial, COLOR_KEYS),
  };

  function applyCyclePhase(phase) {
    const composed = composeCycleTarget(phase);
    state.cycleSegment = composed.segment;
    state.activeEmotion = composed.activeEmotion;
    state.target = composed.target;
    return state.target;
  }

  state.select = name => {
    state.cycleOn = false;
    state.activeEmotion = name;
    state.target = emotionPreset(name);
    state.target.edgeFlickerAmt = state.target.edgeFlicker ? 1 : 0;
    state.params = copyEmotion(state.target, COLOR_KEYS);
    return state.target;
  };
  state.startCycle = startedAt => {
    state.cycleOn = true;
    state.cycleStartAt = startedAt;
    return applyCyclePhase(0);
  };
  state.tickCycle = now => {
    if (!state.cycleOn) return false;
    const elapsed = (now - state.cycleStartAt) / 1000;
    applyCyclePhase((elapsed % CYCLE_SECONDS) / CYCLE_SECONDS);
    return true;
  };
  state.styleWeights = () => (
    state.cycleOn ? getCycleStyleWeights(state.cycleSegment) : null
  );
  state.paintWeights = () => getCyclePaintWeights(state.styleWeights());

  return state;
}
