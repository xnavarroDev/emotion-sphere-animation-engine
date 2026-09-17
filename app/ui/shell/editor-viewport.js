/**
 * Sizes and offsets the WebGL viewport around editor chrome.
 * The timeline uses a camera view offset so the sphere remains centered in the
 * visible region rather than the full browser window.
 */
export function createEditorViewport({ windowLike, documentLike, sceneRuntime, onSceneResize }) {
  if (!windowLike || !documentLike || !sceneRuntime) {
    throw new TypeError('windowLike, documentLike, and sceneRuntime are required');
  }

  function layout() {
    const panel = documentLike.getElementById('redesign-panel');
    const left = panel && !panel.classList.contains('collapsed') ? panel.offsetWidth : 0;
    const width = Math.max(1, windowLike.innerWidth - left);
    const height = Math.max(1, windowLike.innerHeight);
    const timeline = documentLike.getElementById('anim-canvas-controls');
    const occludedHeight = timeline?.classList.contains('open')
      ? timeline.getBoundingClientRect().height
      : 0;

    sceneRuntime.resize(width, height, left);
    sceneRuntime.setVerticalViewOffset(width, height, occludedHeight);
    onSceneResize?.(width, height);
  }

  function connect() {
    windowLike.addEventListener('resize', layout);
    layout();
  }

  function disconnect() {
    windowLike.removeEventListener('resize', layout);
  }

  return { layout, connect, disconnect };
}
