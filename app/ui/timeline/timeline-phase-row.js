import { bindDurationEditor, bindPhaseNameEditor } from './timeline-editors.js';

/**
 * Connects one phase's DOM controls to application-level commands.
 *
 * A phase is represented by several separate nodes (segment, label, bracket,
 * duration, easing icon, and optional seam). Keeping their listeners together
 * makes the row's interaction contract discoverable while callbacks preserve
 * app.js as the owner of shared-column mutation, undo, and rerendering.
 */
export function wireTimelinePhaseRow({
  documentLike,
  windowLike,
  phase,
  phaseIndex,
  lane,
  isScene,
  displayedName,
  elements,
  selection,
  wasLaneDrag,
  wireResize,
  onSelect,
  onDelete,
  onRename,
  onDuration,
  onEasing,
  onInsert,
  bindName = bindPhaseNameEditor,
  bindDuration = bindDurationEditor,
}) {
  const {
    segment,
    swatch,
    resizeLeft,
    resizeRight,
    deleteButton,
    name,
    bracketLeft,
    bracketRight,
    durationText,
    easingIcon,
    seam,
  } = elements;

  selection.wirePhaseSelection({
    segment,
    isScene,
    shouldIgnore: wasLaneDrag,
    onSelect,
  });
  wireResize(resizeLeft, phase, lane, 'left');
  wireResize(resizeRight, phase, lane, 'right');
  wireResize(bracketLeft, phase, lane, 'left');
  wireResize(bracketRight, phase, lane, 'right');

  deleteButton.addEventListener('click', event => {
    event.stopPropagation();
    onDelete();
  });
  bindName({
    element: name,
    currentName: phase.name,
    displayedName,
    onCommit: onRename,
  });
  bindDuration({
    element: durationText,
    documentLike,
    windowLike,
    duration: phase.duration,
    minimumDuration: 0.5,
    onCommit: onDuration,
  });
  easingIcon.addEventListener('click', event => {
    event.stopPropagation();
    onEasing(easingIcon);
  });
  if (seam) {
    seam.addEventListener('click', event => {
      event.stopPropagation();
      onInsert();
    });
  }

  selection.registerPhase({
    phase,
    segment,
    nameElement: name,
    swatch,
    isScene,
    phaseIndex,
    displayedName,
  });
}
