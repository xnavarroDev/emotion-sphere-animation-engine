/**
 * Synchronizes sphere-core prototype selection with its generated sliders.
 * The sphere core creates these controls asynchronously, so synchronization
 * deliberately discovers rows at call time instead of caching incomplete DOM.
 */
export function createCorePrototypeControls({
  documentLike,
  prototypes,
  emotionControls,
  getCore,
  initialName = 'core',
}) {
  let activeName = initialName;

  function sync(values = prototypes[activeName]) {
    if (!values) return;
    documentLike.querySelectorAll('#params-controls .row').forEach(row => {
      const key = row.querySelector('span')?.textContent.trim();
      const input = row.querySelector('input');
      const output = row.querySelector('em');
      if (!key || !input || !(key in values)) return;
      const step = Number.parseFloat(input.step) || 1;
      input.value = values[key];
      if (output) output.textContent = Number(values[key]).toFixed(step < 1 ? 2 : 0);
    });
  }

  function select(name) {
    if (!prototypes[name]) return false;
    activeName = name;
    emotionControls.setPrototypeActive(name);
    getCore()?.setPrototype(prototypes[name]);
    sync(prototypes[name]);
    return true;
  }

  return {
    select,
    sync,
    get activeName() { return activeName; },
  };
}
