import { initializeCoreRuntime } from './bootstrap/core-runtime.js';
import { initializeSceneRenderRuntime } from './bootstrap/scene-render-runtime.js';
import { createApplicationState } from './bootstrap/application-state.js';
import { initializeSceneFoundation } from './bootstrap/scene-foundation.js';
import { initializeEditorRuntime } from './bootstrap/editor-runtime.js';
import { initializeAnimationRuntime } from './bootstrap/animation-runtime.js';
import { initializeThumbnailRuntime } from './bootstrap/thumbnail-runtime.js';
import {
  cloneTimelineSnapshot as cloneSnapshot,
} from './animation/default-timeline.js';
import { createUndoHistory, isNativeTextUndoTarget } from './state/undo-history.js';
import { hexToRgb as hexRgb, rgbToHex as rgbHex } from './scene/color.js';
import { EMOTIONS } from './scene/emotions.js';
import { updateInnerLayerPresentation } from './scene/inner-layer-presentation.js';
import { patchPerVertexPointSize } from './scene/particle-materials.js';
import { emotionCoreRgb } from './scene/palette.js';
import { createClassicParticleState } from './scene/classic-particle-state.js';
import { createLayerPresetConfiguration } from './scene/layer-presets.js';
import { setExpanded, setPressed, setSliderValue } from './ui/accessibility.js';
import { createEmotionControls } from './ui/emotion-controls.js';
import { installRuntimeErrorOverlay } from './ui/runtime-errors.js';

/**
 * Application composition root.
 *
 * Startup flows from shared state to scene resources, animation adapters, and
 * editor contracts. Editor setup yields once while the classic particle scene
 * is built, then publishes its synchronization hooks. Core/preset startup and
 * thumbnail capture follow once their renderer dependencies are available.
 * Per frame, the scene runtime advances emotion cycling and animation, updates
 * classic and layered particles, presents the core/background, and renders.
 */

// Shared state is created before UI or rendering so every subsystem receives
// the same readiness, playback, emotion, scene, and timeline objects.
// Late-bound so editor callbacks can use thumbnails before capture setup finishes.
let thumbnailCaptures=null;
const applicationState=createApplicationState();
const {
  readiness:appReadiness,
  scene:sceneSettings,
  playback:playbackState,
  emotion:emotionState,
  classic:CLASSIC,
  sceneTimeline,
}=applicationState;

installRuntimeErrorOverlay({windowLike:window,documentLike:document});

// Emotion controls mutate canonical emotion state; renderers read that state
// during the next frame rather than owning separate UI-specific copies.
function cycleStyleWeights(){
  return emotionState.styleWeights();
}

function cyclePaintWeights(){
  return emotionState.paintWeights();
}

const emotionControls=createEmotionControls({
  document,
  onEmotion:switchEmotion,
  onCycle:toggleCycle,
  onPrototype:switchPrototype,
});
function setDotActive(id){ emotionControls.setActive(id); }

function switchEmotion(name){
  const selected=emotionState.select(name);
  spawnEnabled=true;
  particleSpawner.reset();
  document.getElementById('label').textContent=selected.label||'';
  setDotActive('d-'+name);
  if(innerSyncUI) innerSyncUI();
  // An emotion change restores its authored palette rather than the previous tint.
  sceneSettings.glowColor='#ffffff';
  const _gc=document.getElementById('glow-color');
  if(_gc) _gc.value='#ffffff';
  cloudBg.setUserTint('#ffffff',null);
  if(backgroundCardSyncUI) backgroundCardSyncUI();
}

function toggleCycle(){
  const selected=emotionState.startCycle(performance.now());
  // Cycling blends palettes while the classic emitter continues spawning.
  spawnEnabled=true;
  setDotActive('d-cycle');
  document.getElementById('label').textContent=selected.label||'';
}

function tickCycle(){
  if(!emotionState.tickCycle(performance.now())) return;
  document.getElementById('label').textContent=emotionState.target.label||'';
}

const SHELL_N=520;
const INNER_N=56;

