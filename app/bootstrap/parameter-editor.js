import { clearTimeline } from '../animation/timeline-edit.js';
import { createBackgroundControls } from '../ui/controls/background-controls.js';
import { createLayerControls } from '../ui/controls/layer-controls.js';
import { createParameterGroups } from '../ui/controls/parameter-groups.js';
import { createRotationControls } from '../ui/controls/rotation-controls.js';
import { wireAccordionGroup } from '../ui/shell/disclosures.js';
import { createLivePhaseEditor } from '../ui/timeline/live-phase-editor.js';
import { timelineSegmentTint } from '../ui/timeline/timeline-render-model.js';

const PARAMETER_GROUPS=[
  {name:'Look',keys:['count','radius','intensity','hot','size','blinkSpeed','blinkDepth','spawnSpan'],color:true},
  {name:'Motion',keys:['wander','orbit','spin','speed']},
  {name:'Breathing',keys:['breath','breathSpeed','pulse','pulseSpeed','ripple','rippleSpeed']},
  {name:'Shape',keys:['coreBias','rectFill']},
];

/**
 * Composes the redesigned parameter editor around one active particle layer.
 * State ownership stays with app.js; this feature owns control synchronization,
 * layer commands, live phase commits, and the background/rotation presentation.
 */
export function initializeParameterEditor({
  documentLike,
  confirmAction,
  sliderDefinitions,
  playbackState,
  sceneSettings,
  cloud,
  timelineContainer,
  timelineTracks,
  timelineWorkspace,
  layerCollection,
  getLayers,
  getActiveIndex,
  setActiveIndex,
  getActiveEmotion,
  getEditingPhase,
  stopEditingPhase,
  getTimelineSelection,
  getPhasePlacement,
  getTimelines,
  captureTrackSnapshot,
  captureSnapshotForTrack,
  cloneSnapshot,
  addLayer,
  syncLayers,
  syncAnimationLayers,
  renderTracks,
  stopAnimation,
  invalidateThumbnailTrack,
  colorToHex,
  setRotationEnabled,
  setRotationSpeed,
  setPrimaryColor,
  setSecondaryColor,
  setGradientAmount,
  markDirty,
}){
  const livePhaseEditor=createLivePhaseEditor({
    captureSnapshot:captureTrackSnapshot,
    getSelection:getTimelineSelection,
    segmentTint:timelineSegmentTint,
    invalidateTrack:invalidateThumbnailTrack,
    getActiveTrackIndex:()=>timelineWorkspace.activeTrackIndex,
    isTimelineOpen:()=>timelineContainer.classList.contains('open'),
    render:renderTracks,
    onStop:stopEditingPhase,
  });
  const commitLivePhase=livePhaseEditor.commit;

  let copiedLayerLook=null;
  const layerControls=createLayerControls({
    documentLike,
    getViewModel:()=>({
      activeIndex:getActiveIndex(),
      layerCount:getLayers().length,
      name:getLayers()[getActiveIndex()]?.name,
    }),
    onPrevious:()=>{
      const layers=getLayers();
      setActiveIndex((getActiveIndex()-1+layers.length)%layers.length);
      syncLayers();
    },
    onNext:()=>{
      const layers=getLayers();
      setActiveIndex((getActiveIndex()+1)%layers.length);
      syncLayers();
    },
    onRename:nextName=>{
      const layers=getLayers();
      const activeIndex=getActiveIndex();
      layers[activeIndex].name=nextName;
      syncAnimationLayers();
      // Avoid a full render while typing because replacing the input would
      // lose its caret and restart thumbnail capture on every keystroke.
      const label=timelineTracks?.querySelectorAll('.rp-track-label')[activeIndex];
      const shown=layers[activeIndex].name||('Layer '+(activeIndex+1));
      if(label&&documentLike.activeElement!==label&&label.textContent!==shown) label.textContent=shown;
      markDirty();
    },
    onAdd:()=>{
      const layer=addLayer();
      if(!layer) return;
      const layers=getLayers();
      const reference=getTimelines().find(timeline=>timeline.length);
      if(reference&&!layer.timeline.length){
        const own=captureSnapshotForTrack(layers.length-1);
        reference.forEach(phase=>layer.timeline.push({
          duration:phase.duration,
          name:phase.name||null,
          ease:phase.ease,
          snapshot:cloneSnapshot(own),
        }));
      }
      setActiveIndex(layers.length-1);
      syncLayers();
      renderTracks();
      markDirty();
    },
    onRemove:()=>{
      const nextIndex=layerCollection.remove(getActiveIndex());
      if(nextIndex===null) return;
      setActiveIndex(nextIndex);
      syncLayers();
      renderTracks();
      markDirty();
    },
    onClear:()=>{
      const layer=getLayers()[getActiveIndex()];
      const patch={};
      for(const [key,min] of sliderDefinitions) patch[key]=min;
      layer.setParams(patch);
      layer.idle={...layer.params};
      commitLivePhase();
      syncLayers();
      markDirty();
    },
    onClearAll:()=>{
      const layers=getLayers();
      const timelines=getTimelines();
      const phaseTotal=timelines.reduce((total,timeline)=>total+timeline.length,0);
      const message=phaseTotal
        ? [
            'This clears all ',layers.length,
            ' layers and removes every phase from every track — continue? ',
            '(Undo will bring it back.)',
          ].join('')
        : 'This clears all '+layers.length+' layers — continue?';
      if(!confirmAction(message)) return;
      const placement=getPhasePlacement();
      if(placement?.isActive) placement.cancel();
      const patch={};
      for(const [key,min] of sliderDefinitions) patch[key]=min;
      for(const layer of layers){ layer.setParams(patch); layer.idle={...layer.params}; }
      if(phaseTotal){
        timelines.forEach(clearTimeline);
        livePhaseEditor.clear();
        playbackState.resetClock();
        stopAnimation();
      }
      syncLayers();
      renderTracks();
      markDirty();
    },
    onCopy:()=>{
      const layer=getLayers()[getActiveIndex()];
      copiedLayerLook={
        params:{...layer.params},
        colorOverride:layer.overrides[getActiveEmotion()]||null,
      };
      return true;
    },
    onPaste:()=>{
      if(!copiedLayerLook) return;
      const layer=getLayers()[getActiveIndex()];
      layer.setParams(copiedLayerLook.params);
      layer.idle={...layer.params};
      if(copiedLayerLook.colorOverride){
        layer.overrides[getActiveEmotion()]=copiedLayerLook.colorOverride;
        layer.setColor(copiedLayerLook.colorOverride);
      }
      commitLivePhase();
      syncLayers();
      renderTracks();
      markDirty();
    },
  });

  const rotationControls=createRotationControls({
    documentLike,
    getState:()=>({
      enabled:sceneSettings.rotationEnabled,
      speed:sceneSettings.rotationSpeed,
    }),
    setEnabled:setRotationEnabled,
    setSpeed:setRotationSpeed,
    onChange:markDirty,
  });
  rotationControls.sync();

  const groupsElement=documentLike.getElementById('rp-groups');
  const parameterGroups=createParameterGroups({
    documentLike,
    container:groupsElement,
    groups:PARAMETER_GROUPS,
    sliderDefinitions,
    motionExtraRow:documentLike.getElementById('rp-sphere-row'),
    getState:()=>{
      const layer=getLayers()[getActiveIndex()];
      const override=layer.overrides[getActiveEmotion()];
      return {color:override||colorToHex(layer.color()),params:layer.params};
    },
    onColorChange:value=>{
      const layer=getLayers()[getActiveIndex()];
      layer.overrides[getActiveEmotion()]=value;
      layer.setColor(value);
      commitLivePhase();
      markDirty();
    },
    onParameterChange:(key,value)=>{
      const layer=getLayers()[getActiveIndex()];
      layer.setParams({[key]:value});
      if(!playbackState.playing&&!getEditingPhase()) layer.idle={...layer.params};
      commitLivePhase();
      markDirty();
    },
  });

  // Background is scene-wide, but visually belongs after the per-layer groups.
  const backgroundGroup=documentLike.getElementById('rp-bg-group');
  const backgroundHeader=documentLike.getElementById('rp-bg-group-head');
  const backgroundChevron=backgroundHeader.querySelector('.chev');
  wireAccordionGroup({trigger:backgroundHeader,group:backgroundGroup});
  groupsElement.appendChild(backgroundGroup);

  const syncParameters=()=>{
    if(!getLayers()[getActiveIndex()]) return;
    layerControls.sync();
    parameterGroups.sync();
  };

  const backgroundControls=createBackgroundControls({
    documentLike,
    getState:()=>({
      glowColor:sceneSettings.glowColor,
      glowOpacity:sceneSettings.glowOpacity,
      primaryColor:sceneSettings.backgroundColor,
      secondaryColor:sceneSettings.secondaryBackgroundColor,
      gradientAmount:sceneSettings.gradientAmount,
    }),
    setGlowColor:value=>{
      sceneSettings.glowColor=value;
      cloud.setUserTint(value,null);
    },
    setGlowOpacity:value=>{
      sceneSettings.glowOpacity=value;
      cloud.setUserTint(null,value);
    },
    setPrimaryColor,
    setSecondaryColor,
    setGradientAmount,
    onChange:()=>{
      commitLivePhase();
      markDirty();
    },
  });
  backgroundControls.sync();

  return {
    livePhaseEditor,
    syncBackground:backgroundControls.sync,
    syncParameters,
    sceneControls:{backgroundGroup,backgroundHeader,backgroundChevron},
  };
}
