/**
 * Coordinates the Circles/Fireflies mode switch across buttons, legacy panel
 * sections, and scene objects. Centralizing this visibility matrix prevents a
 * new rendering layer from being shown in one mode but forgotten in another.
 */
export function createSphereModeControls({
  documentLike,
  getCircleLayers,
  classicObjects,
  shellPoints,
  setMode,
  setPressed,
}) {
  const circlesButton = documentLike.getElementById('mode-circles');
  const firefliesButton = documentLike.getElementById('mode-fireflies');
  const legacyFireflies = documentLike.getElementById('toggle-fireflies');
  const circleSections = [
    documentLike.getElementById('firefly-field-heading'),
    documentLike.getElementById('firefly-layer-tabs'),
    documentLike.getElementById('firefly-field-controls'),
  ];
  const classicSections = [
    documentLike.getElementById('classic-heading'),
    documentLike.getElementById('classic-controls'),
  ];

  function apply(mode) {
    const normalized = mode === 'fireflies' ? 'fireflies' : 'circles';
    const showClassic = normalized === 'fireflies';
    setMode(normalized);

    circlesButton?.classList.toggle('active', !showClassic);
    firefliesButton?.classList.toggle('active', showClassic);
    setPressed(circlesButton, !showClassic);
    setPressed(firefliesButton, showClassic);

    for (const layer of getCircleLayers()) layer.points.visible = !showClassic;
    for (const object of classicObjects) object.visible = showClassic;
    shellPoints.visible = showClassic;

    legacyFireflies?.classList.toggle('active', showClassic);
    setPressed(legacyFireflies, showClassic);
    for (const section of circleSections) section.style.display = showClassic ? 'none' : '';
    for (const section of classicSections) section.style.display = showClassic ? '' : 'none';
  }

  circlesButton?.addEventListener('click', () => apply('circles'));
  firefliesButton?.addEventListener('click', () => apply('fireflies'));

  return { apply };
}