// Scene foundation: one renderer and settings source for every visual layer.
// It creates resources that remain stable for the lifetime of the application.
const sceneFoundation=initializeSceneFoundation({
  THREE,
  documentLike:document,
  mount:document.body,
  viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
  settings:sceneSettings,
  createCloudBackground,
  shellCount:SHELL_N,
});
const {
  runtime:sceneRuntime,
  group,
  cloud:cloudBg,
  textures:{glow:glowTex,facetGlow:facetGlowTex},
  shell:{
    origins:shellOrig,
    phases:shellPhase,
    colors:shellColors,
    geometry:shellGeo,
    material:shellMat,
    points:shellPoints,
  },
  settingsController:sceneSettingsController,
  controls:{
    setRotationEnabled:setSphereRotate,
    setRotationSpeed:setSphereRotateSpeed,
    setPrimaryColor:setBgColor,
    setSecondaryColor:setBgColor2,
    setGradientAmount:setBgGradientAmount,
  },
}=sceneFoundation;

let spawnEnabled=true;


// Authored layer defaults stay separate from renderer startup.
const {
  innerLayerPresets:INNER_LAYER_PRESETS,
  fireflyEmotionColors:FIREFLY_EMOTION_COLORS,
  fireflyLayerPresets:FIREFLY_LAYER_PRESETS,
  fireflyLayerOverrides:FIREFLY_LAYER_OVERRIDES,
}=createLayerPresetConfiguration(THREE);

// Inner layers are offscreen particle fields composited as additive sprites.
let innerLayers=[];
let innerLayersReady=false;
let innerSyncUI=null;

// Firefly layers form the circle sphere and may override each emotion's palette.
let fireflyLayers=[];
// Readiness prevents preset phases from loading before dynamic layers exist.
let fireflyFieldSyncUI=null;
// Modes switch between layered circles and the classic trail emitter.
let sphereMode='circles';
// These late-bound adapters bridge preset/render code to the asynchronously
// constructed editor without introducing another global event bus.
let applySphereModeFn=null;
let addFireflyLayerFn=null;
let removeLastFireflyLayerFn=null;
let classicSyncUI=null;
let backgroundCardSyncUI=null;
let rpLoopSyncUI=null;
let rpRenderTracksHook=null;
let layoutViewportHook=null;

// Undo reuses complete preset snapshots so both editor surfaces restore together.
const rpUndoBtn=document.getElementById('rp-undo-btn');
const undoHistory=createUndoHistory({
  capture:()=>appReadiness.serialize(),
  restore:()=>appReadiness.getRestore(),
  // Capture the baseline only after scene serialization and editor layers exist.
  ready:()=>appReadiness.ready,
  blurActiveElement:()=>{
    const active=document.activeElement;
    if(active&&active!==document.body) active.blur();
  },
  onAvailabilityChange:available=>{ if(rpUndoBtn) rpUndoBtn.disabled=!available; },
});
appReadiness.onReady(()=>undoHistory.initializeIfReady());
if(rpUndoBtn) rpUndoBtn.addEventListener('click',()=>undoHistory.undo());
document.addEventListener('keydown',(e)=>{
  if(e.key.toLowerCase()!=='z'||(!e.metaKey&&!e.ctrlKey)||e.shiftKey) return;
  // Preserve native per-keystroke undo in text fields. Other inputs use the
  // document history even when a slider or color picker still has focus.
  if(isNativeTextUndoTarget(document.activeElement)) return;
  e.preventDefault();
  undoHistory.undo();
});

// Apply defaults now; the cloud module otherwise begins at full opacity.
cloudBg.setUserTint(sceneSettings.glowColor,sceneSettings.glowOpacity);

// Timeline state: layer tracks wrap independently; the Scene track owns shared settings.
let sceneAnim=true;
let animTimelineSyncHook=null;
// While editing a phase, parameter changes update its snapshot instead of idle state.
let editingPhase=false;
let animFill=null;
let animStop=null;

