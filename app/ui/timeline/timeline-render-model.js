import { calculatePhaseSpans } from '../../animation/timeline-layout.js';
import { mixHex } from '../../scene/color.js';

/** Return the pale timeline-band tint for one captured phase. */
export function timelineSegmentTint(phase, isScene, phaseIndex) {
  const snapshot = phase.snapshot;
  if (!snapshot) return 'rgba(20,22,28,0.08)';
  const capturedColor = (isScene ? snapshot.bgColor : snapshot.colour) || null;
  if (!capturedColor) return phaseIndex % 2 ? '#e9f2ff' : '#cedbeb';
  return mixHex(phaseIndex % 2 ? '#e9f2ff' : '#dbe6f5', capturedColor, 0.30);
}

/**
 * Convert mutable layer/timeline state into the immutable facts needed for a
 * full timeline DOM rebuild. Keeping this mapping out of the renderer makes
 * the layer-versus-scene rules, fallback labels, and shared-axis geometry
 * reviewable without following element creation and event wiring.
 */
export function buildTimelineRenderModel({
  layers,
  sceneTimeline,
  sceneEnabled,
  activeTrackIndex,
  editingPhase,
  axisSeconds,
  easingLabels,
  tintPhase = timelineSegmentTint,
}) {
  const sources = [
    ...layers.map((layer, index) => ({ index, layer, timeline: layer.timeline, isScene: false })),
    { index: layers.length, layer: null, timeline: sceneTimeline, isScene: true },
  ];

  return {
    tracks: sources.map(source => {
      const { index, layer, timeline, isScene } = source;
      const label = isScene ? 'Background' : (layer.name || `Layer ${index + 1}`);
      const spans = calculatePhaseSpans(timeline, axisSeconds);
      return {
        index,
        layer,
        timeline,
        isScene,
        label,
        focused: activeTrackIndex === index,
        enabled: isScene ? sceneEnabled !== false : layer.anim !== false,
        phases: timeline.map((phase, phaseIndex) => {
          const easing = phase.ease || 'smootherstep';
          return {
            phase,
            phaseIndex,
            ...spans[phaseIndex],
            shownName: phase.name || (phaseIndex === 0 ? 'Starting' : `Phase ${phaseIndex + 1}`),
            easing,
            easingTitle: `Easing: ${easingLabels[easing] || easing} — click to change`,
            editing: editingPhase === phase,
            tint: tintPhase(phase, isScene, phaseIndex),
            hasSeam: phaseIndex < timeline.length - 1,
          };
        }),
      };
    }),
  };
}
