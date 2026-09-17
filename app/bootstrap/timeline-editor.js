import { createPresetShareUrl } from '../presets/share-url.js';
import { EASING_LABELS, EASING_MENU } from '../animation/timeline.js';
import { formatTimelineTime } from '../animation/timeline-layout.js';
import { prepareTimelinePlayback, restoreIdleLayerState } from '../animation/playback-session.js';
import { seekTimelineFromClientX } from '../animation/timeline-seek.js';
import { clearTimeline, insertPhaseSpan } from '../animation/timeline-edit.js';
import { createEasingMenu } from '../ui/timeline/easing-menu.js';
import { createTimelineResizeController } from '../ui/timeline/timeline-resize.js';
import { createTimelinePanel } from '../ui/timeline/timeline-panel.js';
import { createTimelineLanePresenter, relayoutTimelineLane } from '../ui/timeline/timeline-lanes.js';
import { createTimelineRenderActions } from '../ui/timeline/timeline-render-actions.js';
import { createTimelineRenderer } from '../ui/timeline/timeline-renderer.js';
import { createTimelineTransport } from '../ui/timeline/timeline-transport.js';
import { createPhasePlacementController } from '../ui/timeline/phase-placement.js';
import { createThumbnailStripBuilder } from '../ui/timeline/thumbnail-strip.js';
import { createThumbnailPreview } from '../ui/timeline/thumbnail-preview.js';
import { createTimelineGestureController } from '../ui/timeline/timeline-gestures.js';
import { createTimelineSelectionPresenter } from '../ui/timeline/timeline-selection.js';

const MINIMUM_AXIS_SECONDS=20;
const PIXELS_PER_SECOND=34;
const LANE_GUTTER=180;
const MINIMUM_PHASE_SECONDS=0.5;

/**
 * Composes the redesigned timeline's small UI controllers into one feature.
 *
 * Application state remains owned by app.js and is supplied through explicit
 * callbacks. This module owns browser event wiring and returns only the few
 * controls other application features need after startup.
 */
