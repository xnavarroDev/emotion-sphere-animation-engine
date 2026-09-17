/**
 * Renders the original compact phase list retained for compatibility.
 *
 * This module owns row construction and transient visual feedback only.
 * Snapshot capture/application and timeline mutation are callbacks so both the
 * legacy list and redesigned timeline continue to edit the same domain state.
 */
export function createLegacyPhaseList({
  documentLike,
  container,
  getTimeline,
  onEdit,
  onCapture,
  onClear,
  onDuration,
  onAdd,
  schedule = (callback, delay) => setTimeout(callback, delay),
}) {
  function createPhaseBlock(phase, index) {
    const fragment = documentLike.createDocumentFragment();
    const row = documentLike.createElement('div');
    row.className = 'anim-phase-row';
    const dot = documentLike.createElement('div');
    dot.className = 'anim-dot';
    if (phase.snapshot) dot.classList.add('set');
    const label = documentLike.createElement('span');
    label.className = 'anim-phase-label';
    label.textContent = index === 0 ? 'Starting Phase' : `Phase ${index + 1}`;
    const editButton = documentLike.createElement('button');
    editButton.className = 'anim-cap';
    editButton.textContent = 'Edit';
    editButton.title = 'Load this phase onto the sliders to see and change it';
    const captureButton = documentLike.createElement('button');
    captureButton.className = 'anim-cap';
    captureButton.textContent = 'Capture';
    const clearButton = documentLike.createElement('button');
    clearButton.className = 'anim-cap';
    clearButton.textContent = '×';
    clearButton.title = 'Clear this phase';
    clearButton.style.color = 'rgba(255,100,100,0.6)';
    row.append(dot, label, editButton, captureButton, clearButton);
    fragment.appendChild(row);

    editButton.addEventListener('click', () => {
      if (!phase.snapshot) {
        editButton.textContent = 'empty';
        schedule(() => { editButton.textContent = 'Edit'; }, 700);
        return;
      }
      onEdit(phase);
      container.querySelectorAll('.anim-phase-row').forEach(element => element.classList.remove('editing'));
      row.classList.add('editing');
    });
    captureButton.addEventListener('click', () => {
      onCapture(phase);
      dot.classList.toggle('set', Boolean(phase.snapshot));
    });
    clearButton.addEventListener('click', () => {
      onClear(phase);
      dot.classList.toggle('set', Boolean(phase.snapshot));
    });

    const durationRow = documentLike.createElement('div');
    durationRow.className = 'anim-dur-row';
    const durationInput = documentLike.createElement('input');
    durationInput.type = 'number';
    durationInput.className = 'anim-dur';
    durationInput.value = phase.duration;
    durationInput.min = 0.1;
    durationInput.step = 0.5;
    durationInput.title = 'Seconds until the next phase, or the final hold duration';
    durationInput.addEventListener('change', () => {
      onDuration(phase, Math.max(0.1, Number.parseFloat(durationInput.value) || 0.1));
    });
    const seconds = documentLike.createElement('span');
    seconds.className = 'anim-dur-s';
    seconds.textContent = 's';
    durationRow.append(durationInput, seconds);
    fragment.appendChild(durationRow);
    return fragment;
  }

  function render() {
    const timeline = getTimeline();
    container.replaceChildren();
    timeline.forEach((phase, index) => container.appendChild(createPhaseBlock(phase, index)));
    const addButton = documentLike.createElement('button');
    addButton.className = 'anim-cap';
    addButton.textContent = '+ Add Phase';
    addButton.style.cssText = 'margin-top:10px;width:100%;padding:6px;';
    addButton.addEventListener('click', () => {
      onAdd(timeline);
      render();
    });
    container.appendChild(addButton);
  }

  return { render };
}
