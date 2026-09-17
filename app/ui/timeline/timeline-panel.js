import { setExpanded, setSliderValue } from '../accessibility.js';

/**
 * Owns presentation state for the redesigned timeline drawer.
 *
 * Opening order matters: the scene must reflow before tracks render because
 * thumbnail geometry depends on the newly reduced canvas aspect. Centralizing
 * that order also gives phase placement and direct clicks the same behavior.
 */
export function createTimelinePanel({
  documentLike,
  onLayout,
  onOpen,
}) {
  const trigger = documentLike.getElementById('rp-animation-row');
  const container = documentLike.getElementById('anim-canvas-controls');
  const chevron = trigger.querySelector('.chev');
  const resizeGrip = documentLike.getElementById('rp-anim-resize');

  function isOpen() {
    return container.classList.contains('open');
  }

  function setOpen(open) {
    container.classList.toggle('open', open);
    chevron.classList.toggle('rp-flip-x', open);
    setExpanded(trigger, open);
    onLayout();
    if (open) {
      onOpen();
      const height = Math.round(container.getBoundingClientRect().height);
      setSliderValue(resizeGrip, height, `${height} pixels high`);
    }
    return open;
  }

  function ensureOpen() {
    return isOpen() || setOpen(true);
  }

  trigger.addEventListener('click', () => setOpen(!isOpen()));
  return { ensureOpen, isOpen, setOpen };
}
