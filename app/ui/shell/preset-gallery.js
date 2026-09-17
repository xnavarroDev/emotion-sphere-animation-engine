import { setPressed } from '../accessibility.js';

const DEFAULT_PRESETS = [
  { emotion: 'calm', label: 'Calm' },
  { emotion: 'sad', label: 'Sad' },
  { emotion: 'warm', label: 'Warm' },
  { emotion: 'anger', label: 'Anger' },
];

/**
 * Presents the built-in preset carousel and its live "New preset" card.
 *
 * The gallery deliberately knows nothing about WebGL or the preset text
 * format. Those application concerns arrive as callbacks, while this adapter
 * owns card ordering, selection state, confirmation, and preview debouncing.
 */
export function createPresetGallery({
  documentLike,
  presets = DEFAULT_PRESETS,
  captureCurrentPreview,
  serializeDefault,
  restoreDefault,
  loadPreset,
  hasUnsavedChanges,
  resetUnsavedState,
  confirmDiscard,
  onError = error => console.warn(error.message),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancelSchedule = timer => clearTimeout(timer),
}) {
  const cards = [{ kind: 'new', label: 'New preset' }, ...presets.map(preset => ({
    kind: 'preset',
    ...preset,
  }))];
  const cardElements = [...documentLike.querySelectorAll('.rp-cards-row .rp-card-stub')];
  const arrow = documentLike.querySelector('.rp-cards-arrow');
  let offset = 0;
  let activePreset = null;
  let defaultPresetText = null;
  let currentPreview = null;
  let previewTimer = null;

  function refreshPreview() {
    try {
      currentPreview = captureCurrentPreview();
    } catch {
      // A failed GPU read must not make preset navigation unusable. The live
      // card simply falls back to its CSS background until capture recovers.
      currentPreview = null;
    }
  }

  function render() {
    cardElements.forEach((element, index) => {
      const card = cards[(offset + index) % cards.length];
      const isNew = card.kind === 'new';
      const active = isNew ? activePreset === null : activePreset === card.emotion;
      const label = documentLike.createElement('span');
      label.textContent = card.label;
      element.replaceChildren(label);
      element.classList.toggle('active', active);
      setPressed(element, active);
      element.style.backgroundImage = isNew
        ? (currentPreview ? `url(${currentPreview})` : 'none')
        : `url('presets/thumbs/preset-${card.emotion}.png')`;
      element.title = isNew
        ? 'Your current unsaved preset - click to start over'
        : `Load the ${card.label} preset`;
      element.onclick = isNew ? startNew : () => {
        Promise.resolve(loadPreset(card.emotion))
          .then(() => {
            activePreset = card.emotion;
            render();
          })
          .catch(onError);
      };
    });
  }

  function captureDefault() {
    if (defaultPresetText) return true;
    const serialized = serializeDefault();
    if (!serialized) return false;
    defaultPresetText = serialized;
    refreshPreview();
    render();
    return true;
  }

  function startNew() {
    if (!defaultPresetText) return;
    if (hasUnsavedChanges() && !confirmDiscard()) return;
    restoreDefault(defaultPresetText);
    resetUnsavedState();
    activePreset = null;
    refreshPreview();
    render();
  }

  function queuePreviewRefresh() {
    if (previewTimer !== null) cancelSchedule(previewTimer);
    // Capturing is a synchronous GPU transaction, so wait for a burst of
    // slider/name edits to settle instead of reading pixels on every input.
    previewTimer = schedule(() => {
      previewTimer = null;
      refreshPreview();
      render();
    }, 1200);
  }

  arrow?.addEventListener('click', () => {
    // Keep the original four-step carousel behavior: the fifth "New" card is
    // an anchor while the four shipped presets rotate through the row.
    offset = (offset + 1) % presets.length;
    render();
  });
  render();

  return { captureDefault, queuePreviewRefresh, render };
}
