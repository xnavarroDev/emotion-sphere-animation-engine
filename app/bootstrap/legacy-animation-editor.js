import { createDefaultTimelineSeeder } from '../animation/default-timeline-seeder.js';
import { prepareTimelinePlayback, restoreIdleLayerState } from '../animation/playback-session.js';
import { applyTrackSnapshotToEditor } from '../animation/track-snapshot.js';
import { toggleAnimationEnabled } from '../animation/timeline-edit.js';
import { createTimelineWorkspace } from '../animation/timeline-workspace.js';
import {
  respawnFireflyLayers,
  restoreDefaultLayerConfiguration,
  zeroParticleLayers,
} from '../scene/layer-reset.js';
import { createLegacyAnimationTransport } from '../ui/legacy/legacy-animation-transport.js';
import { createLegacyPhaseList } from '../ui/legacy/legacy-phase-list.js';
import { wireLegacyDisclosure } from '../ui/shell/disclosures.js';
import { createAnimationTrackSelector } from '../ui/timeline/animation-track-selector.js';

/**
 * Keeps the compatibility animation editor attached to canonical timeline and
 * playback state. The legacy controls remain supported, but their DOM wiring
 * no longer spreads workspace and transport dependencies through app.js.
 */
export function initializeLegacyAnimationEditor({
  documentLike,
  search,
  readiness,
  playbackState,
  sceneTimeline,
  classicState,
  sceneSettings,
  cloud,
  getLayers,
  getInnerLayers,
  getSceneEnabled,
  setSceneEnabled,
  colorToHex,
  cloneSnapshot,
  setGlowColor,
  setGlowOpacity,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setGradientAmount,
  syncClassic,
  syncBackground,
  selectLayer,
  syncLayer,
  syncInnerLayers,
  getModernTransport,
  renderModernTimeline,
  getActiveLayerIndex,
  setActiveLayerIndex,
  innerDefaults,
  innerPresets,
  fireflyDefaults,
  fireflyPresets,
  fireflyOverrides,
  createFireflyLayer,
  disposeFireflyLayer,
  setPressed,
  setEditingPhase,
}){
  const phasesElement=documentLike.getElementById('anim-phases');
  const playButton=documentLike.getElementById('anim-play-btn');
  const progressElement=documentLike.getElementById('anim-progress-fill');
  const loopCheckbox=documentLike.getElementById('anim-loop-chk');
  playbackState.loop=loopCheckbox.checked;

  const workspace=createTimelineWorkspace({
    getLayers,
    sceneTimeline,
    classicState,
    sceneSettings,
    colorToHex,
  });
  const isSceneTrack=()=>workspace.isSceneTrack();
  const getActiveTimeline=()=>workspace.getActiveTimeline();
  const getTimelines=()=>workspace.getAllTimelines();
  const captureSnapshotForTrack=index=>workspace.captureSnapshot(index);
  const captureTrackSnapshot=()=>workspace.captureActiveSnapshot();

  let rebuildPhaseRows=()=>{};
  const trackSelector=createAnimationTrackSelector({
    documentLike,
    anchor:phasesElement,
    getLayers,
    getActiveIndex:()=>workspace.activeTrackIndex,
    setActiveIndex:workspace.setActiveTrack,
    getSceneEnabled,
    setSceneEnabled,
    toggleEnabled:toggleAnimationEnabled,
    onSelectionChange:()=>rebuildPhaseRows(),
    onLayerCountChange:()=>rebuildPhaseRows(),
    setPressed,
  });
  const syncTrack=()=>trackSelector.sync();

  const seeder=createDefaultTimelineSeeder({
    search,
    getLayerCount:()=>getLayers().length,
    getTimelines,
    captureSnapshot:captureSnapshotForTrack,
    render:renderModernTimeline,
    captureDefault:()=>readiness.captureDefault(),
  });
  readiness.onEditorReady(seeder.seedIfEligible);

  let stopPlayback=()=>{};
  const applyTrackSnapshot=snapshot=>{
    const activeIndex=workspace.activeTrackIndex;
    applyTrackSnapshotToEditor({
      snapshot,
      sceneTrack:isSceneTrack(),
      stopPlayback,
      classicState,
      setGlowOpacity:value=>{
        sceneSettings.glowOpacity=value;
        cloud.setUserTint(null,value);
        const input=documentLike.getElementById('glow-opacity');
        if(input) input.value=value;
        setGlowOpacity?.(value);
      },
      setGlowColor:value=>{
        sceneSettings.glowColor=value;
        cloud.setUserTint(value,null);
        const input=documentLike.getElementById('glow-color');
        if(input) input.value=value;
        setGlowColor?.(value);
      },
      setBackgroundColor,
      setSecondaryBackgroundColor,
      setGradientAmount,
      syncClassic,
      syncBackground,
      layer:getLayers()[activeIndex],
      layerIndex:activeIndex,
      selectLayer,
      syncLayer,
      onApplied:()=>setEditingPhase(true),
    });
  };

  const phaseList=createLegacyPhaseList({
    documentLike,
    container:phasesElement,
    getTimeline:getActiveTimeline,
    onEdit:phase=>applyTrackSnapshot(phase.snapshot),
    onCapture:phase=>{ phase.snapshot=captureTrackSnapshot(); },
    onClear:phase=>{ phase.snapshot=null; },
    onDuration:(phase,duration)=>{ phase.duration=duration; },
    onAdd:timeline=>{
      const last=timeline[timeline.length-1];
      const snapshot=cloneSnapshot(last&&last.snapshot)||captureTrackSnapshot();
      timeline.push({duration:5.0,snapshot});
    },
  });
  rebuildPhaseRows=()=>phaseList.render();
  syncTrack();
  rebuildPhaseRows();

  let legacyTransport=null;
  stopPlayback=()=>{
    playbackState.playing=false;
    legacyTransport.setPlaying(false);
    // Natural playback completion and either transport's pause command all
    // converge here, keeping both play icons synchronized.
    getModernTransport()?.setPlaying(false);
  };
  legacyTransport=createLegacyAnimationTransport({
    playButton,
    loopCheckbox,
    onLoopChange:looping=>{ playbackState.loop=looping; },
    onPlayToggle:()=>{
      if(!playbackState.playing){
        const start=prepareTimelinePlayback({
          layers:getLayers(),
          sceneTimeline,
          sceneEnabled:getSceneEnabled(),
          time:playbackState.time,
        });
        if(!start.playable) return;
        if(start.previousGlobalTime!==null) playbackState.previousGlobalTime=start.previousGlobalTime;
        playbackState.playing=true;
        legacyTransport.setPlaying(true);
        setEditingPhase(false);
      }else stopPlayback();
    },
  });

  documentLike.getElementById('anim-reset-btn').addEventListener('click',()=>{
    playbackState.time=0;
    stopPlayback();
    setEditingPhase(false);
    progressElement.style.width='0%';
    phasesElement.querySelectorAll('.anim-phase-row').forEach(row=>row.classList.remove('editing'));
    restoreIdleLayerState(getLayers());
    playbackState.previousGlobalTime=0;
    syncLayer();
  });
  documentLike.getElementById('anim-zero-btn').addEventListener('click',()=>{
    zeroParticleLayers({innerLayers:getInnerLayers(),fireflyLayers:getLayers()});
    const coreCountInput=[...documentLike.querySelectorAll('#params-controls .row')]
      .find(row=>row.querySelector('span')?.textContent==='count')?.querySelector('input');
    if(coreCountInput){
      coreCountInput.value=0;
      coreCountInput.dispatchEvent(new documentLike.defaultView.Event('input'));
    }
    syncInnerLayers();
    syncLayer();
  });
  documentLike.getElementById('anim-defaults-btn').addEventListener('click',()=>{
    const layers=getLayers();
    restoreDefaultLayerConfiguration({
      innerLayers:getInnerLayers(),
      fireflyLayers:layers,
      innerDefaults,
      innerPresets,
      fireflyDefaults,
      fireflyPresets,
      fireflyOverrides,
      createFireflyLayer,
      disposeFireflyLayer,
    });
    setActiveLayerIndex(Math.min(getActiveLayerIndex(),layers.length-1));
    syncInnerLayers();
    syncLayer();
  });
  documentLike.getElementById('anim-bloom-btn').addEventListener('click',()=>{
    stopPlayback();
    respawnFireflyLayers(getLayers());
  });

  wireLegacyDisclosure({
    trigger:documentLike.getElementById('anim-heading'),
    body:documentLike.getElementById('anim-body'),
    chevron:documentLike.getElementById('anim-chevron'),
  });

  return {
    workspace,
    isSceneTrack,
    getActiveTimeline,
    getTimelines,
    captureSnapshotForTrack,
    captureTrackSnapshot,
    applyTrackSnapshot,
    legacyTransport,
    stopPlayback,
    progressElement,
    syncLayers:()=>trackSelector.syncLayers(),
    syncTimeline:()=>{ syncTrack(); rebuildPhaseRows(); },
    addPhaseToActiveTrack:()=>{
      getActiveTimeline().push({duration:5.0,snapshot:captureTrackSnapshot()});
      rebuildPhaseRows();
    },
  };
}
