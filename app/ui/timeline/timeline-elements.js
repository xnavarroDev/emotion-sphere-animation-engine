import { setPressed } from '../accessibility.js';

// These factories create the timeline's stable DOM shape and narrowly scoped
// controls. Application state remains in app.js; callbacks describe user
// intent without teaching this module about layers, scenes, or animation math.
export function createTrackElements({ documentLike, labelText, laneWidth, isEmpty }) {
  const track = documentLike.createElement('div');
  track.className = 'rp-track';
  const label = documentLike.createElement('div');
  label.className = 'rp-track-label';
  label.textContent = labelText;

  const lane = documentLike.createElement('div');
  lane.className = 'rp-track-lane';
  lane.style.width = `${laneWidth}px`;
  const labelsRow = documentLike.createElement('div');
  labelsRow.className = 'rp-phase-labels';
  const durationsRow = documentLike.createElement('div');
  durationsRow.className = 'rp-phase-durs';
  const bracketsRow = documentLike.createElement('div');
  bracketsRow.className = 'rp-bracket-row';
  const segmentsRow = documentLike.createElement('div');
  segmentsRow.className = 'rp-segments-row';
  if (isEmpty) {
    segmentsRow.style.cssText = 'display:flex;align-items:center;padding-left:10px;color:var(--rp-ink-3,#7d8394);font-size:11px;';
    segmentsRow.textContent = 'no phases yet — click + to add one';
  }
  lane.append(labelsRow, durationsRow, bracketsRow, segmentsRow);

  // The gutter stays outside the horizontally scrolling viewport. Keeping the
  // label and toggle together prevents the lane from showing through gaps.
  const toggleWrapper = documentLike.createElement('div');
  toggleWrapper.className = 'rp-track-toggle';
  const gutter = documentLike.createElement('div');
  gutter.className = 'rp-track-gutter';
  gutter.append(label, toggleWrapper);
  const viewport = documentLike.createElement('div');
  viewport.className = 'rp-lane-vp';
  viewport.appendChild(lane);
  track.append(gutter, viewport);

  return {
    track,
    label,
    lane,
    labelsRow,
    durationsRow,
    bracketsRow,
    segmentsRow,
    toggleWrapper,
    viewport,
  };
}

export function createPhaseElements({
  documentLike,
  leftPercent,
  widthPercent,
  midpointPercent,
  tint,
  shownName,
  duration,
  easingTitle,
  editing,
  hasSeam,
}) {
  const segment = documentLike.createElement('div');
  segment.className = `rp-segment${editing ? ' editing' : ''}`;
  segment.style.left = `${leftPercent}%`;
  segment.style.width = `${widthPercent}%`;
  const swatch = documentLike.createElement('div');
  swatch.className = 'swatch';
  swatch.style.background = tint;
  const resizeLeft = documentLike.createElement('div');
  resizeLeft.className = 'resize-handle left';
  const resizeRight = documentLike.createElement('div');
  resizeRight.className = 'resize-handle right';
  const deleteButton = documentLike.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'rp-segment-del';
  deleteButton.textContent = '×';
  deleteButton.title = 'Delete this phase';
  segment.append(swatch, resizeLeft, resizeRight, deleteButton);

  const name = documentLike.createElement('div');
  name.className = `rp-phase-name${editing ? ' editing' : ''}`;
  name.textContent = shownName;
  name.style.left = `${midpointPercent}%`;
  name.contentEditable = 'true';
  name.spellcheck = false;
  name.title = 'Click to rename this phase';

  const bracket = documentLike.createElement('div');
  bracket.className = `rp-bracket${editing ? ' editing' : ''}`;
  bracket.style.left = `${leftPercent}%`;
  bracket.style.width = `${widthPercent}%`;
  const bracketLeft = documentLike.createElement('div');
  bracketLeft.className = 'rp-bracket-handle left';
  bracketLeft.title = 'Drag to change when this phase starts';
  const bracketRight = documentLike.createElement('div');
  bracketRight.className = 'rp-bracket-handle right';
  bracketRight.title = 'Drag to change how long this phase lasts';
  bracket.append(bracketLeft, bracketRight);

  const durationElement = documentLike.createElement('div');
  durationElement.className = 'rp-phase-dur';
  durationElement.style.left = `${midpointPercent}%`;
  const durationText = documentLike.createElement('span');
  durationText.className = 'rp-dur-edit';
  durationText.textContent = `${duration.toFixed(1)}s`;
  durationText.contentEditable = 'true';
  durationText.spellcheck = false;
  durationText.title = 'Click to type an exact duration';
  const easingIcon = documentLike.createElement('img');
  easingIcon.className = 'ease-ico';
  easingIcon.src = 'icons/spline.svg';
  easingIcon.title = easingTitle;
  durationElement.append(durationText, easingIcon);

  let seam = null;
  if (hasSeam) {
    seam = documentLike.createElement('button');
    seam.type = 'button';
    seam.className = 'rp-seam-add';
    seam.textContent = '+';
    seam.title = 'Insert a phase here (in every track)';
    seam.style.left = `${leftPercent + widthPercent}%`;
    seam.style.top = '13px';
  }

  return {
    segment,
    swatch,
    resizeLeft,
    resizeRight,
    deleteButton,
    name,
    bracket,
    bracketLeft,
    bracketRight,
    durationElement,
    durationText,
    easingIcon,
    seam,
  };
}

export function createTrackToggle({ documentLike, label, enabled, onToggle }) {
  const toggle = documentLike.createElement('button');
  toggle.type = 'button';
  toggle.className = `rp-switch${enabled ? ' on' : ''}`;
  toggle.setAttribute('aria-label', `${label} animation`);
  setPressed(toggle, enabled);
  toggle.title = enabled
    ? 'Animation drives this track - click to disable'
    : 'This track is static - click to animate it';
  toggle.addEventListener('click', event => {
    // Track rows also respond to clicks for focus/selection. Consuming this
    // click keeps a transport change from unexpectedly changing edit context.
    event.stopPropagation();
    onToggle();
  });
  return toggle;
}
