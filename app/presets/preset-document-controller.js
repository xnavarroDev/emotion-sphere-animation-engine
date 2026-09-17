import { parsePresetDocument } from './preset-format.js';
import { restoreParsedPreset } from './preset-restorer.js';
import { serializeLivePreset } from './preset-state.js';

/**
 * Bridges the stable preset format to the browser editor.
 *
 * Domain parsing/restoration stays in the smaller preset modules. This
 * controller owns document-level policy: invalidate old previews, discover
 * generated core inputs, synchronize mirrored controls, and establish a new
 * undo baseline after a successful load.
 */
export function createPresetDocumentController({
  documentLike,
  collectSerializationState,
  createRestoreContext,
  clearThumbnails,
  syncAfterRestore,
  isHistoryRestoring,
  resetHistoryAfterLoad,
  setPressed,
}) {
  function serialize() {
    return serializeLivePreset({
      documentLike,
      ...collectSerializationState(),
    });
  }

  function restore(text) {
    // Cache keys contain track/time identity, not the complete visual state.
    // A new document must therefore invalidate every old preview up front.
    clearThumbnails();

    const presetNameInput = documentLike.getElementById('rp-preset-name');
    if (presetNameInput) presetNameInput.value = '';

    const coreInputs = {};
    documentLike.querySelectorAll('#params-controls .row').forEach(row => {
      const key = row.querySelector('span')?.textContent.trim();
      const input = row.querySelector('input');
      if (key && input) coreInputs[key] = input;
    });

    const setCoreParameter = (key, value) => {
      const input = coreInputs[key];
      if (!input) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const setPresetName = value => {
      // Do not dispatch input here: loading is a baseline, not an authored edit.
      const input = documentLike.getElementById('rp-preset-name');
      if (input) input.value = value;
    };
    const setToggle = (id, enabled, apply) => {
      const button = documentLike.getElementById(id);
      button?.classList.toggle('active', enabled);
      setPressed(button, enabled);
      apply(enabled);
    };

    restoreParsedPreset({
      parsedPreset: parsePresetDocument(text),
      ...createRestoreContext({ setCoreParameter, setPresetName, setToggle }),
    });
    syncAfterRestore();

    // Undo belongs to one document. Preserve history only when this restore is
    // itself servicing Undo; every external load starts a fresh history root.
    if (!isHistoryRestoring()) resetHistoryAfterLoad();
  }

  return { serialize, restore };
}
