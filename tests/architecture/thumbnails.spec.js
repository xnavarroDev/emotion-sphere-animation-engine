const { test, expect } = require('@playwright/test');
const { importAppModule } = require('../helpers/modules');

// Thumbnail planning, caching, capture transactions, and render surfaces.

test('thumbnail cache evicts the least-recently-used entry', async () => {
  const { createLruCache } = await importAppModule('thumbnails', 'lru-cache.js');
  const cache = createLruCache(2);
  cache.set('first', 'a');
  cache.set('second', 'b');
  expect(cache.get('first')).toBe('a');
  cache.set('third', 'c');

  expect(cache.get('second')).toBeUndefined();
  expect(cache.get('first')).toBe('a');
  expect(cache.get('third')).toBe('c');
  expect(cache.size).toBe(2);
});

test('thumbnail cache rejects invalid capacity', async () => {
  const { createLruCache } = await importAppModule('thumbnails', 'lru-cache.js');
  expect(() => createLruCache(0)).toThrow('maxEntries must be a positive integer');
});

test('thumbnail capture queue schedules GPU work, caches frames, and isolates failures', async () => {
  const { createThumbnailCaptureQueue } = await importAppModule('thumbnails', 'capture-queue.js');
  const scheduled = [];
  const captures = [];
  const queue = createThumbnailCaptureQueue({
    maxEntries: 3,
    captureFrame: (seconds, trackIndex) => {
      captures.push([seconds, trackIndex]);
      return `frame-${trackIndex}-${seconds}`;
    },
    scheduleFrame: callback => scheduled.push(callback),
  });
  const first = { style: {} };
  const cachedCopy = { style: {} };
  const second = { style: {} };

  queue.request(0, 1, first); // first frame is immediate feedback
  queue.request(0, 1, cachedCopy);
  queue.request(1, 2, second); // distinct capture waits for the next frame
  expect(captures).toEqual([[1, 0]]);
  expect(first.style.backgroundImage).toBe('url(frame-0-1)');
  expect(cachedCopy.style.backgroundImage).toBe('url(frame-0-1)');
  expect(queue.pendingCount).toBe(1);
  scheduled.shift()();
  expect(captures).toEqual([[1, 0], [2, 1]]);
  expect(second.style.backgroundImage).toBe('url(frame-1-2)');
  scheduled.shift()(); // observe the empty queue and leave the runner idle

  queue.invalidateTrack(0);
  queue.request(0, 1, { style: {} });
  expect(captures).toEqual([[1, 0], [2, 1], [1, 0]]);
  queue.request(2, 3, { style: {} });
  expect(queue.pendingCount).toBe(1);
  queue.resetTrackCount(4);
  expect(queue.pendingCount).toBe(0);
  queue.clear();
  expect(queue.pendingCount).toBe(0);

  let reportedError;
  const brokenQueue = createThumbnailCaptureQueue({
    maxEntries: 1,
    captureFrame: () => { throw new Error('GPU read failed'); },
    scheduleFrame: () => {},
    onError: error => { reportedError = error; },
  });
  expect(() => brokenQueue.request(null, 0, { style: {} })).not.toThrow();
  expect(brokenQueue.disabled).toBe(true);
  expect(reportedError.message).toBe('GPU read failed');
});

test('thumbnail capture transaction restores live state after success and failure', async () => {
  const { runRestorableCapture } = await importAppModule('thumbnails', 'capture-session.js');
  const state = { mode: 'live', viewport: 'full' };
  const snapshots = [];
  const restore = saved => Object.assign(state, saved);
  const snapshot = () => {
    const saved = { ...state };
    snapshots.push(saved);
    return saved;
  };

  const result = runRestorableCapture({
    snapshot,
    capture: saved => {
      expect(saved).toEqual({ mode: 'live', viewport: 'full' });
      Object.assign(state, { mode: 'thumbnail', viewport: 'small' });
      return 'frame-data';
    },
    restore,
  });
  expect(result).toBe('frame-data');
  expect(state).toEqual({ mode: 'live', viewport: 'full' });

  expect(() => runRestorableCapture({
    snapshot,
    capture: () => {
      Object.assign(state, { mode: 'thumbnail', viewport: 'small' });
      throw new Error('readback failed');
    },
    restore,
  })).toThrow('readback failed');
  expect(state).toEqual({ mode: 'live', viewport: 'full' });
  expect(snapshots).toHaveLength(2);
});

