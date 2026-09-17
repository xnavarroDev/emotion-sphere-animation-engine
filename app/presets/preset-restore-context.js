/**
 * Builds the renderer-specific adapter consumed by the generic preset restorer.
 *
 * Layer collections are read lazily because they are created by an independent
 * dynamic import. UI side effects for glow and loop values live here so every
 * preset load updates canonical state, compatibility inputs, and rendering in
 * one operation.
 */
export function createPresetRestoreContextFactory({
  documentLike,
  getInnerLayersReady,
  getInnerLayers,
  getFireflyLayers,
  addFireflyLayer,
  removeLastFireflyLayer,
  sceneTimeline,
  classicState,
  hexToRgb,
  applyMode,
  switchEmotion,
  sceneSettings,
  cloud,
  shellPoints,
  playbackState,
  setSceneAnimation,
  sceneSettingsController,
}) {
  return function createRestoreContext({ setCoreParameter, setPresetName, setToggle }) {
    return {
      innerLayersReady: getInnerLayersReady(),
      innerLayers: getInnerLayers(),
      fireflyLayers: getFireflyLayers(),
      addFireflyLayer,
      removeLastFireflyLayer,
      sceneTimeline,
      classicState,
      hexToRgb,
      setCoreParameter,
      applyMode,
      switchEmotion,
      setPresetName,
      setGlowColor(value) {
        sceneSettings.glowColor = value;
        const input = documentLike.getElementById('glow-color');
        if (input) input.value = value;
        cloud.setUserTint(value, null);
      },
      setBackgroundColor: sceneSettingsController.setPrimaryColor,
      setSecondaryBackgroundColor: sceneSettingsController.setSecondaryColor,
      setSceneAnimation,
      setLoop(value) {
        playbackState.loop = value;
        const input = documentLike.getElementById('anim-loop-chk');
        if (input) input.checked = value;
      },
      setGlowVisible: value => setToggle('toggle-glow', value, visible => cloud.setVisible(visible)),
      setFirefliesVisible: value => setToggle(
        'toggle-fireflies', value, visible => { shellPoints.visible = visible; },
      ),
      setGlowOpacity(value) {
        sceneSettings.glowOpacity = value;
        const input = documentLike.getElementById('glow-opacity');
        if (input) input.value = value;
        cloud.setUserTint(null, value);
      },
      setGradientAmount: sceneSettingsController.setGradientAmount,
      setRotationEnabled: sceneSettingsController.setRotationEnabled,
      setRotationSpeed: sceneSettingsController.setRotationSpeed,
    };
  };
}
