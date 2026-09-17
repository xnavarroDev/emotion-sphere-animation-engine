import { setExpanded } from '../accessibility.js';

/**
 * Coordinates the editor panel's two collapse controls with scene layout.
 * Keeping this in one adapter prevents body classes, button ARIA state, and
 * the timeline's left edge from describing different panel states.
 */
export function createPanelShell({
  documentLike,
  onLayout,
  schedule = (callback, delay) => setTimeout(callback, delay),
}) {
  const panel = documentLike.getElementById('redesign-panel');
  const collapseButton = documentLike.getElementById('rp-collapse-btn');
  const revealRail = documentLike.getElementById('rp-collapse-rail');
  const timeline = documentLike.getElementById('anim-canvas-controls');

  function setCollapsed(collapsed) {
    panel.classList.toggle('collapsed', collapsed);
    documentLike.body.classList.toggle('rp-collapsed', collapsed);
    setExpanded(collapseButton, !collapsed);
    setExpanded(revealRail, !collapsed);
    if (timeline) timeline.style.left = collapsed ? '0' : '339px';

    // Reflow immediately for responsive feedback and once more after the CSS
    // slide finishes, when geometry reports the panel's settled position.
    onLayout();
    schedule(onLayout, 280);
  }

  collapseButton.addEventListener('click', () => setCollapsed(true));
  revealRail.addEventListener('click', () => setCollapsed(false));

  return { setCollapsed };
}
