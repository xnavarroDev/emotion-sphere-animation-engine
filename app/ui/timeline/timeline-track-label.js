import { bindTrackNameEditor } from './timeline-editors.js';

/**
 * Wires the two meanings of a timeline track label.
 * Scene labels only select an edit target; layer labels additionally support
 * inline renaming. Both report intent upward because active-track and layer
 * naming state belong to the application, not this DOM adapter.
 */
export function wireTimelineTrackLabel({
  label,
  isScene,
  focused,
  fallbackName,
  currentName,
  onFocus,
  onRename,
}) {
  if (focused) label.classList.add('focused');
  if (isScene) {
    label.style.cursor = 'pointer';
    label.title = 'Click to make this the track "add phase" targets';
    label.addEventListener('click', onFocus);
    return;
  }
  bindTrackNameEditor({
    element: label,
    fallbackName,
    currentName,
    onFocus,
    onCommit: onRename,
  });
}
