import {
  planPhaseThumbnailFrames,
  planTimelineThumbnailFrames,
} from '../../thumbnails/strip-layout.js';

// Builds timeline thumbnail DOM from pure frame plans. Actual WebGL capture is
// injected through requestThumbnail, keeping this module cheap to test and
// preventing UI code from owning renderer state.
export function createThumbnailStripBuilder({
  documentLike,
  getAspect,
  requestThumbnail,
  showPreview,
  hidePreview,
}) {
  function wirePreview(slot, sampleSeconds) {
    slot.addEventListener('mouseenter', () => showPreview(slot, sampleSeconds));
    slot.addEventListener('mouseleave', hidePreview);
  }

  function fillSegments({ segments, referenceLane, timeScaleSeconds }) {
    const laneWidth = referenceLane?.getBoundingClientRect().width || 0;
    if (!laneWidth || !segments.length) return;
    const stripHeight = segments[0].segment.getBoundingClientRect().height || 68;

    for (const record of segments) {
      const wrapper = documentLike.createElement('div');
      wrapper.className = 'rp-thumb-slots';
      const frames = planPhaseThumbnailFrames({
        phaseDuration: record.phase.duration,
        phaseStartSeconds: record.phaseStartSeconds,
        laneWidth,
        timeScaleSeconds,
        stripHeight,
        aspect: getAspect(),
      });

      for (const frame of frames) {
        const slot = documentLike.createElement('div');
        slot.className = 'rp-thumb-slot';
        slot.style.left = `${frame.localLeftPercent}%`;
        slot.style.width = `${frame.localWidthPercent}%`;
        wrapper.appendChild(slot);
        requestThumbnail(record.trackIndex, frame.sampleSeconds, slot);
        wirePreview(slot, frame.sampleSeconds);
      }
      record.segment.appendChild(wrapper);
    }
  }

  function buildSummary({
    tracksElement,
    referenceTimeline,
    referenceLane,
    axisSeconds,
    laneWidth,
    onScrub,
    onScroll,
  }) {
    if (!tracksElement || !referenceLane || !referenceTimeline?.length) return null;

    const row = documentLike.createElement('div');
    row.className = 'rp-track rp-summary-track';
    const gutter = documentLike.createElement('div');
    gutter.className = 'rp-track-gutter rp-summary-gutter';

    // Copy the measured gutter width from a real track. A hard-coded caption
    // width drifts from the editable lanes when labels or padding change.
    const measuredGutter = tracksElement.querySelector('.rp-track-gutter');
    if (measuredGutter) gutter.style.width = `${measuredGutter.offsetWidth}px`;
    const caption = documentLike.createElement('div');
    caption.className = 'rp-summary-cap';
    caption.textContent = 'All layers';
    gutter.appendChild(caption);

    const viewport = documentLike.createElement('div');
    viewport.className = 'rp-lane-vp';
    const lane = documentLike.createElement('div');
    lane.className = 'rp-track-lane rp-summary-lane';
    lane.style.width = `${laneWidth}px`;
    onScrub(lane);

    const measuredRow = tracksElement.querySelector('.rp-segments-row');
    const stripHeight = measuredRow?.getBoundingClientRect().height || 68;
    const frames = planTimelineThumbnailFrames(referenceTimeline, {
      laneWidth,
      timeScaleSeconds: axisSeconds,
      stripHeight,
      aspect: getAspect(),
    });
    for (const frame of frames) {
      const slot = documentLike.createElement('div');
      slot.className = 'rp-thumb-slot rp-summary-slot';
      slot.style.left = `${frame.axisLeftPercent}%`;
      slot.style.width = `${frame.axisWidthPercent}%`;
      lane.appendChild(slot);
      requestThumbnail(null, frame.sampleSeconds, slot);
      wirePreview(slot, frame.sampleSeconds);
    }

    viewport.appendChild(lane);
    viewport.addEventListener('scroll', () => onScroll(viewport), { passive: true });
    row.append(gutter, viewport);
    tracksElement.insertBefore(row, tracksElement.firstChild);
    return viewport;
  }

  return { fillSegments, buildSummary };
}