// Playback owns timing and interpolation; this file supplies live application adapters.
const animationRuntime=initializeAnimationRuntime({
  documentLike:document,
  playbackState,
  sceneTimeline,
  classicState:CLASSIC,
  sceneSettings,
  cloud:cloudBg,
  getLayers:()=>fireflyLayers,
  getSceneEnabled:()=>sceneAnim!==false,
  isReady:()=>innerLayersReady,
  stopPlayback:()=>{ if(animStop) animStop(); },
  setBackgroundColor:setBgColor,
  setSecondaryBackgroundColor:setBgColor2,
  setGradientAmount:setBgGradientAmount,
  syncClassic:()=>{ if(classicSyncUI) classicSyncUI(); },
  syncBackground:()=>{ if(backgroundCardSyncUI) backgroundCardSyncUI(); },
  syncLayerControls:()=>{ if(fireflyFieldSyncUI) fireflyFieldSyncUI(); },
  getProgressElement:()=>animFill,
  isThumbnailCapture:()=>thumbnailCaptures?.isCapturing||false,
});
const trackSeq=animationRuntime.getSequence;
const trackTotal=animationRuntime.getDuration;
const getAnimMaxTotal=animationRuntime.getMaximumDuration;
const applyAnimFrame=animationRuntime.runFrame;

// Layer presentation is the frame-level meeting point for emotion colors,
// per-track animation, and the current seek position.
function updateInnerLayers(t,dt){
  if(!innerLayersReady) return;
  updateInnerLayerPresentation({
    time:t,deltaTime:dt,canvasLayers:innerLayers,fireflyLayers,
    cycleSegment:emotionState.cycleOn?emotionState.cycleSegment:null,
    activeEmotion:emotionState.activeEmotion,
    getActiveColor:()=>emotionCoreRgb(emotionState.params),
    getEmotionCoreColor:name=>emotionCoreRgb(EMOTIONS[name]||{}),
    defaultFireflyColors:FIREFLY_EMOTION_COLORS,
    targetColor:_ffTargetColor,blendColor:_ffBlendColor,seekHold:playbackState.seekHold,
    applyAnimationFrame:applyAnimFrame,
  });
}
const _ffTargetColor=new THREE.Color();
const _ffBlendColor=new THREE.Color();

// Editor contracts isolate the parent bootstrap from application globals.
// Browser capabilities are grouped separately so the bootstrap remains easy to
// test with substitutes and does not reach through window implicitly.
function createEditorEnvironment(){
  return {
    THREE,
    documentLike:document,
    windowLike:window,
    navigatorLike:navigator,
    locationLike:location,
    confirmAction:message=>confirm(message),
  };
}

// Mutable application state is exposed through narrow getters and commands.
// This keeps ownership here while allowing both editor surfaces to coordinate.
function createEditorStateContract(){
  return {
    readiness:appReadiness,
    playbackState,
    emotionState,
    classicState:CLASSIC,
    sceneSettings,
    sceneTimeline,
    undoHistory,
    getSceneEnabled:()=>sceneAnim!==false,
    setSceneEnabled:value=>{ sceneAnim=value; },
    getEditingPhase:()=>editingPhase,
    setEditingPhase:value=>{ editingPhase=value; },
    getSphereMode:()=>sphereMode,
    setSphereMode:value=>{ sphereMode=value; },
  };
}

// Scene commands let the editor change presentation without owning Three.js
// resources or depending on their construction details.
function createEditorSceneContract(){
  return {
    group,
    sceneRuntime,
    cloud:cloudBg,
    shellPoints,
    classicObjects:[
      innerHalo3Pts,
      innerHalo2Pts,
      innerGlowPts,
      innerMatPts,
      trailPoints,
    ],
    setRotationEnabled:setSphereRotate,
    setRotationSpeed:setSphereRotateSpeed,
    setPrimaryColor:setBgColor,
    setSecondaryColor:setBgColor2,
    setGradientAmount:setBgGradientAmount,
    updateLayers:updateInnerLayers,
    getElapsedTime:()=>clock.getElapsedTime(),
    layoutViewport:()=>layoutViewportHook?.(),
  };
}

