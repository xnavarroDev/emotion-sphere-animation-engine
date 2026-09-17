import { emotionCoreRgb } from '../scene/palette.js';
import { createClassicEmitterControls } from '../ui/controls/classic-emitter-controls.js';
import {
  createFireflyFieldControls,
  fireflyColorHex,
  FIREFLY_SLIDER_DEFINITIONS,
} from '../ui/controls/firefly-field-controls.js';
import { createInnerLayerControls } from '../ui/controls/inner-layer-controls.js';
import { createSphereModeControls } from '../ui/controls/sphere-mode-controls.js';

/**
 * Initializes the four control families that select and present particle
 * layers. Their render/state dependencies remain explicit, while app.js only
 * receives the synchronization commands needed by other feature bootstraps.
 */
export function initializeLayerControlSuite({
  documentLike,
  clipboard,
  classicState,
  playbackState,
  getFireflyLayers,
  getInnerLayers,
  getActiveIndex,
  setActiveIndex,
  getActiveEmotion,
  getEmotionParams,
  getEditingPhase,
  layerCollection,
  addLayer,
  syncAnimationLayers,
  syncParameterEditor,
  setSphereMode,
  classicObjects,
  shellPoints,
  innerSliderDefinitions,
  innerDefaults,
  innerPresets,
  hexToRgb,
  rgbToHex,
  addPhaseToActiveTrack,
  setPressed,
}){
  const fireflyControls=createFireflyFieldControls({
    documentLike,
    getLayers:getFireflyLayers,
    getActiveIndex,
    setActiveIndex,
    getActiveEmotion,
    isAnimating:()=>playbackState.playing,
    isEditingPhase:getEditingPhase,
    onAdd:()=>{
      const layer=addLayer();
      return layer?getFireflyLayers().length-1:null;
    },
    onSplit:index=>layerCollection.split(index),
    onRemove:index=>layerCollection.remove(index),
    onSelectionSync:syncAnimationLayers,
    onPanelSync:syncParameterEditor,
    setPressed,
  });
  const syncFirefly=()=>fireflyControls.sync();
  syncFirefly();

  const classicControls=createClassicEmitterControls({documentLike,state:classicState});
  const sphereControls=createSphereModeControls({
    documentLike,
    getCircleLayers:getFireflyLayers,
    classicObjects,
    shellPoints,
    setMode:setSphereMode,
    setPressed,
  });

  const innerControls=createInnerLayerControls({
    documentLike,
    clipboard,
    sliderDefinitions:innerSliderDefinitions,
    getLayers:getInnerLayers,
    getActiveEmotion,
    getFallbackColor:()=>emotionCoreRgb(getEmotionParams()),
    hexToRgb,
    rgbToHex,
    resetLayer:index=>getInnerLayers()[index].field.setParams({
      ...innerDefaults,
      background:[0,0,0,0],
      glowOscAmp:0,
      breathAmp:0,
      breathSpeed:0,
      ...innerPresets[index],
    }),
    capturePhase:addPhaseToActiveTrack,
    setPressed,
  });
  if(!innerControls) return null;

  return {
    sliderDefinitions:FIREFLY_SLIDER_DEFINITIONS,
    colorToHex:fireflyColorHex,
    syncFirefly,
    selectFirefly:index=>fireflyControls.select(index),
    syncClassic:()=>classicControls.sync(),
    applySphereMode:mode=>sphereControls.apply(mode),
    syncInner:()=>innerControls.sync(),
  };
}