test('thumbnail strip planning keeps frames equal within each phase', async () => {
  const {
    planPhaseThumbnailFrames,
    planTimelineThumbnailFrames,
  } = await importAppModule('thumbnails', 'strip-layout.js');
  const options = {
    laneWidth: 400,
    timeScaleSeconds: 20,
    stripHeight: 50,
    aspect: 2,
  };

  expect(planPhaseThumbnailFrames({
    ...options,
    phaseDuration: 10,
    phaseStartSeconds: 0,
  })).toEqual([
    {
      sampleSeconds: 0, frameDuration: 5,
      localLeftPercent: 0, localWidthPercent: 50,
      axisLeftPercent: 0, axisWidthPercent: 25,
    },
    {
      sampleSeconds: 5, frameDuration: 5,
      localLeftPercent: 50, localWidthPercent: 50,
      axisLeftPercent: 25, axisWidthPercent: 25,
    },
  ]);

  const timelineFrames = planTimelineThumbnailFrames([{ duration: 10 }, { duration: 5 }], options);
  expect(timelineFrames.map(frame => [frame.phaseIndex, frame.sampleSeconds, frame.frameDuration]))
    .toEqual([[0, 0, 5], [0, 5, 5], [1, 10, 5]]);
});

test('thumbnail preview reuses a body-level overlay and preserves frame aspect', async () => {
  const { createThumbnailPreview } = await importAppModule('ui/timeline', 'thumbnail-preview.js');
  class FakeElement {
    constructor() {
      this.style = {};
      this.children = [];
    }
    append(...children) {
      this.children.push(...children);
      this.firstChild = this.children[0];
      this.lastChild = this.children.at(-1);
    }
    appendChild(child) { this.append(child); }
    getBoundingClientRect() { return { left: 100, top: 40, width: 60 }; }
  }
  const body = new FakeElement();
  const presenter = createThumbnailPreview({
    documentLike: { body, createElement: () => new FakeElement() },
    windowLike: { getComputedStyle: () => ({ width: '240px' }) },
    getAspect: () => 2,
    formatTime: seconds => `${seconds}s`,
  });
  const slot = new FakeElement();
  slot.style.backgroundImage = 'url(frame)';

  presenter.show(slot, 3);
  const overlay = body.firstChild;
  expect(overlay.firstChild.style.backgroundImage).toBe('url(frame)');
  expect(overlay.firstChild.style.height).toBe('120px');
  expect(overlay.lastChild.textContent).toBe('3s');
  expect(overlay.style.left).toBe('130px');
  expect(overlay.style.top).toBe('40px');
  presenter.hide();
  expect(overlay.style.display).toBe('none');
  presenter.show(slot, 4);
  expect(body.children).toHaveLength(1);
});

test('thumbnail render surface reuses matching resources and disposes resized targets', async () => {
  const {
    createThumbnailRenderSurface,
    planThumbnailCaptureSurface,
  } = await importAppModule('thumbnails', 'render-surface.js');
  expect(planThumbnailCaptureSurface({
    liveWidth: 1000,
    liveHeight: 500,
    outputWidth: 400,
    outputAspect: 2,
    subjectFraction: 0.8,
    supersampling: 2,
  })).toEqual({
    cropHeight: 400,
    cropWidth: 800,
    cropX: 100,
    cropY: 50,
    outputHeight: 200,
    pointScale: 1,
    sourceHeight: 500,
    sourceWidth: 1000,
  });
  const targets = [];
  class FakeTarget {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.disposed = false;
      targets.push(this);
    }
    dispose() { this.disposed = true; }
  }
  const canvases = [];
  const documentLike = {
    createElement: () => {
      const context = {
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      };
      const canvas = { getContext: () => context };
      canvases.push(canvas);
      return canvas;
    },
  };
  const surface = createThumbnailRenderSurface({
    THREE: { WebGLRenderTarget: FakeTarget },
    documentLike,
    outputWidth: 400,
  });

  const first = surface.ensure(800, 500, 200);
  expect(first.pixelBuffer).toHaveLength(800 * 500 * 4);
  expect(first.outputCanvas).toMatchObject({ width: 400, height: 200 });
  expect(first.outputContext).toMatchObject({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
  expect(surface.ensure(800, 500, 200)).toBe(first);
  expect(targets).toHaveLength(1);
  expect(canvases).toHaveLength(2);

  const resized = surface.ensure(640, 360, 180);
  expect(resized).not.toBe(first);
  expect(first.target.disposed).toBe(true);
  surface.dispose();
  expect(resized.target.disposed).toBe(true);
});