// Static configuration and runtime services complete the editor's dependency
// graph. Keeping the groups named makes each subsystem boundary visible.
function createEditorRuntimeOptions(){
  return {
    environment:createEditorEnvironment(),
    state:createEditorStateContract(),
    scene:createEditorSceneContract(),
    layerConfiguration:{
      innerLayerPresets:INNER_LAYER_PRESETS,
      fireflyEmotionColors:FIREFLY_EMOTION_COLORS,
      fireflyLayerPresets:FIREFLY_LAYER_PRESETS,
      fireflyLayerOverrides:FIREFLY_LAYER_OVERRIDES,
    },
    animation:{
      getSequence:trackSeq,
      getDuration:trackTotal,
      getMaximumDuration:getAnimMaxTotal,
    },
    thumbnails:{
      captureCurrentPreview:()=>captureThumbnailAt(null,null),
      request:thumbRequest,
      invalidateTrack:thumbInvalidateTrack,
      getAspect:thumbAspect,
      getRuntime:()=>thumbnailCaptures,
    },
    services:{
      cloneSnapshot,
      hexToRgb:hexRgb,
      rgbToHex:rgbHex,
      setExpanded,
      setPressed,
    },
  };
}

// Publish only handles consumed outside the editor runtime.
function publishEditorRuntime(editor){
  innerLayers=editor.innerLayers;
  fireflyLayers=editor.fireflyLayers;
  innerLayersReady=true;
  addFireflyLayerFn=editor.addFireflyLayer;
  removeLastFireflyLayerFn=editor.removeLastFireflyLayer;
  applySphereModeFn=editor.applySphereMode;
  animStop=editor.stopAnimation;
  animFill=editor.progressElement;
  innerSyncUI=editor.sync.inner;
  fireflyFieldSyncUI=editor.sync.firefly;
  classicSyncUI=editor.sync.classic;
  backgroundCardSyncUI=editor.sync.background;
  animTimelineSyncHook=editor.sync.animationTimeline;
  rpLoopSyncUI=editor.sync.loop;
  rpRenderTracksHook=editor.sync.timeline;
}

// Yield until the classic scene objects declared below have been constructed.
// This preserves synchronous module setup while keeping editor loading non-blocking.
async function initializeEditor(){
  await Promise.resolve();
  const editor=await initializeEditorRuntime(createEditorRuntimeOptions());
  publishEditorRuntime(editor);
  appReadiness.markEditorReady();
}

initializeEditor().catch(error=>console.error('editor initialization failed',error));

// Classic particle buffers share one initialization and respawn policy.
const classicParticles=createClassicParticleState({
  count:INNER_N,
  getCoreBias:()=>CLASSIC.coreBias,
});
const {
  positions:innerPos,origins:innerOrig,phases:innerPhase,colors:innerColors,
  axes:innerAxis,births:innerBirth,visibility:innerVis,
  sequenceTint:innerSeqTint,sizes:innerSize,rollParticle:rollInnerDot,
}=classicParticles;
const innerGeo=new THREE.BufferGeometry();
innerGeo.setAttribute('position',new THREE.BufferAttribute(innerPos,3));
innerGeo.setAttribute('color',new THREE.BufferAttribute(innerColors,3));
innerGeo.setAttribute('aSize',new THREE.BufferAttribute(innerSize,1));
// Multiple materials reuse one geometry to build the bright center and softer
// halo passes without duplicating particle lifecycle state.
const innerGlowMat=new THREE.PointsMaterial({
  size:0.065, map:facetGlowTex, vertexColors:true, transparent:true, opacity:0.35,
  blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true, fog:false
});
const innerHalo2Mat=new THREE.PointsMaterial({
  size:0.065, map:glowTex, vertexColors:true, transparent:true, opacity:0.18,
  blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false, sizeAttenuation:true, fog:false
});
const innerHalo3Mat=new THREE.PointsMaterial({
  size:0.065, map:glowTex, vertexColors:true, transparent:true, opacity:0.1,
  blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false, sizeAttenuation:true, fog:false
});
const innerMat=new THREE.PointsMaterial({
  size:0.052, map:glowTex, vertexColors:true, transparent:true, opacity:0.92,
  blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true, fog:false
});
patchPerVertexPointSize(innerGlowMat,'aSize');
patchPerVertexPointSize(innerHalo2Mat,'aSize');
patchPerVertexPointSize(innerHalo3Mat,'aSize');
patchPerVertexPointSize(innerMat,'aSize');
const innerHalo3Pts=new THREE.Points(innerGeo,innerHalo3Mat);
const innerHalo2Pts=new THREE.Points(innerGeo,innerHalo2Mat);
innerHalo3Pts.renderOrder=2;
innerHalo2Pts.renderOrder=3;
group.add(innerHalo3Pts);
group.add(innerHalo2Pts);
const innerGlowPts=new THREE.Points(innerGeo,innerGlowMat);
const innerMatPts=new THREE.Points(innerGeo,innerMat);
group.add(innerGlowPts);
group.add(innerMatPts);

