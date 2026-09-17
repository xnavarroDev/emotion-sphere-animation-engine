import { mixHex } from '../scene/color.js';
import { createThumbnailCaptureQueue } from '../thumbnails/capture-queue.js';
import { runRestorableCapture } from '../thumbnails/capture-session.js';
import {
  createThumbnailRenderSurface,
  planThumbnailCaptureSurface,
} from '../thumbnails/render-surface.js';

const OUTPUT_WIDTH=400;
const CACHE_CAPACITY=400;
const MINIMUM_ASPECT=1.4;
const MAXIMUM_ASPECT=2.4;
const SUBJECT_FRACTION=0.72;
const SUPERSAMPLING=2;

/**
 * Owns renderer-backed timeline thumbnails as an exception-safe transaction.
 * Captures temporarily seek and isolate the live scene, then restore every
 * mutated renderer, animation, and editor value before returning.
 */
export function initializeThumbnailRuntime({
  THREE,
  documentLike,
  windowLike,
  sceneRuntime,
  cloud,
  playbackState,
  classicState,
  sceneSettings,
  getLayers,
  getClockTime,
  updateLayers,
  getSequence,
  getDuration,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setGradientAmount,
  syncClassic,
  syncBackground,
  onError=error=>console.warn('[thumbnails] capture failed, disabling for this session:',error),
}){
  const surface=createThumbnailRenderSurface({
    THREE,
    documentLike,
    outputWidth:OUTPUT_WIDTH,
  });
  let glowBoost=1;
  let capturing=false;
  let fakeClock=0;

  const getAspect=()=>Math.min(
    MAXIMUM_ASPECT,
    Math.max(MINIMUM_ASPECT,sceneRuntime.aspect||16/9),
  );

  // Firefly fields integrate toward their target over many updates. A short,
  // monotonic synthetic clock lets an arbitrary requested time converge while
  // keeping particle birth ages valid against the real renderer clock.
  const settle=(animationTime,ticks=15)=>{
    fakeClock=Math.max(fakeClock,getClockTime());
    playbackState.beginScrub(animationTime);
    for(let index=0;index<ticks;index+=1){
      fakeClock+=0.1;
      updateLayers(fakeClock,0.1);
    }
    playbackState.endScrub();
  };

  const captureFrame=(seconds,trackIndex)=>{
    const layers=getLayers();
    const wholeScene=trackIndex==null;
    const sceneTrack=!wholeScene&&trackIndex>=layers.length;
    const {width:liveWidth,height:liveHeight}=sceneRuntime.getViewportSize();
    const plan=planThumbnailCaptureSurface({
      liveWidth,
      liveHeight,
      outputWidth:OUTPUT_WIDTH,
      outputAspect:getAspect(),
      subjectFraction:SUBJECT_FRACTION,
      supersampling:SUPERSAMPLING,
    });
    const resources=surface.ensure(plan.sourceWidth,plan.sourceHeight,plan.outputHeight);

    return runRestorableCapture({
      snapshot:()=>({
        ...playbackState.capture(),
        cloudVisible:cloud.visible,
        classic:{...classicState},
        ...sceneSettings.snapshot(),
        layers:layers.map(layer=>({
          visible:layer.points.visible,
          quaternion:layer.points.quaternion.clone(),
          color:layer.color().clone(),
          motion:layer.snapshotMotion(),
          params:{...layer.params},
        })),
      }),
      capture:saved=>{
        capturing=true;
        glowBoost=sceneTrack?2.2:1;
        // Capture times are requested out of order. Disabling loop avoids
        // treating a backwards sample as a real cycle wrap and respawning it.
        playbackState.loop=false;
        if(seconds!=null){
          settle(seconds);
          layers.forEach(layer=>{
            const sequence=getSequence(layer.timeline);
            if(layer.setSpawnAge&&layer.anim!==false&&sequence.length>=2){
              layer.setSpawnAge(seconds,Math.min(layer.params.spawnSpan,getDuration(sequence)));
            }
          });
        }

        // Point size is measured in render-target pixels, so scale it by the
        // same factor as the frame. Apply this after settling because phase
        // interpolation writes its authored size during each synthetic tick.
        layers.forEach((layer,index)=>{
          layer.setParams({size:saved.layers[index].params.size*plan.pointScale});
        });
        cloud.setVisible(wholeScene?saved.cloudVisible:(sceneTrack&&saved.cloudVisible));
        layers.forEach((layer,index)=>{
          layer.points.visible=wholeScene?saved.layers[index].visible:(!sceneTrack&&index===trackIndex);
        });

        cloud.onResize(plan.sourceWidth,plan.sourceHeight);
        cloud.refreshOpacity(true,glowBoost);
        sceneRuntime.readPixels(
          resources.target,
          plan.sourceWidth,
          plan.sourceHeight,
          resources.pixelBuffer,
        );

        // WebGL readback is bottom-up; flip it into the reusable source canvas.
        const data=resources.imageData.data;
        for(let y=0;y<plan.sourceHeight;y+=1){
          const source=(plan.sourceHeight-1-y)*plan.sourceWidth*4;
          const destination=y*plan.sourceWidth*4;
          data.set(resources.pixelBuffer.subarray(source,source+plan.sourceWidth*4),destination);
        }
        resources.sourceContext.putImageData(resources.imageData,0,0);

        // The live canvas is transparent over a CSS gradient. Paint the same
        // backdrop before compositing additive particles into the thumbnail.
        const bottom=mixHex(
          sceneSettings.backgroundColor,
          sceneSettings.secondaryBackgroundColor,
          sceneSettings.gradientAmount,
        );
        const gradient=resources.outputContext.createLinearGradient(
          0,
          -plan.cropY/SUPERSAMPLING,
          0,
          (plan.sourceHeight-plan.cropY)/SUPERSAMPLING,
        );
        gradient.addColorStop(0,sceneSettings.backgroundColor);
        gradient.addColorStop(1,bottom);
        resources.outputContext.globalCompositeOperation='source-over';
        resources.outputContext.fillStyle=gradient;
        resources.outputContext.fillRect(0,0,OUTPUT_WIDTH,plan.outputHeight);
        resources.outputContext.globalCompositeOperation='lighter';
        resources.outputContext.drawImage(
          resources.sourceCanvas,
          plan.cropX,
          plan.cropY,
          plan.cropWidth,
          plan.cropHeight,
          0,
          0,
          OUTPUT_WIDTH,
          plan.outputHeight,
        );
        resources.outputContext.globalCompositeOperation='source-over';
        return resources.outputCanvas.toDataURL('image/jpeg',0.9);
      },
      restore:saved=>{
        try{
          cloud.onResize(liveWidth,liveHeight);
          cloud.setVisible(saved.cloudVisible);
          layers.forEach((layer,index)=>{
            layer.points.visible=saved.layers[index].visible;
            layer.setParams({size:saved.layers[index].params.size});
          });

          // Replay once through the normal color path, then restore the exact
          // transaction snapshot so manually tuned values cannot drift.
          playbackState.beginScrub(saved.time);
          updateLayers(getClockTime(),0);
          playbackState.endScrub();
          layers.forEach((layer,index)=>layer.setParams(saved.layers[index].params));
          Object.assign(classicState,saved.classic);
          syncClassic();

          sceneSettings.glowOpacity=saved.glowOpacity;
          sceneSettings.glowColor=saved.glowColor;
          cloud.setUserTint(saved.glowColor,saved.glowOpacity);
          const opacityInput=documentLike.getElementById('glow-opacity');
          if(opacityInput&&documentLike.activeElement!==opacityInput) opacityInput.value=saved.glowOpacity;
          const colorInput=documentLike.getElementById('glow-color');
          if(colorInput&&documentLike.activeElement!==colorInput) colorInput.value=saved.glowColor;
          setBackgroundColor(saved.backgroundColor);
          setSecondaryBackgroundColor(saved.secondaryBackgroundColor);
          setGradientAmount(saved.gradientAmount);
          syncBackground();
          layers.forEach((layer,index)=>{
            const snapshot=saved.layers[index];
            layer.points.quaternion.copy(snapshot.quaternion);
            layer.color().copy(snapshot.color);
            layer.restoreMotion(snapshot.motion);
          });
        }finally{
          playbackState.restoreCapture(saved);
          glowBoost=1;
          capturing=false;
          cloud.onResize(liveWidth,liveHeight);
        }
      },
    });
  };

  const queue=createThumbnailCaptureQueue({
    maxEntries:CACHE_CAPACITY,
    captureFrame,
    scheduleFrame:callback=>windowLike.requestAnimationFrame(callback),
    onError,
  });

  return {
    get isCapturing(){ return capturing; },
    get disabled(){ return queue.disabled; },
    get pendingCount(){ return queue.pendingCount; },
    getAspect,
    captureCurrentPreview:()=>captureFrame(null,null),
    clear:queue.clear,
    invalidateTrack:queue.invalidateTrack,
    request:queue.request,
    resetTrackCount:queue.resetTrackCount,
  };
}