export function initializeTimelineEditor({
  documentLike,
  windowLike,
  navigatorLike,
  locationLike,
  elements,
  playbackState,
  sceneTimeline,
  getLayers,
  getSceneEnabled,
  setSceneEnabled,
  getActiveTrackIndex,
  setActiveTrack,
  getActiveTimeline,
  isSceneTrack,
  getTimelines,
  getSequence,
  getDuration,
  getMaximumDuration,
  captureTrackSnapshot,
  captureSnapshotForTrack,
  applyTrackSnapshot,
  cloneSnapshot,
  livePhaseEditor,
  getEditingPhase,
  updateInnerLayers,
  getElapsedTime,
  syncParameters,
  syncLegacyLayers,
  syncLayers,
  stopAnimation,
  markDirty,
  invalidateThumbnailTrack,
  requestThumbnail,
  getThumbnailAspect,
  getThumbnailCaptures,
  layoutViewport,
  serializePreset,
  legacyTransport,
  setExpanded,
  setPressed,
}){
  const {
    container,
    tracks,
    time,
    play,
    reset,
    loop,
    playIcon,
    addPhase,
    clearPhases,
    shareLink,
    resizeGrip,
    sceneControls,
  }=elements;

  const thumbnailPreview=createThumbnailPreview({
    documentLike,
    windowLike,
    getAspect:getThumbnailAspect,
    formatTime:formatTimelineTime,
  });
  const thumbnailStrip=createThumbnailStripBuilder({
    documentLike,
    getAspect:getThumbnailAspect,
    requestThumbnail,
    showPreview:thumbnailPreview.show,
    hidePreview:thumbnailPreview.hide,
  });

  let renderer=null;
  const render=()=>renderer?.render();
  const panel=createTimelinePanel({
    documentLike,
    onLayout:layoutViewport,
    onOpen:render,
  });

  let lanes=null;
  const updatePlayhead=()=>lanes.updatePlayhead(playbackState.time);
  const seekToClientX=clientX=>{
    const lane=lanes.referenceLane;
    if(!lane) return;
    playbackState.beginScrub();
    const nextTime=seekTimelineFromClientX({
      clientX,
      laneRect:lane.getBoundingClientRect(),
      axisSeconds:lanes.axisSeconds,
      maximumDuration:lanes.maxTotal,
      layers:getLayers(),
      getSequence,
      getDuration,
      sample:next=>{
        playbackState.time=next;
        updateInnerLayers(getElapsedTime(),0);
      },
    });
    playbackState.endScrub();
    if(nextTime===null) return;
    playbackState.seekHold=nextTime;
    // Updating only the playhead preserves pointer capture during scrubbing.
    updatePlayhead();
  };

  const gestures=createTimelineGestureController({
    getAxisSeconds:()=>lanes.axisSeconds||1,
    seekToClientX,
  });
  const wireResize=(handle,phase,lane,edge)=>{
    gestures.wireSegmentResize({
      handle,
      lane,
      edge,
      onResize:deltaSeconds=>{
        phase.duration=Math.max(MINIMUM_PHASE_SECONDS,phase.duration+deltaSeconds);
        // Relayout in place so the pointer-capturing element is not replaced.
        relayoutTimelineLane(lane,lanes.axisSeconds);
      },
      onCommit:()=>{
        markDirty();
        render();
      },
    });
  };

  lanes=createTimelineLanePresenter({
    documentLike,
    tracksElement:tracks,
    timeElement:time,
    formatTime:formatTimelineTime,
    wirePlayheadScrub:gestures.wirePlayheadScrub,
  });
  const selection=createTimelineSelectionPresenter({
    documentLike,
    getOverlay:()=>lanes.overlay,
    getLaneScroll:()=>lanes.scrollLeft,
    setExpanded,
    sceneControls,
  });

  const actions=createTimelineRenderActions({
    getTimelines,
    getEditingPhase,
    clearEditingPhase:livePhaseEditor.clear,
    setEditingPhase:livePhaseEditor.setPhase,
    setActiveTrack,
    applyTrackSnapshot,
    captureTrackSnapshot,
    cloneSnapshot,
    captureSnapshotForTrack,
    markDirty,
    render,
    tracksElement:tracks,
    syncParameters,
    syncLegacyLayers,
    getSceneEnabled,
    setSceneEnabled,
  });

  let openEasingMenu=()=>{};
  renderer=createTimelineRenderer({
    documentLike,
    windowLike,
    tracksElement:tracks,
    isOpen:()=>container.classList.contains('open'),
    getLayers,
    sceneTimeline,
    getSceneEnabled,
    getActiveTrackIndex,
    getEditingPhase,
    getTimelines,
    getTrackCount:()=>getLayers().length+1,
    getMaximumDuration,
    easingLabels:EASING_LABELS,
    minimumAxisSeconds:MINIMUM_AXIS_SECONDS,
    pixelsPerSecond:PIXELS_PER_SECOND,
    gutterWidth:LANE_GUTTER,
    thumbnailPreview,
    getThumbnailCaptures,
    thumbnailStrip,
    lanes,
    selection,
    gestures,
    actions,
    wireResize,
    openEasingMenu:(anchor,phase)=>openEasingMenu(anchor,phase),
    updatePlayhead,
  });

  const transport=createTimelineTransport({
    playButton:play,
    resetButton:reset,
    loopButton:loop,
    playIcon,
    getPlaying:()=>playbackState.playing,
    beforePlayToggle:livePhaseEditor.clear,
    startPlayback:()=>{
      const start=prepareTimelinePlayback({
        layers:getLayers(),
        sceneTimeline,
        sceneEnabled:getSceneEnabled(),
        time:playbackState.time,
      });
      if(!start.playable) return false;
      if(start.previousGlobalTime!==null) playbackState.previousGlobalTime=start.previousGlobalTime;
      playbackState.seekHold=null;
      playbackState.playing=true;
      return true;
    },
    stopPlayback:stopAnimation,
    resetPlayback:()=>{
      playbackState.seekHold=null;
      playbackState.time=0;
      stopAnimation();
      livePhaseEditor.clear();
      restoreIdleLayerState(getLayers());
      playbackState.previousGlobalTime=0;
      syncLayers();
      render();
    },
    getLoop:()=>playbackState.loop,
    setLoop:value=>{ playbackState.loop=value; },
    onLoopChange:markDirty,
    legacyTransport,
    setPressed,
  });

  const easingMenu=createEasingMenu({
    documentLike,
    windowLike,
    groups:EASING_MENU,
    onSelect:(phase,key)=>{
      phase.ease=key;
      markDirty();
      render();
    },
  });
  easingMenu.connect();
  openEasingMenu=(anchor,phase)=>easingMenu.open(anchor,phase);

  const phasePlacement=createPhasePlacementController({
    addButton:addPhase,
    documentLike,
    tracksElement:tracks,
    getReferenceLane:()=>lanes.referenceLane,
    getOverlay:()=>lanes.overlay,
    getAxisSeconds:()=>lanes.axisSeconds,
    getLaneScroll:()=>lanes.scrollLeft,
    formatTime:formatTimelineTime,
    insertSpan:(startSeconds,endSeconds)=>insertPhaseSpan({
      timelines:getTimelines(),
      startSeconds,
      endSeconds,
      minimumDuration:MINIMUM_PHASE_SECONDS,
      focusedTrackIndex:getActiveTrackIndex(),
      cloneSnapshot,
      captureSnapshot:captureSnapshotForTrack,
    }),
    minimumDuration:MINIMUM_PHASE_SECONDS,
    ensureOpen:panel.ensureOpen,
    onPlaced:landed=>{
      if(landed) livePhaseEditor.setPhase(landed);
      markDirty();
      render();
    },
  });
  phasePlacement.connect();

  clearPhases.addEventListener('click',event=>{
    event.stopPropagation();
    if(phasePlacement.isActive) phasePlacement.cancel();
    const timeline=getActiveTimeline();
    if(!timeline.length) return;
    const activeIndex=getActiveTrackIndex();
    const layer=getLayers()[activeIndex];
    const label=isSceneTrack()?'Background':(layer.name||'Layer '+(activeIndex+1));
    if(!windowLike.confirm('Remove all phases from '+label+'? (Undo will bring them back.)')) return;
    if(getEditingPhase()&&timeline.includes(getEditingPhase())) livePhaseEditor.clear();
    clearTimeline(timeline);
    invalidateThumbnailTrack(activeIndex);
    markDirty();
    render();
  });

  shareLink.addEventListener('click',event=>{
    const url=createPresetShareUrl(serializePreset(),locationLike);
    const button=event.currentTarget;
    const flash=ok=>{
      button.style.background=ok?'#3f7d58':'#a8443b';
      button.title=ok?'Link copied to clipboard':'Copy failed';
      windowLike.setTimeout(()=>{
        button.style.background='';
        button.title='Copy a link that plays this exact look live';
      },1400);
    };
    const write=navigatorLike.clipboard?.writeText;
    if(!write){ flash(false); return; }
    write.call(navigatorLike.clipboard,url).then(()=>flash(true)).catch(()=>flash(false));
  });

  const resize=createTimelineResizeController({
    grip:resizeGrip,
    container,
    documentLike,
    windowLike,
    onLayout:layoutViewport,
    onGeometryChange:()=>{
      lanes.cacheGeometry();
      updatePlayhead();
    },
    onRender:render,
  });
  resize.connect();

  // The animation frame path deliberately moves one element; structural DOM
  // rebuilds are reserved for edits so hover and drag state remain stable.
  (function tick(){
    if(playbackState.playing&&container.classList.contains('open')) updatePlayhead();
    windowLike.requestAnimationFrame(tick);
  })();
  windowLike.addEventListener('resize',()=>{
    lanes.cacheGeometry();
    updatePlayhead();
  });

  return {
    phasePlacement,
    render,
    selection,
    syncLoop:transport.syncLoop,
    transport,
  };
}