// Scene render loop and classic particle lifecycle.
let sphereCore=null;
const sceneRenderRuntime=initializeSceneRenderRuntime({
  THREE,documentLike:document,windowLike:window,group,sceneRuntime,
  cloud:cloudBg,getCore:()=>sphereCore,classic:CLASSIC,
  shell:{
    count:SHELL_N,origin:shellOrig,phases:shellPhase,colors:shellColors,
    geometry:shellGeo,
  },
  inner:{
    count:INNER_N,initialPositions:innerPos,origin:innerOrig,phases:innerPhase,
    colors:innerColors,geometry:innerGeo,sequenceTint:innerSeqTint,
    axes:innerAxis,births:innerBirth,visibility:innerVis,
  },
  materials:{
    shell:shellMat,inner:innerMat,glow:innerGlowMat,
    halo2:innerHalo2Mat,halo3:innerHalo3Mat,
  },
  trailTexture:glowTex,
  getTrailLifetime:()=>CLASSIC.trailLife,
  getSpawnInterval:()=>CLASSIC.interval,
  // A reused particle receives a fresh distribution, birth time, size, and trail.
  onSpawn:(index,currentTime,trails)=>{
    rollInnerDot(index);
    innerBirth[index]=currentTime;
    innerSize[index]=1+Math.random()*0.75;
    trails.resetPrevious(index);
  },
  getColorState:()=>({
    params:emotionState.params,target:emotionState.target,
    cycleWeights:cycleStyleWeights(),activeEmotion:emotionState.activeEmotion,
  }),
  getFrameState:()=>({
    params:emotionState.params,target:emotionState.target,
    cycleOn:emotionState.cycleOn,cycleSegment:emotionState.cycleSegment,
    activeEmotion:emotionState.activeEmotion,spawnEnabled,
    cycleWeights:cycleStyleWeights(),paintWeights:cyclePaintWeights(),
    rotationEnabled:sceneSettings.rotationEnabled,
    rotationSpeed:sceneSettings.rotationSpeed,
    scrubbing:playbackState.scrubbing,
  }),
  tickCycle,updateInnerLayers,
  onSceneResize:(width,height)=>cloudBg.onResize(width,height),
});
const {particleSpawner,trailPoints,clock}=sceneRenderRuntime;
// The viewport hook is published late because its layout depends on editor chrome.
layoutViewportHook=sceneRenderRuntime.viewport.layout;
let selectCorePrototype=()=>false;
function switchPrototype(name){
  selectCorePrototype(name);
}

