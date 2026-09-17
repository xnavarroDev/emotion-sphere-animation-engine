import { calculatePhaseSpans } from '../../animation/timeline-layout.js';

/**
 * Repositions an existing lane after a duration edit without rebuilding it.
 * Keeping the current nodes alive is essential while a resize handle owns
 * pointer capture; replacing the lane would cancel the gesture mid-drag.
 */
export function relayoutTimelineLane(lane, axisSeconds) {
  const timeline = lane?._timeline;
  const records = lane?._segs;
  if (!timeline || !records) return false;

  const spans = calculatePhaseSpans(timeline, axisSeconds || 1);
  records.forEach((record, index) => {
    const { widthPercent, leftPercent, midpointPercent } = spans[index];
    record.seg.style.left = `${leftPercent}%`;
    record.seg.style.width = `${widthPercent}%`;
    record.nameEl.style.left = `${midpointPercent}%`;
    record.durEl.style.left = `${midpointPercent}%`;
    record.durText.textContent = `${record.phase.duration.toFixed(1)}s`;
    if (record.bracket) {
      record.bracket.style.left = `${leftPercent}%`;
      record.bracket.style.width = `${widthPercent}%`;
    }
    if (record.seam) record.seam.style.left = `${leftPercent + widthPercent}%`;
  });
  return true;
}

/**
 * Presents the shared geometry that makes many track rows read as one timeline.
 *
 * Each lane has its own clipped viewport, but scrolling, the playhead, and
 * hover/placement overlays are global. This presenter owns that DOM state and
 * caches measurements so animation frames never trigger layout reads.
 */
export function createTimelineLanePresenter({
  documentLike,
  tracksElement,
  timeElement,
  formatTime,
  wirePlayheadScrub,
}) {
  let viewports = [];
  let overlay = null;
  let playhead = null;
  let referenceLane = null;
  let geometry = null;
  let scrollLeft = 0;
  let syncing = false;
  let maxTotal = 1;
  let axisSeconds = 1;
  let currentTime = 0;

  function updatePlayhead(time = currentTime) {
    currentTime = time;
    if (!playhead || !geometry) return;
    const displayedTime = currentTime % maxTotal;
    const fraction = Math.min(1, displayedTime / axisSeconds);
    playhead.style.left = `${fraction * geometry.width - scrollLeft}px`;
    timeElement.textContent = `${formatTime(displayedTime)}/${formatTime(maxTotal)}`;
  }

  function syncScroll(source) {
    if (syncing) return;
    syncing = true;
    scrollLeft = source.scrollLeft;
    for (const viewport of viewports) {
      if (viewport !== source) viewport.scrollLeft = scrollLeft;
    }
    if (overlay) overlay.style.left = `${geometry?.left || 0}px`;
    updatePlayhead();
    syncing = false;
  }

  function registerViewport(viewport, { listen = true } = {}) {
    viewports.push(viewport);
    if (listen) viewport.addEventListener('scroll', () => syncScroll(viewport), { passive: true });
  }

  function cacheGeometry() {
    if (!referenceLane) {
      geometry = null;
      return;
    }
    const viewport = referenceLane.parentElement;
    geometry = {
      left: viewport?.offsetLeft || 0,
      width: referenceLane.offsetWidth,
      view: viewport?.clientWidth || 0,
    };
    if (!overlay) return;
    overlay.style.left = `${geometry.left}px`;

    // Measure through the final track rather than scrollHeight: the overlay is
    // itself a child and would otherwise inflate the value used for its height.
    const tracks = tracksElement.querySelectorAll('.rp-track');
    const last = tracks[tracks.length - 1];
    overlay.style.height = `${last ? last.offsetTop + last.offsetHeight : tracksElement.clientHeight}px`;
  }

  function reset() {
    const preserved = { top: tracksElement.scrollTop, left: scrollLeft };
    viewports = [];
    overlay = null;
    playhead = null;
    referenceLane = null;
    geometry = null;
    return preserved;
  }

  function setAxis({ lane, duration, visibleSeconds }) {
    referenceLane = lane;
    maxTotal = duration || 1;
    axisSeconds = visibleSeconds || 1;
  }

  function createOverlay() {
    if (!referenceLane) return null;
    overlay = documentLike.createElement('div');
    overlay.className = 'rp-lane-overlay';
    tracksElement.appendChild(overlay);
    playhead = documentLike.createElement('div');
    playhead.className = 'rp-playhead';
    overlay.appendChild(playhead);
    wirePlayheadScrub(playhead);
    cacheGeometry();
    return overlay;
  }

  function restoreScroll({ top, left }) {
    tracksElement.scrollTop = top;
    scrollLeft = left;
    for (const viewport of viewports) viewport.scrollLeft = left;
    if (overlay) overlay.style.left = `${geometry?.left || 0}px`;
  }

  return {
    cacheGeometry,
    createOverlay,
    registerViewport,
    reset,
    restoreScroll,
    setAxis,
    syncScroll,
    updatePlayhead,
    get axisSeconds() { return axisSeconds; },
    get maxTotal() { return maxTotal; },
    get overlay() { return overlay; },
    get referenceLane() { return referenceLane; },
    get scrollLeft() { return scrollLeft; },
  };
}
