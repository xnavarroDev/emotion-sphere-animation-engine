/**
 * Binds the timeline's contenteditable fields.
 *
 * Contenteditable controls have browser-specific details that are easy to get
 * subtly wrong: Enter inserts markup, Escape still triggers blur, and clicking
 * text collapses a programmatic selection after the click handler returns.
 * This module keeps those mechanics together. It reports normalized values to
 * callbacks but intentionally leaves timeline mutation, undo, and rendering to
 * the application entry point.
 */

export function normalizeTimelineName(value) {
  return String(value ?? '').trim() || null;
}

export function parseTimelineDuration(value, minimumDuration = 0.5) {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(minimumDuration, parsed)
    : null;
}

export function bindPhaseNameEditor({ element, currentName, displayedName, onCommit }) {
  element.addEventListener('keydown', event => {
    // Prevent panel-level single-key shortcuts while somebody is typing.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      element.blur();
    }
    if (event.key === 'Escape') {
      element.textContent = displayedName;
      element.blur();
    }
  });
  element.addEventListener('blur', () => {
    const nextName = normalizeTimelineName(element.textContent);
    if (normalizeTimelineName(currentName) !== nextName) onCommit(nextName);
    else element.textContent = displayedName;
  });
}

export function bindDurationEditor({
  element,
  documentLike,
  windowLike,
  duration,
  minimumDuration = 0.5,
  onCommit,
  defer = callback => setTimeout(callback, 0),
}) {
  element.addEventListener('click', event => {
    event.stopPropagation();
    // Select after mouseup has completed. Selecting synchronously in `click`
    // can leave only a caret, causing a typed "9" to turn "15.0s" into "915".
    defer(() => {
      const range = documentLike.createRange();
      range.selectNodeContents(element);
      const selection = windowLike.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  });
  element.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      element.blur();
    }
    if (event.key === 'Escape') {
      element.textContent = duration.toFixed(1) + 's';
      element.blur();
    }
  });
  element.addEventListener('blur', () => {
    const nextDuration = parseTimelineDuration(element.textContent, minimumDuration);
    if (nextDuration !== null && Math.abs(nextDuration - duration) > 1e-3) onCommit(nextDuration);
    else element.textContent = duration.toFixed(1) + 's';
  });
}

export function bindTrackNameEditor({ element, fallbackName, currentName, onFocus, onCommit }) {
  element.classList.add('editable');
  element.dataset.fallback = fallbackName;
  element.contentEditable = 'true';
  element.spellcheck = false;
  element.title = 'Click to focus this track - type to rename it';

  // Focus must not trigger a full render: replacing this element would destroy
  // the caret before the user can type. The caller can update selection styles
  // in place and defer structural rendering until blur commits the edit.
  element.addEventListener('focus', onFocus);
  element.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      element.blur();
    }
    if (event.key === 'Escape') {
      element.textContent = currentName || fallbackName;
      element.blur();
    }
  });
  element.addEventListener('blur', () => {
    const nextName = normalizeTimelineName(element.textContent);
    if (normalizeTimelineName(currentName) !== nextName) onCommit(nextName);
    else element.textContent = currentName || fallbackName;
  });
}
