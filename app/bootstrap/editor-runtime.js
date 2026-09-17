import { createFireflyLayerCollection } from '../scene/firefly-layer-collection.js';
import { createCanvasParticleLayers, createFireflyLayerFactory } from '../scene/layer-factories.js';
import { initializeEditorShell } from './editor-shell.js';
import { initializeLayerControlSuite } from './layer-control-suite.js';
import { initializeLegacyAnimationEditor } from './legacy-animation-editor.js';
import { initializeParameterEditor } from './parameter-editor.js';
import { initializeTimelineEditor } from './timeline-editor.js';

/** Compose particle-backed editor features from grouped application contracts. */
export async function initializeEditorRuntime({
  environment,state,scene,layerConfiguration,animation,thumbnails,services,
}){
  const {THREE,documentLike,windowLike,navigatorLike,locationLike,confirmAction}=environment;
  const {
    readiness,playbackState,emotionState,classicState,sceneSettings,sceneTimeline,undoHistory,
    getSceneEnabled,setSceneEnabled,getEditingPhase,setEditingPhase,getSphereMode,setSphereMode,
  }=state;
  const {
    group,sceneRuntime,cloud,shellPoints,classicObjects,
    setRotationEnabled,setRotationSpeed,setPrimaryColor,setSecondaryColor,setGradientAmount,
    updateLayers,getElapsedTime,layoutViewport,
  }=scene;
  const {
    innerLayerPresets,fireflyEmotionColors,fireflyLayerPresets,fireflyLayerOverrides,
  }=layerConfiguration;
  const {getSequence,getDuration,getMaximumDuration}=animation;
  const {cloneSnapshot,hexToRgb,rgbToHex,setExpanded,setPressed}=services;

  // Particle engines stay lazy-loaded because their WebGL setup is needed only
  // by the interactive editor, not by the static module graph.
  const [fieldModule,controlModule,fireflyModule]=await Promise.all([
    import('../../field.js?v=8'),
    import('../../particle-controls.js?v=8'),
    import('../../firefly-field.js?v=31'),
  ]);
  const {ParticleField,DEFAULTS}=fieldModule;
  const {SLIDER_DEFS}=controlModule;
  const {createFireflyField,FIREFLY_DEFAULTS}=fireflyModule;

  const innerLayers=createCanvasParticleLayers({
    THREE,documentLike,ParticleField,defaults:DEFAULTS,presets:innerLayerPresets,group,
  });
  const layerFactory=createFireflyLayerFactory({
    THREE,createFireflyField,group,pixelRatio:sceneRuntime.pixelRatio,
    getActiveEmotion:()=>emotionState.activeEmotion,getSphereMode,
    defaultColors:fireflyEmotionColors,maxLayers:8,
  });
  const layerCollection=createFireflyLayerCollection({
    factory:layerFactory,presets:fireflyLayerPresets,overrides:fireflyLayerOverrides,
  });
  const fireflyLayers=layerCollection.layers;
  const addFireflyLayer=()=>layerCollection.add();
  const removeLastFireflyLayer=()=>layerCollection.removeLast();
  const makeFireflyLayer=(preset={},overrides={})=>layerFactory.create(preset,overrides);
  const disposeFireflyLayer=field=>layerFactory.dispose(field);
  innerLayers.forEach(layer=>{ layer.sprite.visible=false; });
  shellPoints.visible=false;
  documentLike.getElementById('toggle-fireflies')?.classList.remove('active');

  let activeLayerIndex=0;
  let syncAnimationLayers=()=>{};
  let syncParameters=()=>{};
  let addPhaseToActiveTrack=()=>{};
  let timelineSelection=null;
  let phasePlacement=null;
  let modernTransport=null;
  let renderTimeline=()=>{};
  let panelReady=false;

  // Layer controls establish the shared active-layer cursor used by both the
  // compatibility controls and the redesigned parameter panel.
  const layerControls=initializeLayerControlSuite({
    documentLike,clipboard:navigatorLike.clipboard,classicState,playbackState,
    getFireflyLayers:()=>fireflyLayers,getInnerLayers:()=>innerLayers,
    getActiveIndex:()=>activeLayerIndex,setActiveIndex:index=>{ activeLayerIndex=index; },
    getActiveEmotion:()=>emotionState.activeEmotion,getEmotionParams:()=>emotionState.params,
    getEditingPhase,layerCollection,addLayer:addFireflyLayer,
    syncAnimationLayers:()=>syncAnimationLayers(),
    syncParameterEditor:()=>{ if(panelReady) syncParameters(); },
    setSphereMode,classicObjects,shellPoints,innerSliderDefinitions:SLIDER_DEFS,
    innerDefaults:DEFAULTS,innerPresets:innerLayerPresets,hexToRgb,rgbToHex,
    addPhaseToActiveTrack:()=>addPhaseToActiveTrack(),setPressed,
  });
  if(!layerControls) throw new Error('inner-layer controls could not initialize');

  // The legacy editor remains the canonical timeline workspace and snapshot
  // adapter while the modern timeline supplies its newer presentation.
  let syncBackground=()=>{};
  const legacyEditor=initializeLegacyAnimationEditor({
    documentLike,search:locationLike.search,readiness,playbackState,sceneTimeline,
    classicState,sceneSettings,cloud,getLayers:()=>fireflyLayers,
    getInnerLayers:()=>innerLayers,getSceneEnabled,setSceneEnabled,
    colorToHex:layerControls.colorToHex,cloneSnapshot,
    setBackgroundColor:setPrimaryColor,setSecondaryBackgroundColor:setSecondaryColor,
    setGradientAmount,syncClassic:layerControls.syncClassic,
    syncBackground:()=>syncBackground(),selectLayer:layerControls.selectFirefly,
    syncLayer:layerControls.syncFirefly,syncInnerLayers:layerControls.syncInner,
    getModernTransport:()=>modernTransport,renderModernTimeline:()=>renderTimeline(),
    getActiveLayerIndex:()=>activeLayerIndex,
    setActiveLayerIndex:index=>{ activeLayerIndex=index; },
    innerDefaults:DEFAULTS,innerPresets:innerLayerPresets,
    fireflyDefaults:FIREFLY_DEFAULTS,fireflyPresets:fireflyLayerPresets,
    fireflyOverrides:fireflyLayerOverrides,createFireflyLayer:makeFireflyLayer,
    disposeFireflyLayer,setPressed,setEditingPhase,
  });
  syncAnimationLayers=legacyEditor.syncLayers;
  addPhaseToActiveTrack=legacyEditor.addPhaseToActiveTrack;

  // Shell and parameter setup precede timeline setup because the timeline
  // renders into shell-owned elements and edits parameter-owned phase state.
  const shell=initializeEditorShell({
    documentLike,clipboard:navigatorLike.clipboard,
    confirmDiscard:()=>confirmAction('Start a new preset? Your unsaved changes will be lost.'),
    readiness,undoHistory,captureCurrentPreview:thumbnails.captureCurrentPreview,
    loadPreset:emotion=>windowLike.emotionSphere.play(emotion),layoutViewport,
  });
  const parameterEditor=initializeParameterEditor({
    documentLike,confirmAction,sliderDefinitions:layerControls.sliderDefinitions,
    playbackState,sceneSettings,cloud,timelineContainer:shell.timelineContainer,
    timelineTracks:shell.timelineTracks,timelineWorkspace:legacyEditor.workspace,
    layerCollection,getLayers:()=>fireflyLayers,getActiveIndex:()=>activeLayerIndex,
    setActiveIndex:index=>{ activeLayerIndex=index; },
    getActiveEmotion:()=>emotionState.activeEmotion,getEditingPhase,
    stopEditingPhase:()=>setEditingPhase(false),getTimelineSelection:()=>timelineSelection,
    getPhasePlacement:()=>phasePlacement,getTimelines:legacyEditor.getTimelines,
    captureTrackSnapshot:legacyEditor.captureTrackSnapshot,
    captureSnapshotForTrack:legacyEditor.captureSnapshotForTrack,cloneSnapshot,
    addLayer:addFireflyLayer,syncLayers:layerControls.syncFirefly,
    syncAnimationLayers:()=>syncAnimationLayers(),renderTracks:()=>renderTimeline(),
    stopAnimation:legacyEditor.stopPlayback,
    invalidateThumbnailTrack:thumbnails.invalidateTrack,colorToHex:layerControls.colorToHex,
    setRotationEnabled,setRotationSpeed,setPrimaryColor,setSecondaryColor,setGradientAmount,
    markDirty:shell.markDirty,
  });
  syncParameters=parameterEditor.syncParameters;
  syncBackground=parameterEditor.syncBackground;

  // Cross-feature callbacks above intentionally begin as no-ops. Connecting
  // them here closes the initialization cycle without exposing mutable globals.
  const timelineEditor=initializeTimelineEditor({
    documentLike,windowLike,navigatorLike,locationLike,
    elements:createTimelineElements(documentLike,shell,parameterEditor.sceneControls),
    playbackState,sceneTimeline,getLayers:()=>fireflyLayers,getSceneEnabled,setSceneEnabled,
    getActiveTrackIndex:()=>legacyEditor.workspace.activeTrackIndex,
    setActiveTrack:legacyEditor.workspace.setActiveTrack,
    getActiveTimeline:legacyEditor.getActiveTimeline,isSceneTrack:legacyEditor.isSceneTrack,
    getTimelines:legacyEditor.getTimelines,getSequence,getDuration,getMaximumDuration,
    captureTrackSnapshot:legacyEditor.captureTrackSnapshot,
    captureSnapshotForTrack:legacyEditor.captureSnapshotForTrack,
    applyTrackSnapshot:legacyEditor.applyTrackSnapshot,cloneSnapshot,
    livePhaseEditor:parameterEditor.livePhaseEditor,
    getEditingPhase:()=>parameterEditor.livePhaseEditor.phase,
    updateInnerLayers:updateLayers,getElapsedTime,syncParameters,
    syncLegacyLayers:()=>syncAnimationLayers(),syncLayers:layerControls.syncFirefly,
    stopAnimation:legacyEditor.stopPlayback,markDirty:shell.markDirty,
    invalidateThumbnailTrack:thumbnails.invalidateTrack,
    requestThumbnail:thumbnails.request,getThumbnailAspect:thumbnails.getAspect,
    getThumbnailCaptures:thumbnails.getRuntime,layoutViewport,
    serializePreset:()=>readiness.serialize(),legacyTransport:legacyEditor.legacyTransport,
    setExpanded,setPressed,
  });
  phasePlacement=timelineEditor.phasePlacement;
  timelineSelection=timelineEditor.selection;
  modernTransport=timelineEditor.transport;
  renderTimeline=timelineEditor.render;
  panelReady=true;
  syncParameters();

  return {
    innerLayers,fireflyLayers,
    addFireflyLayer,removeLastFireflyLayer,
    applySphereMode:layerControls.applySphereMode,
    stopAnimation:legacyEditor.stopPlayback,
    progressElement:legacyEditor.progressElement,
    sync:{
      inner:layerControls.syncInner,firefly:layerControls.syncFirefly,
      classic:layerControls.syncClassic,background:parameterEditor.syncBackground,
      animationTimeline:legacyEditor.syncTimeline,loop:timelineEditor.syncLoop,
      timeline:timelineEditor.render,
    },
  };
}

function createTimelineElements(documentLike,shell,sceneControls){
  return {
    container:shell.timelineContainer,tracks:shell.timelineTracks,
    time:documentLike.getElementById('rp-anim-time'),
    play:documentLike.getElementById('rp-anim-play'),
    reset:documentLike.getElementById('rp-anim-reset'),
    loop:documentLike.getElementById('rp-anim-loop'),
    playIcon:documentLike.getElementById('rp-anim-play-ico'),
    addPhase:documentLike.getElementById('rp-anim-add-phase'),
    clearPhases:documentLike.getElementById('rp-anim-clear-phases'),
    shareLink:documentLike.getElementById('rp-share-link'),
    resizeGrip:documentLike.getElementById('rp-anim-resize'),
    sceneControls:{
      paramsSection:documentLike.getElementById('rp-params-section'),
      paramsHeader:documentLike.getElementById('rp-params-head'),
      paramsChevron:documentLike.querySelector('#rp-params-head .chev'),
      ...sceneControls,
    },
  };
}
