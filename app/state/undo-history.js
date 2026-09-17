const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/** Return true when Ctrl/Cmd+Z belongs to the focused text editor. */
export function isNativeTextUndoTarget(element) {
  if (!element) return false;
  return Boolean(
    (element.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((element.type || 'text').toLowerCase()))
    || element.tagName === 'TEXTAREA'
    || element.isContentEditable
  );
}

/**
 * Store full-document snapshots while coalescing rapid slider/typing changes.
 * Snapshot capture and restoration are adapters because those functions become
 * available only after separate application modules finish booting.
 */
export function createUndoHistory({
  capture,
  restore,
  ready = () => true,
  blurActiveElement = () => {},
  onAvailabilityChange = () => {},
  maxEntries = 100,
  burstDelay = 500,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = timer => clearTimeout(timer),
}) {
  const stack = [];
  let baseline = null;
  let burstActive = false;
  let burstTimer = null;
  let restoring = false;

  function notify() {
    onAvailabilityChange(stack.length > 0);
  }

  function initializeIfReady() {
    if (baseline === null && ready()) baseline = capture();
  }

  function markDirty() {
    if (restoring || !ready()) return;
    if (!burstActive) {
      burstActive = true;
      if (baseline !== null) {
        stack.push(baseline);
        if (stack.length > maxEntries) stack.shift();
        notify();
      }
    }
    cancel(burstTimer);
    burstTimer = schedule(() => {
      burstActive = false;
      baseline = capture();
    }, burstDelay);
  }

  function undo() {
    const restoreSnapshot = restore();
    if (!stack.length || typeof restoreSnapshot !== 'function') return false;
    cancel(burstTimer);
    burstActive = false;
    blurActiveElement();
    const snapshot = stack.pop();
    restoring = true;
    try {
      restoreSnapshot(snapshot);
    } finally {
      restoring = false;
    }
    baseline = snapshot;
    notify();
    return true;
  }

  function resetAfterDocumentLoad() {
    stack.length = 0;
    burstActive = false;
    cancel(burstTimer);
    baseline = ready() ? capture() : null;
    notify();
  }

  return {
    initializeIfReady,
    markDirty,
    resetAfterDocumentLoad,
    undo,
    get restoring() { return restoring; },
    get size() { return stack.length; },
  };
}
