/**
 * Coordinates pointer gestures used by the timeline.
 *
 * This module owns browser mechanics such as pointer capture, drag thresholds,
 * and click suppression. It deliberately does not own phases, playback state,
 * or rendering: callers provide small callbacks for those application-level
 * decisions. Keeping that boundary makes the gesture rules testable without a
 * WebGL scene and prevents DOM input details from spreading through app.js.
 */
export function createTimelineGestureController({
  getAxisSeconds,
  seekToClientX,
  dragThreshold = 4,
  defer = callback => setTimeout(callback, 0),
}) {
  if (typeof getAxisSeconds !== 'function') throw new TypeError('getAxisSeconds must be a function');
  if (typeof seekToClientX !== 'function') throw new TypeError('seekToClientX must be a function');

  // A lane drag ends with a browser-generated click. Keep this flag true until
  // the next task so the phase click handler can distinguish that synthetic
  // click from an intentional phase selection.
  let laneDragMoved = false;

  function capture(element, pointerId) {
    try { element.setPointerCapture(pointerId); } catch (_) { /* The pointer may already have ended. */ }
  }

  function release(element, pointerId) {
    try { element.releasePointerCapture(pointerId); } catch (_) { /* Safe during cancellation or DOM teardown. */ }
  }

  function wireSegmentResize({ handle, lane, edge, onResize, onCommit }) {
    let dragging = false;
    handle.addEventListener('pointerdown', event => {
      dragging = true;
      capture(handle, event.pointerId);
      event.stopPropagation();
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging) return;
      const laneWidth = lane.getBoundingClientRect().width;
      if (!(laneWidth > 0)) return;
      const direction = edge === 'right' ? 1 : -1;
      onResize(direction * event.movementX * getAxisSeconds() / laneWidth);
    });
    const finish = event => {
      if (!dragging) return;
      dragging = false;
      release(handle, event.pointerId);
      onCommit();
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function wirePlayheadScrub(handle) {
    let dragging = false;
    handle.addEventListener('pointerdown', event => {
      dragging = true;
      capture(handle, event.pointerId);
      seekToClientX(event.clientX);
      event.stopPropagation();
    });
    handle.addEventListener('pointermove', event => {
      if (dragging) seekToClientX(event.clientX);
    });
    const finish = event => {
      if (!dragging) return;
      dragging = false;
      release(handle, event.pointerId);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function wireLaneScrub(lane) {
    let pointerDown = false;
    let startX = 0;
    lane.addEventListener('pointerdown', event => {
      // Embedded controls own their click/drag behavior. Starting a lane scrub
      // from one would make resize, delete, and text editing unreliable.
      if (event.target.closest('.resize-handle,.rp-segment-del,.rp-seam-add,.rp-phase-name,.rp-dur-edit,.ease-ico,.rp-playhead')) return;
      pointerDown = true;
      startX = event.clientX;
      laneDragMoved = false;
    });
    lane.addEventListener('pointermove', event => {
      if (!pointerDown) return;
      if (!laneDragMoved) {
        if (Math.abs(event.clientX - startX) < dragThreshold) return;
        laneDragMoved = true;
        capture(lane, event.pointerId);
      }
      seekToClientX(event.clientX);
    });
    const finish = event => {
      if (!pointerDown) return;
      pointerDown = false;
      release(lane, event.pointerId);
      if (laneDragMoved) defer(() => { laneDragMoved = false; });
    };
    lane.addEventListener('pointerup', finish);
    lane.addEventListener('pointercancel', finish);
  }

  return {
    wireLaneScrub,
    wirePlayheadScrub,
    wireSegmentResize,
    wasLaneDrag: () => laneDragMoved,
  };
}
