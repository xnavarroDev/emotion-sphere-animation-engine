/**
 * Owns the single floating preview shared by every timeline thumbnail slot.
 *
 * Slots live inside clipped segment lanes, so enlarging a slot in place would
 * crop it. This presenter creates one body-level overlay and reuses it across
 * hovers; capture and slot construction remain separate concerns.
 */
export function createThumbnailPreview({
  documentLike,
  windowLike,
  getAspect,
  formatTime,
}) {
  let preview = null;

  function ensurePreview() {
    if (preview) return preview;
    preview = documentLike.createElement('div');
    preview.className = 'rp-thumb-preview';
    const image = documentLike.createElement('div');
    image.className = 'rp-thumb-preview-img';
    const label = documentLike.createElement('div');
    label.className = 'rp-thumb-preview-sec';
    preview.append(image, label);
    documentLike.body.appendChild(preview);
    return preview;
  }

  function show(slot, seconds) {
    const element = ensurePreview();
    const bounds = slot.getBoundingClientRect();
    const image = element.firstChild;
    image.style.backgroundImage = slot.style.backgroundImage || 'none';

    // Use the captured frame's aspect instead of the narrow strip slot's
    // geometry, so the popup reveals the complete frame rather than cropping.
    const width = parseFloat(windowLike.getComputedStyle(image).width);
    image.style.height = `${Math.round(width / getAspect())}px`;
    element.lastChild.textContent = formatTime(seconds);
    element.style.left = `${bounds.left + bounds.width / 2}px`;
    element.style.top = `${bounds.top}px`;
    element.style.display = 'flex';
  }

  function hide() {
    if (preview) preview.style.display = 'none';
  }

  return { show, hide };
}
