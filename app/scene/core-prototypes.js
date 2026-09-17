/**
 * Builds the authored motion/shape/glow looks used by the sphere-core buttons.
 *
 * Prototypes intentionally contain no color: emotion selection owns palette,
 * while these presets only change geometry and motion. Returning fresh objects
 * also prevents a renderer that normalizes its input from mutating the defaults
 * used by a later reset.
 */
export function createCorePrototypes() {
  const core = {
    count: 15000,
    scale: 0.58,
    coreBias: 1,
    edgeFeather: 0.18,
    flowAmp: 0.16,
    flowFreq: 1.9,
    flowSpeed: 0.18,
    jitter: 0.04,
    jitterSpeed: 0.6,
    rotSpeed: 0.06,
    rotWander: 0.9,
    rotWanderFreq: 0.09,
    diffSwirl: 0.5,
    breathAmp: 0,
    breathSpeed: 0,
    pointSize: 4.5,
    sizeJitter: 0.6,
    glow: 6.5,
    brightness: 0.8,
    seed: 1,
  };

  return {
    core,
    dense: {
      ...core,
      count: 45000,
      coreBias: 2.8,
      edgeFeather: 0.3,
      pointSize: 3,
      sizeJitter: 0.8,
      glow: 8.5,
      brightness: 0.95,
    },
    flow: {
      ...core,
      count: 30000,
      coreBias: 1.2,
      flowAmp: 0.22,
      flowFreq: 2.4,
      flowSpeed: 0.22,
      jitter: 0.05,
      jitterSpeed: 0.7,
      diffSwirl: 0.8,
      pointSize: 4,
      brightness: 0.85,
    },
    breath: {
      ...core,
      count: 20000,
      coreBias: 0.9,
      breathAmp: 0.12,
      breathSpeed: 0.4,
      rotWander: 1.6,
      pointSize: 7,
      sizeJitter: 0.4,
      glow: 7,
      brightness: 0.78,
    },
  };
}
