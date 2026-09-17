/**
 * Wires the original preset action buttons retained for compatibility.
 *
 * Serialization, restoration, and share-link encoding are injected so this
 * UI adapter cannot drift from the canonical preset format. It owns only
 * browser I/O and short-lived button feedback.
 */
export function createLegacyPresetActions({
  documentLike,
  clipboard,
  serialize,
  apply,
  createShareUrl,
  BlobCtor = Blob,
  urlApi = URL,
  now = () => Date.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  onError = error => console.error('load failed', error),
}) {
  function flash(button, message) {
    const original = button.textContent;
    button.textContent = message;
    schedule(() => { button.textContent = original; }, 1200);
  }

  const copyButton = documentLike.getElementById('copy-params');
  copyButton?.addEventListener('click', () => {
    clipboard?.writeText(serialize())
      .then(() => flash(copyButton, 'Copied'))
      .catch(() => flash(copyButton, 'Failed'));
  });

  const shareButton = documentLike.getElementById('share-link');
  shareButton?.addEventListener('click', () => {
    clipboard?.writeText(createShareUrl(serialize()))
      .then(() => flash(shareButton, 'Link copied'))
      .catch(() => flash(shareButton, 'Failed'));
  });

  const saveButton = documentLike.getElementById('save-params');
  saveButton?.addEventListener('click', () => {
    const blob = new BlobCtor([serialize()], { type: 'text/plain' });
    const anchor = documentLike.createElement('a');
    anchor.href = urlApi.createObjectURL(blob);
    anchor.download = `particle-params-${now()}.txt`;
    anchor.click();
    urlApi.revokeObjectURL(anchor.href);
    flash(saveButton, 'Saved');
  });

  const loadButton = documentLike.getElementById('load-params');
  loadButton?.addEventListener('click', () => {
    if (!clipboard?.readText) {
      flash(loadButton, 'No clip');
      return;
    }
    clipboard.readText().then(text => {
      if (!text?.trim()) {
        flash(loadButton, 'Empty');
        return;
      }
      try {
        apply(text);
        flash(loadButton, 'Loaded');
      } catch (error) {
        onError(error);
        flash(loadButton, 'Failed');
      }
    }).catch(() => flash(loadButton, 'Failed'));
  });
}
