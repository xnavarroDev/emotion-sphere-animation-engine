/**
 * Wires the particle-layer navigator and action toolbar.
 *
 * The controller owns stable DOM concerns: button routing, the active-layer
 * heading/name field, and whether Paste is available. Layer allocation,
 * disposal, timeline alignment, confirmations, and undo are application rules
 * supplied as callbacks, so this module never reaches into renderer objects.
 */
export function createLayerControls({
  documentLike,
  getViewModel,
  onPrevious,
  onNext,
  onRename,
  onAdd,
  onRemove,
  onClear,
  onClearAll,
  onCopy,
  onPaste,
}) {
  const eyebrow = documentLike.getElementById('rp-layer-eyebrow');
  const nameInput = documentLike.getElementById('rp-layer-name');
  const pasteButton = documentLike.getElementById('rp-layer-paste');

  documentLike.getElementById('rp-layer-prev').addEventListener('click', onPrevious);
  documentLike.getElementById('rp-layer-next').addEventListener('click', onNext);
  documentLike.getElementById('rp-layer-add').addEventListener('click', onAdd);
  documentLike.getElementById('rp-layer-remove').addEventListener('click', onRemove);
  documentLike.getElementById('rp-layer-clear').addEventListener('click', onClear);
  documentLike.getElementById('rp-layer-zero-all').addEventListener('click', onClearAll);

  nameInput.addEventListener('input', () => onRename(nameInput.value.trim() || null));
  documentLike.getElementById('rp-layer-copy').addEventListener('click', () => {
    // Copy data stays application-owned; a successful callback is the only
    // signal needed here to expose Paste across later layer navigation.
    if (onCopy() !== false) pasteButton.disabled = false;
  });
  pasteButton.addEventListener('click', onPaste);

  function sync() {
    const { activeIndex, layerCount, name } = getViewModel();
    eyebrow.textContent = `Layer ${activeIndex + 1}/${layerCount}`;
    // Playback and preset loading can call sync frequently. Never replace the
    // text under an active caret while the user is in the middle of renaming.
    if (documentLike.activeElement !== nameInput) nameInput.value = name || '';
    nameInput.placeholder = `Layer ${activeIndex + 1}`;
  }

  return {
    setPasteEnabled: enabled => { pasteButton.disabled = !enabled; },
    sync,
  };
}
