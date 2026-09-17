import { setSliderValue } from '../accessibility.js';

// Owns the timeline panel's resize interaction, but deliberately knows
// nothing about tracks or rendering. The callbacks are the boundary: the app
// decides how a new panel height affects its viewport and timeline geometry.
export function createTimelineResizeController({
  grip,
  container,
  documentLike,
  windowLike,
  onLayout,
  onGeometryChange,
  onRender,
  minimumHeight = 120,
  viewportFraction = 0.85,
  keyboardStep = 20,
}) {
  if (!grip || !container || !documentLike || !windowLike) {
    throw new TypeError('grip, container, documentLike, and windowLike are required');
  }

  let dragging = false;
  let startY = 0;
  let startHeight = 0;

  const maximumHeight = () => Math.round(windowLike.innerHeight * viewportFraction);
  const clampHeight = height => Math.max(minimumHeight, Math.min(maximumHeight(), height));

  function syncAccessibleValue(height = container.getBoundingClientRect().height) {
    const rounded = Math.round(clampHeight(height || minimumHeight));
    grip.setAttribute('aria-valuemax', String(maximumHeight()));
    setSliderValue(grip, rounded, `${rounded} pixels high`);
  }

  function applyHeight(height) {
    const nextHeight = clampHeight(height);
    container.style.maxHeight = 'none';
    container.style.height = `${nextHeight}px`;
    syncAccessibleValue(nextHeight);

    // Layout runs during a drag so the sphere remains centered in the space
    // that is still visible, rather than jumping only when the pointer lifts.
    onLayout?.();
    onGeometryChange?.();
  }

  function handlePointerDown(event) {
    dragging = true;
    startY = event.clientY;
    startHeight = container.getBoundingClientRect().height;
    grip.setPointerCapture(event.pointerId);
    documentLike.body.classList.add('rp-anim-resizing');
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    // Moving upward produces a negative pointer delta and therefore increases
    // panel height; this mirrors dragging the panel's top edge physically.
    applyHeight(startHeight + (startY - event.clientY));
  }

  function handlePointerEnd(event) {
    if (!dragging) return;
    dragging = false;
    try { grip.releasePointerCapture(event.pointerId); } catch {}
    documentLike.body.classList.remove('rp-anim-resizing');
    onLayout?.();
    onRender?.();
  }

  function handleKeydown(event) {
    const current = container.getBoundingClientRect().height;
    const nextByKey = {
      ArrowUp: current + keyboardStep,
      ArrowDown: current - keyboardStep,
      Home: minimumHeight,
      End: maximumHeight(),
    };
    if (!(event.key in nextByKey)) return;
    event.preventDefault();
    applyHeight(nextByKey[event.key]);
    onRender?.();
  }

  function handleWindowResize() {
    grip.setAttribute('aria-valuemax', String(maximumHeight()));
    if (!container.style.height) {
      syncAccessibleValue();
      return;
    }
    applyHeight(Number.parseFloat(container.style.height));
  }

  function connect() {
    syncAccessibleValue();
    grip.addEventListener('pointerdown', handlePointerDown);
    grip.addEventListener('pointermove', handlePointerMove);
    grip.addEventListener('pointerup', handlePointerEnd);
    grip.addEventListener('pointercancel', handlePointerEnd);
    grip.addEventListener('keydown', handleKeydown);
    windowLike.addEventListener('resize', handleWindowResize);
  }

  function disconnect() {
    grip.removeEventListener('pointerdown', handlePointerDown);
    grip.removeEventListener('pointermove', handlePointerMove);
    grip.removeEventListener('pointerup', handlePointerEnd);
    grip.removeEventListener('pointercancel', handlePointerEnd);
    grip.removeEventListener('keydown', handleKeydown);
    windowLike.removeEventListener('resize', handleWindowResize);
  }

  return { applyHeight, connect, disconnect };
}
