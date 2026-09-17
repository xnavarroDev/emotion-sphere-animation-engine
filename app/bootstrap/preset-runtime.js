import { restartPlaybackFromBeginning } from '../animation/playback-session.js';
import { createPresetDocumentController } from '../presets/preset-document-controller.js';
import { createPresetRestoreContextFactory } from '../presets/preset-restore-context.js';
import { createPresetShareUrl, decodePresetParam } from '../presets/share-url.js';
import { createEmotionSphereApi } from '../runtime/emotion-api.js';
import { createKioskRuntimeController } from '../runtime/kiosk-runtime.js';
import { createLegacyPresetActions } from '../ui/legacy/legacy-preset-actions.js';

/**
 * Boots preset persistence and the public/kiosk runtime as one subsystem.
 *
 * This is a composition module: format, restore, playback, and URL policy stay
 * in their focused dependencies, while their initialization order lives here.
 * Getter-based inputs preserve the editor's asynchronous layer construction
 * without exposing those implementation details through browser globals.
 */
export async function initializePresetRuntime({
  environment,
  readiness,
  documentState,
  restoreAdapters,
  playback,
  history,
  syncAfterRestore,
  clearThumbnails,
  emotionControls,
  setDotActive,
  setPressed,
  setAnimationSpeed,
}) {
  const {
    documentLike, windowLike, navigatorLike, locationLike, fetchLike,
  } = environment;
  const createRestoreContext = createPresetRestoreContextFactory({
    documentLike,
    getInnerLayersReady: documentState.getInnerLayersReady,
    getInnerLayers: documentState.getInnerLayers,
    getFireflyLayers: documentState.getFireflyLayers,
    addFireflyLayer: restoreAdapters.addFireflyLayer,
    removeLastFireflyLayer: restoreAdapters.removeLastFireflyLayer,
    sceneTimeline: documentState.sceneTimeline,
    classicState: documentState.classicState,
    hexToRgb: restoreAdapters.hexToRgb,
    applyMode: restoreAdapters.applyMode,
    switchEmotion: restoreAdapters.switchEmotion,
    sceneSettings: documentState.sceneSettings,
    cloud: restoreAdapters.cloud,
    shellPoints: restoreAdapters.shellPoints,
    playbackState: playback.state,
    setSceneAnimation: documentState.setSceneAnimation,
    sceneSettingsController: restoreAdapters.sceneSettingsController,
  });

  const presetDocument = createPresetDocumentController({
    documentLike,
    collectSerializationState: documentState.collectSerializationState,
    clearThumbnails,
    createRestoreContext,
    syncAfterRestore,
    isHistoryRestoring: history.isRestoring,
    resetHistoryAfterLoad: history.resetAfterLoad,
    setPressed,
  });
  const serialize = presetDocument.serialize;
  const restore = presetDocument.restore;
  readiness.registerDocumentAdapter({ serialize, restore });

  createLegacyPresetActions({
    documentLike,
    clipboard: navigatorLike.clipboard,
    serialize,
    apply: restore,
    createShareUrl: text => createPresetShareUrl(text, locationLike),
  });

  function startPlayback() {
    Object.assign(playback.state, restartPlaybackFromBeginning({
      layers: documentState.getFireflyLayers(),
      getSequence: playback.getSequence,
      getDuration: playback.getDuration,
    }));
  }
  const applyPresetWhenReady = text => readiness.whenEditorReady.then(() => {
    restore(text);
    startPlayback();
  });
  const emotionApi = createEmotionSphereApi({
    fetchLike,
    applyPresetWhenReady,
    setAnimationSpeed,
  });
  windowLike.emotionSphere = emotionApi;

  const kioskRuntime = createKioskRuntimeController({
    windowLike,
    body: documentLike.body,
    emotionControls,
    emotionApi,
    applyPresetWhenReady,
    decodePreset: decodePresetParam,
    setDotActive,
  });
  const kioskOptions = kioskRuntime.configure(locationLike.search);
  await kioskRuntime.applyInitialSelection(kioskOptions);

  // URL state is authoritative, so only capture the reset baseline after the
  // initial shared preset or emotion has completely settled.
  readiness.captureDefault();
  kioskRuntime.connectMessages();
  return { serialize, restore, emotionApi, kioskRuntime };
}
