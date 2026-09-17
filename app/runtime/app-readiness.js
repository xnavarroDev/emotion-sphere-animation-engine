/**
 * Coordinate the two independent application boot chains:
 *
 * 1. renderer/editor setup creates layers and timeline UI;
 * 2. sphere-core setup creates preset serialization/restoration adapters.
 *
 * Editor-only callbacks run first when layers become ready. Callbacks that
 * need the complete document run afterward, once both sides are available.
 * This explicit handshake replaces nullable cross-closure hooks whose result
 * previously depended on whichever dynamic import happened to finish last.
 */
export function createApplicationReadiness() {
  let editorReady = false;
  let documentAdapter = null;
  let defaultCapture = null;
  let resolveEditor;
  const editorCallbacks = [];
  const readyCallbacks = [];
  const whenEditorReady = new Promise(resolve => { resolveEditor = resolve; });

  function runPending(callbacks) {
    for (const callback of callbacks.splice(0)) callback();
  }

  function runCompleteCallbacks() {
    if (editorReady && documentAdapter) runPending(readyCallbacks);
  }

  function markEditorReady() {
    if (editorReady) return;
    editorReady = true;
    resolveEditor();
    // Default timeline seeding must precede baseline capture and undo setup.
    runPending(editorCallbacks);
    runCompleteCallbacks();
  }

  function registerDocumentAdapter(adapter) {
    if (typeof adapter?.serialize !== 'function' || typeof adapter?.restore !== 'function') {
      throw new TypeError('document adapter requires serialize and restore functions');
    }
    documentAdapter = adapter;
    runCompleteCallbacks();
  }

  function onEditorReady(callback) {
    if (editorReady) callback();
    else editorCallbacks.push(callback);
  }

  function onReady(callback) {
    if (editorReady && documentAdapter) callback();
    else readyCallbacks.push(callback);
  }

  function registerDefaultCapture(callback) {
    if (typeof callback !== 'function') throw new TypeError('default capture must be a function');
    defaultCapture = callback;
  }

  return {
    markEditorReady,
    onEditorReady,
    onReady,
    registerDefaultCapture,
    registerDocumentAdapter,
    // Called by default seeding and again after URL initialization. Gallery
    // capture is idempotent, so the first call made with complete state wins.
    captureDefault() { return defaultCapture ? defaultCapture() : false; },
    restore(text) { return documentAdapter?.restore(text); },
    serialize(fallback = '') { return documentAdapter ? documentAdapter.serialize() : fallback; },
    getRestore() { return documentAdapter?.restore || null; },
    whenEditorReady,
    get ready() { return Boolean(editorReady && documentAdapter); },
  };
}
