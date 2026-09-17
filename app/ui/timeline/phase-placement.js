// Owns the temporary UI state for the two-click "place a phase" gesture.
// It does not know how timelines are stored or how a phase is constructed;
// insertSpan and onPlaced keep those domain decisions in the application.
export function createPhasePlacementController({
  addButton,
  documentLike,
  tracksElement,
  ensureOpen,
  getReferenceLane,
  getOverlay,
  getAxisSeconds,
  getLaneScroll,
  formatTime,
  insertSpan,
  onPlaced,
  minimumDuration = 0.5,
}) {
  if (!addButton || !documentLike || !tracksElement || !insertSpan) {
    throw new TypeError('addButton, documentLike, tracksElement, and insertSpan are required');
  }

  let placement = null;
  let ghost = null;
  let band = null;

  function timeFromClientX(clientX) {
    const lane = getReferenceLane();
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    if (!rect.width) return null;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return fraction * getAxisSeconds();
  }

  function ensureFeedbackElements() {
    if (!ghost) {
      ghost = documentLike.createElement('div');
      ghost.className = 'rp-place-ghost';
      documentLike.body.appendChild(ghost);
    }
    // A track rebuild detaches the old overlay and its band. Reattach the
    // existing band to the new overlay instead of creating duplicate guides.
    if (!band || !band.isConnected) {
      band = documentLike.createElement('div');
      band.className = 'rp-place-band';
      (getOverlay() || tracksElement).appendChild(band);
    }
    return { ghost, band };
  }

  function cancel() {
    placement = null;
    documentLike.body.classList.remove('rp-placing');
    addButton.classList.remove('armed');
    if (ghost) ghost.style.display = 'none';
    if (band) band.style.display = 'none';
  }

  function start() {
    ensureOpen?.();
    placement = { stage: 'start', startSeconds: 0 };
    documentLike.body.classList.add('rp-placing');
    addButton.classList.add('armed');
    const feedback = ensureFeedbackElements();
    feedback.ghost.classList.remove('typing');
    feedback.ghost.textContent = 'click to set the start';
    feedback.ghost.style.display = 'block';
    feedback.band.style.display = 'none';
  }

  function renderEnd(pointerTime) {
    const feedback = ensureFeedbackElements();
    const startSeconds = placement.startSeconds;
    let leftSeconds;
    let duration;

    if (placement.typedDuration != null) {
      leftSeconds = startSeconds;
      duration = Math.max(minimumDuration, Number.parseFloat(placement.typedDuration) || 0);
    } else {
      if (pointerTime === null) return;
      leftSeconds = Math.min(startSeconds, pointerTime);
      duration = Math.max(minimumDuration, Math.max(startSeconds, pointerTime) - leftSeconds);
    }

    placement.lastStart = leftSeconds;
    placement.lastEnd = leftSeconds + duration;
    feedback.ghost.classList.toggle('typing', placement.typedDuration != null);
    feedback.ghost.innerHTML = `${formatTime(leftSeconds)} → <span class="rp-place-dur-val">${formatTime(leftSeconds + duration)}</span>`;

    const lane = getReferenceLane();
    const laneWidth = lane.offsetWidth;
    const axisSeconds = getAxisSeconds();
    feedback.band.style.display = 'block';
    feedback.band.style.left = `${(leftSeconds / axisSeconds) * laneWidth - getLaneScroll()}px`;
    feedback.band.style.width = `${Math.max(2, (duration / axisSeconds) * laneWidth)}px`;
  }

  function handlePointerMove(event) {
    if (!placement) return;
    const feedback = ensureFeedbackElements();
    feedback.ghost.style.left = `${event.clientX}px`;
    feedback.ghost.style.top = `${event.clientY}px`;
    const pointerTime = timeFromClientX(event.clientX);

    if (placement.stage === 'start') {
      if (pointerTime !== null) feedback.ghost.textContent = `start at ${formatTime(pointerTime)}`;
      return;
    }
    placement.lastPointerTime = pointerTime;
    renderEnd(pointerTime);
  }

  function finish() {
    const startSeconds = placement.lastStart;
    const endSeconds = Math.max(startSeconds + minimumDuration, placement.lastEnd);
    const landed = insertSpan(startSeconds, endSeconds);
    cancel();
    onPlaced?.(landed);
  }

  function handleDocumentClick(event) {
    if (!placement) return;
    const target = event.target;
    const closest = target && typeof target.closest === 'function'
      ? selector => target.closest(selector)
      : () => null;

    // Clicking outside the tracks cancels placement. The add button is the
    // exception because its own click listener intentionally toggles state.
    if (!closest('#rp-tracks')) {
      if (!closest('#rp-anim-add-phase')) cancel();
      return;
    }

    const pointerTime = timeFromClientX(event.clientX);
    if (pointerTime === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (placement.stage === 'start') {
      placement = { stage: 'end', startSeconds: pointerTime, typedDuration: null };
      handlePointerMove(event);
      return;
    }
    renderEnd(pointerTime);
    finish();
  }

  function handleKeydown(event) {
    if (!placement) return;
    if (event.key === 'Escape') {
      cancel();
      return;
    }
    if (placement.stage !== 'end') return;

    // Do not steal numeric input from a field the user focused while the
    // gesture was armed; placement shortcuts apply only to the canvas state.
    const active = documentLike.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    if (event.key >= '0' && event.key <= '9') {
      placement.typedDuration = (placement.typedDuration || '') + event.key;
      event.preventDefault();
      renderEnd(placement.lastPointerTime ?? null);
    } else if (event.key === '.' && !(placement.typedDuration || '').includes('.')) {
      placement.typedDuration = (placement.typedDuration || '0') + '.';
      event.preventDefault();
      renderEnd(placement.lastPointerTime ?? null);
    } else if (event.key === 'Backspace' && placement.typedDuration) {
      placement.typedDuration = placement.typedDuration.slice(0, -1) || null;
      event.preventDefault();
      renderEnd(placement.lastPointerTime ?? null);
    } else if (event.key === 'Enter' && placement.lastStart != null && placement.lastEnd != null) {
      event.preventDefault();
      finish();
    }
  }

  function handleAddClick(event) {
    event.stopPropagation();
    if (placement) cancel();
    else start();
  }

  function connect() {
    addButton.title = 'Click, then drag a span (or type a number of seconds) on the timeline (Esc to cancel)';
    addButton.addEventListener('click', handleAddClick);
    documentLike.addEventListener('mousemove', handlePointerMove);
    documentLike.addEventListener('click', handleDocumentClick, true);
    documentLike.addEventListener('keydown', handleKeydown);
  }

  function disconnect() {
    addButton.removeEventListener('click', handleAddClick);
    documentLike.removeEventListener('mousemove', handlePointerMove);
    documentLike.removeEventListener('click', handleDocumentClick, true);
    documentLike.removeEventListener('keydown', handleKeydown);
    cancel();
    ghost?.remove();
    band?.remove();
    ghost = null;
    band = null;
  }

  return {
    get isActive() { return placement !== null; },
    cancel,
    start,
    connect,
    disconnect,
  };
}
