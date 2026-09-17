import { createLruCache } from './lru-cache.js';

/**
 * Coordinates thumbnail capture requests without knowing how frames render.
 *
 * Reading pixels from WebGL stalls the GPU, so the queue captures at most one
 * new frame per animation frame. Cache policy and failure isolation live here;
 * the renderer-specific capture callback stays in app.js, where scene state can
 * be saved and restored as one transaction.
 */
export function createThumbnailCaptureQueue({
  maxEntries,
  captureFrame,
  scheduleFrame,
  onError = () => {},
}) {
  if (typeof captureFrame !== 'function') throw new TypeError('captureFrame must be a function');
  if (typeof scheduleFrame !== 'function') throw new TypeError('scheduleFrame must be a function');

  const cache = createLruCache(maxEntries);
  const pending = [];
  let running = false;
  let broken = false;
  let trackCount = null;

  // Track and time both belong in the key: an isolated layer and the composed
  // scene produce different images at the same instant. Two decimal places is
  // also the precision used by the visual sampling plans.
  const makeKey = (trackIndex, seconds) => `${trackIndex}|${seconds.toFixed(2)}`;

  function paint(element, url) {
    // Detached slots may remain in the queue after a timeline rebuild. Setting
    // their style is harmless and avoids coupling this generic queue to DOM
    // connectivity APIs.
    element.style.backgroundImage = `url(${url})`;
  }

  function processNext() {
    if (!pending.length || broken) {
      running = false;
      return;
    }
    running = true;
    const job = pending.shift();
    let url = cache.get(job.key);
    if (url === undefined) {
      try {
        url = captureFrame(job.seconds, job.trackIndex);
        cache.set(job.key, url);
      } catch (error) {
        // Filmstrips are progressive decoration over usable color swatches.
        // One failed GPU read must not abort timeline rendering or repeatedly
        // retry on every rebuild for the rest of the session.
        broken = true;
        pending.length = 0;
        running = false;
        onError(error);
        return;
      }
    }
    paint(job.element, url);
    scheduleFrame(processNext);
  }

  function request(trackIndex, seconds, element) {
    if (broken) return;
    const key = makeKey(trackIndex, seconds);
    const cached = cache.get(key);
    if (cached !== undefined) {
      paint(element, cached);
      return;
    }
    pending.push({ key, seconds, trackIndex, element });
    // Preserve immediate feedback for the first slot. Further requests made by
    // the same render wait for subsequent animation frames.
    if (!running) processNext();
  }

  function invalidateTrack(trackIndex) {
    const prefix = `${trackIndex}|`;
    for (const key of [...cache.keys()]) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  }

  function clear() {
    cache.clear();
    // A preset replacement invalidates queued jobs as well as completed cache
    // entries; otherwise old-preset captures can run after the new state loads.
    pending.length = 0;
  }

  function resetTrackCount(nextTrackCount) {
    if (nextTrackCount === trackCount) return;
    trackCount = nextTrackCount;
    cache.clear();
    // Track indices identify cache content. A layer add/remove changes every
    // later index's meaning, so queued work is stale for the same reason as the
    // cache and should not consume GPU time after the rebuild.
    pending.length = 0;
  }

  return {
    get disabled() { return broken; },
    get pendingCount() { return pending.length; },
    clear,
    invalidateTrack,
    request,
    resetTrackCount,
  };
}