// Core attachment gates preset restoration because presets may target core controls.
initializeCoreRuntime({
  THREE,group,
  innerLayers:[innerHalo3Pts,innerHalo2Pts,innerGlowPts,innerMatPts,trailPoints],
  documentLike:document,emotionControls,
  getSphereMode:()=>sphereMode,
  applySphereMode:mode=>applySphereModeFn?.(mode),
  onCoreReady:core=>{ sphereCore=core; },
  onPrototypeControlsReady:controls=>{ selectCorePrototype=controls.select; },
  presetRuntimeOptions:{
    // Preset I/O receives browser capabilities explicitly for testability.
    environment:{
      documentLike:document,windowLike:window,navigatorLike:navigator,
      locationLike:location,fetchLike:fetch,
    },
    readiness:appReadiness,
    // Getters always serialize current layers rather than startup snapshots.
    documentState:{
      getInnerLayersReady:()=>innerLayersReady,
      getInnerLayers:()=>innerLayers,
      getFireflyLayers:()=>fireflyLayers,
      sceneTimeline,classicState:CLASSIC,sceneSettings,
      setSceneAnimation:value=>{ sceneAnim=value; },
      collectSerializationState:()=>({
        fireflyLayers,classic:CLASSIC,sceneTimeline,sceneAnimation:sceneAnim,
        viewState:{
          emotion:emotionState.activeEmotion,mode:sphereMode,loop:playbackState.loop,
          glowColor:sceneSettings.glowColor,glowOpacity:sceneSettings.glowOpacity,
          bgColor:sceneSettings.backgroundColor,bgColor2:sceneSettings.secondaryBackgroundColor,
          bgGradientAmount:sceneSettings.gradientAmount,
          rotate:sceneSettings.rotationEnabled,rotateSpeed:sceneSettings.rotationSpeed,
        },
      }),
    },
    // Restoration commands update renderer resources and compatibility UI as
    // the parsed document is applied.
    restoreAdapters:{
      addFireflyLayer:()=>addFireflyLayerFn?.()||null,
      removeLastFireflyLayer:()=>removeLastFireflyLayerFn?.()||false,
      hexToRgb:hexRgb,applyMode:value=>applySphereModeFn?.(value),switchEmotion,
      cloud:cloudBg,shellPoints,sceneSettingsController,
    },
    playback:{state:playbackState,getSequence:trackSeq,getDuration:trackTotal},
    // Undo distinguishes user edits from whole-document restoration.
    history:{
      isRestoring:()=>undoHistory.restoring,
      resetAfterLoad:()=>undoHistory.resetAfterDocumentLoad(),
    },
    // One post-restore pass reconciles both editor surfaces with canonical state.
    syncAfterRestore:()=>{
      innerSyncUI?.(); fireflyFieldSyncUI?.(); classicSyncUI?.();
      animTimelineSyncHook?.(); rpLoopSyncUI?.(); backgroundCardSyncUI?.();
      rpRenderTracksHook?.();
    },
    clearThumbnails:()=>thumbnailCaptures?.clear(),
    emotionControls,setDotActive,setPressed,
    setAnimationSpeed:sceneRenderRuntime.setAnimationSpeed,
  },
}).catch(err=>console.error('sphere-core failed',err));

// Establish the authored default once renderer-facing adapters are registered.
switchEmotion('red');

// Capture initializes last because thumbnails snapshot the complete scene and clock.
// These forwarding functions keep earlier editor contracts stable while the
// concrete capture runtime is still unavailable.
function thumbAspect(){
  return thumbnailCaptures?.getAspect()||16/9;
}
function captureThumbnailAt(){
  return thumbnailCaptures?.captureCurrentPreview()||null;
}
function thumbRequest(trackIndex,seconds,element){
  thumbnailCaptures?.request(trackIndex,seconds,element);
}
function thumbInvalidateTrack(trackIndex){
  thumbnailCaptures?.invalidateTrack(trackIndex);
}

thumbnailCaptures=initializeThumbnailRuntime({
  THREE,
  documentLike:document,
  windowLike:window,
  sceneRuntime,
  cloud:cloudBg,
  playbackState,
  classicState:CLASSIC,
  sceneSettings,
  getLayers:()=>fireflyLayers,
  getClockTime:()=>clock.getElapsedTime(),
  updateLayers:updateInnerLayers,
  getSequence:trackSeq,
  getDuration:trackTotal,
  setBackgroundColor:setBgColor,
  setSecondaryBackgroundColor:setBgColor2,
  setGradientAmount:setBgGradientAmount,
  syncClassic:()=>{ if(classicSyncUI) classicSyncUI(); },
  syncBackground:()=>{ if(backgroundCardSyncUI) backgroundCardSyncUI(); },
});
