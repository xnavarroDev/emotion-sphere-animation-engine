import { createPlaybackState } from '../animation/playback-state.js';
import { createTimeline } from '../animation/timeline.js';
import { createApplicationReadiness } from '../runtime/app-readiness.js';
import { createClassicRendererSettings } from '../scene/classic-renderer-settings.js';
import { createEmotionState } from '../scene/emotion-state.js';
import { createSceneSettings } from '../state/scene-settings.js';

/**
 * Constructs the long-lived mutable state shared by application subsystems.
 *
 * This factory does not hide state or publish globals; it gives the composition
 * root one explicit state bundle that can be passed to scene, editor, preset,
 * and runtime bootstraps. Short-lived UI and renderer state stays local to the
 * subsystem that owns it.
 */
export function createApplicationState() {
  return {
    readiness: createApplicationReadiness(),
    scene: createSceneSettings(),
    playback: createPlaybackState(),
    emotion: createEmotionState(),
    classic: createClassicRendererSettings(),
    sceneTimeline: createTimeline(),
  };
}
