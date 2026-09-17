/**
 * Builds the legacy animation-track navigator.
 *
 * The selector presents layer/scene state and emits selection intent, while
 * timeline snapshots and phase rows remain application-owned. `syncLayers`
 * deliberately rebuilds phase rows only when the layer count changes: this
 * method is also called during frequent name and playback refreshes, where a
 * rebuild would replace focused duration inputs under the user's caret.
 */
export function createAnimationTrackSelector({
  documentLike,
  anchor,
  getLayers,
  getActiveIndex,
  setActiveIndex,
  getSceneEnabled,
  setSceneEnabled,
  toggleEnabled,
  onSelectionChange,
  onLayerCountChange,
  setPressed,
}) {
  const wrapper = documentLike.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;';
  const makeArrow = text => {
    const button = documentLike.createElement('button');
    button.type = 'button'; button.className = 'ilayer-arrow'; button.textContent = text;
    return button;
  };
  const previous = makeArrow('\u2039');
  const title = documentLike.createElement('span'); title.className = 'ilayer-title';
  const next = makeArrow('\u203a');
  const toggle = documentLike.createElement('button');
  toggle.type = 'button'; toggle.className = 'ilayer-reset'; toggle.style.padding = '3px 8px';
  toggle.title = 'Whether animation playback drives this track';
  wrapper.append(previous, title, next, toggle);
  anchor.before(wrapper);

  const isScene = () => getActiveIndex() >= getLayers().length;

  function sync() {
    const layers = getLayers();
    const index = Math.min(getActiveIndex(), layers.length);
    setActiveIndex(index);
    const scene = index >= layers.length;
    const enabled = scene ? getSceneEnabled() !== false : layers[index].anim !== false;
    title.textContent = scene
      ? 'Scene'
      : `${layers[index].name || `Layer ${index + 1}`} — ${index + 1}/${layers.length}`;
    toggle.textContent = enabled ? 'On' : 'Off';
    toggle.classList.toggle('on', enabled);
    setPressed(toggle, enabled);
  }

  function select(index) {
    const count = getLayers().length + 1;
    setActiveIndex((index + count) % count);
    sync();
    onSelectionChange();
  }

  previous.addEventListener('click', () => select(getActiveIndex() - 1));
  next.addEventListener('click', () => select(getActiveIndex() + 1));
  toggle.addEventListener('click', () => {
    const index = getActiveIndex();
    if (isScene()) setSceneEnabled(toggleEnabled(getSceneEnabled()));
    else getLayers()[index].anim = toggleEnabled(getLayers()[index].anim);
    sync();
  });

  let lastLayerCount = getLayers().length;
  function syncLayers() {
    sync();
    const layerCount = getLayers().length;
    if (lastLayerCount === layerCount) return;
    lastLayerCount = layerCount;
    onLayerCountChange();
  }

  return { sync, syncLayers };
}
