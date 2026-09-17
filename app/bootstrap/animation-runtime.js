import { createTimelineFrameRunner } from '../animation/frame-runner.js';
import { applyFireflySnapshotTransition } from '../animation/firefly-transition.js';
import { buildTimelinePlaybackPlan } from '../animation/playback-plan.js';
import { applySceneSnapshotTransition } from '../animation/scene-transition.js';
import { createSceneTransitionAdapters } from '../animation/scene-transition-adapters.js';
import { getTrackDuration, getTrackSequence, interpolateTrack } from '../animation/timeline.js';

/**
 * Creates the shared animation sampler used by live rendering and thumbnail
 * settling. Timeline planning, clock advancement, and snapshot interpolation
 * stay together so editor transports cannot develop different playback rules.
 */
export function initializeAnimationRuntime({
  documentLike,
  playbackState,
  sceneTimeline,
  classicState,
  sceneSettings,
  cloud,
  getLayers,
  getSceneEnabled,
  isReady,
  stopPlayback,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setGradientAmount,
  syncClassic,
  syncBackground,
  syncLayerControls,
  getProgressElement,
  isThumbnailCapture,
}){
  const sceneAdapters=createSceneTransitionAdapters({
    documentLike,
    classic:classicState,
    sceneSettings,
    cloud,
    setBackgroundColor,
    setSecondaryBackgroundColor,
    setGradientAmount,
    syncClassic,
    syncBackground,
  });

  const runner=createTimelineFrameRunner({
    isReady,
    getPlaying:()=>playbackState.playing,
    getScrubbing:()=>playbackState.scrubbing,
    getTime:()=>playbackState.time,
    getPreviousTime:()=>playbackState.previousGlobalTime,
    getLoop:()=>playbackState.loop,
    getLayers,
    sceneTimeline,
    getSceneEnabled,
    setClock:(time,previousTime)=>{
      playbackState.time=time;
      playbackState.previousGlobalTime=previousTime;
    },
    stopPlayback,
    onFrame:playback=>{
      // Thumbnail settling uses the same runner with temporary state. Keep
      // those values out of the live layer controls.
      if(!isThumbnailCapture()) syncLayerControls();
      const progress=getProgressElement();
      if(progress){
        progress.style.width=(Math.min(playback.sampleTime/playback.maxTotal,1)*100)+'%';
      }
    },
    applyLayer:({layer,sequence,time,zeroSnapshot})=>{
      interpolateTrack(
        sequence,
        time,
        (from,to,fraction)=>applyFireflySnapshotTransition(layer,from,to,fraction),
        zeroSnapshot,
      );
    },
    applyScene:({sequence,time})=>interpolateTrack(
      sequence,
      time,
      (from,to,fraction)=>applySceneSnapshotTransition(from,to,fraction,sceneAdapters),
    ),
  });

  return {
    getSequence:getTrackSequence,
    getDuration:getTrackDuration,
    getMaximumDuration:()=>buildTimelinePlaybackPlan({
      layers:getLayers(),
      sceneTimeline,
      sceneEnabled:getSceneEnabled(),
    }).maxTotal,
    runFrame:deltaTime=>runner.run(deltaTime),
  };
}
