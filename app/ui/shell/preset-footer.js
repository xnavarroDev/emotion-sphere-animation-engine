/**
 * Owns the preset footer's transient UI state.
 *
 * "Dirty" is presentation state, not the undo history itself. The application
 * is notified when a change occurs so it can create history boundaries and
 * refresh preview art, while this controller handles the unsaved indicator,
 * name normalization, clipboard save, and temporary confirmation text.
 */
export function createPresetFooter({
  documentLike,
  clipboard,
  serialize,
  onNameChange = () => {},
  onDirty,
  schedule = (callback, delay) => setTimeout(callback, delay),
}) {
  const nameInput = documentLike.getElementById('rp-preset-name');
  const unsaved = documentLike.getElementById('rp-unsaved');
  const saveButton = documentLike.getElementById('rp-save-btn');
  let dirty = false;

  function markDirty() {
    dirty = true;
    unsaved.classList.add('show');
    onDirty();
  }

  function reset({ clearName = false } = {}) {
    dirty = false;
    unsaved.classList.remove('show');
    if (clearName) {
      nameInput.value = '';
      onNameChange(null);
    }
  }

  nameInput.addEventListener('input', () => {
    onNameChange(nameInput.value.trim() || null);
    markDirty();
  });
  saveButton.addEventListener('click', () => {
    // Clipboard support is optional (for example in restricted embeds). Saving
    // still clears the local dirty marker, matching the existing editor flow.
    clipboard?.writeText(serialize()).catch(() => {});
    reset();
    const original = saveButton.textContent;
    saveButton.textContent = 'Saved to clipboard!';
    schedule(() => { saveButton.textContent = original; }, 1400);
  });

  return {
    get isDirty() { return dirty; },
    markDirty,
    reset,
  };
}
