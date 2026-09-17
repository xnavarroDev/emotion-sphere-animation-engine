/**
 * Presents timeline phase selection and cross-track hover relationships.
 *
 * The application owns which phase is selected and how its snapshot changes
 * the scene. This presenter owns only the DOM consequences: hover groups,
 * the shared vertical phase band, scene-control disclosure, and the element
 * lookup used to repaint a phase after a live edit.
 */
export function createTimelineSelectionPresenter({
  documentLike,
  getOverlay,
  getLaneScroll,
  sceneControls,
  setExpanded,
}) {
  const phaseViews = new Map();
  const labelGroups = new Map();
  let phaseBand = null;

  // A full timeline render replaces every registered node. Resetting here is
  // important: retaining detached nodes would leak the old timeline and make
  // live-edit feedback target elements that are no longer visible.
  function reset() {
    phaseViews.clear();
    labelGroups.clear();
    phaseBand = null;
  }

  function hidePhaseBand() {
    if (phaseBand) phaseBand.style.display = 'none';
  }

  function showPhaseBand(segment) {
    const overlay = getOverlay();
    if (!overlay) return;
    if (!phaseBand || !phaseBand.isConnected) {
      phaseBand = documentLike.createElement('div');
      phaseBand.className = 'rp-phase-band';
      overlay.appendChild(phaseBand);
    }
    // Segments use lane-content coordinates, while the overlay is fixed over
    // the viewport. Subtract shared scrolling to keep the band aligned.
    phaseBand.style.left = `${segment.offsetLeft - getLaneScroll()}px`;
    phaseBand.style.width = `${segment.offsetWidth}px`;
    phaseBand.style.display = 'block';
  }

  function registerPhase({ phase, segment, nameElement, swatch, isScene, phaseIndex, displayedName }) {
    phaseViews.set(phase, { swatch, isScene, pi: phaseIndex });

    // A phase name describes one conceptual beat across every track. Grouping
    // by its displayed label lets hovering any copy illuminate the full column.
    const groupKey = displayedName.toLowerCase();
    if (!labelGroups.has(groupKey)) labelGroups.set(groupKey, []);
    labelGroups.get(groupKey).push(segment, nameElement);

    const highlight = enabled => {
      for (const element of labelGroups.get(groupKey) || []) {
        element.classList.toggle('hl', enabled);
      }
      if (enabled) showPhaseBand(segment);
      else hidePhaseBand();
    };
    segment.addEventListener('mouseenter', () => highlight(true));
    segment.addEventListener('mouseleave', () => highlight(false));
    nameElement.addEventListener('mouseenter', () => highlight(true));
    nameElement.addEventListener('mouseleave', () => highlight(false));
  }

  function revealSceneControls() {
    if (!sceneControls) return;
    const {
      paramsSection,
      paramsHeader,
      paramsChevron,
      backgroundGroup,
      backgroundHeader,
      backgroundChevron,
    } = sceneControls;
    paramsSection.classList.remove('collapsed');
    paramsChevron.classList.add('rp-flip-y');
    setExpanded(paramsHeader, true);
    backgroundGroup.classList.add('open');
    backgroundChevron.classList.add('rp-flip-y');
    setExpanded(backgroundHeader, true);
  }

  function wirePhaseSelection({ segment, isScene, shouldIgnore, onSelect }) {
    segment.addEventListener('click', event => {
      if (shouldIgnore(event)) return;
      // Resize and delete controls bubble through the segment but represent
      // their own actions; they must never also select/load the phase.
      if (event.target.closest('.resize-handle,.rp-segment-del')) return;
      if (isScene) revealSceneControls();
      onSelect();
    });
  }

  return {
    getPhaseView: phase => phaseViews.get(phase),
    registerPhase,
    reset,
    wirePhaseSelection,
  };
}
