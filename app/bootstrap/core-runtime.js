import { createCorePrototypes } from '../scene/core-prototypes.js';
import { createCorePrototypeControls } from '../ui/controls/core-prototype-controls.js';
import { initializePresetRuntime } from './preset-runtime.js';

/**
 * Attaches the asynchronously loaded sphere core and then starts preset/runtime
 * services that depend on its generated controls being present.
 *
 * Keeping this ordering in one bootstrap prevents the entry point from
 * exposing a half-initialized core to preset restoration or kiosk URL loading.
 */
export async function initializeCoreRuntime({
  THREE,
  group,
  innerLayers,
  documentLike,
  emotionControls,
  getSphereMode,
  applySphereMode,
  onCoreReady,
  onPrototypeControlsReady,
  presetRuntimeOptions,
  loadCore = () => import('../../sphere-core.js?v=proto3'),
  initializePresetRuntimeFn = initializePresetRuntime,
}) {
  const { attachSphereCore } = await loadCore();
  const core = attachSphereCore({
    THREE,
    group,
    innerLayers,
    controlsRoot: documentLike.getElementById('params-controls'),
  });
  core.sprite.visible = false;
  onCoreReady(core);

  const prototypeControls = createCorePrototypeControls({
    documentLike,
    prototypes: createCorePrototypes(),
    emotionControls,
    getCore: () => core,
  });
  onPrototypeControlsReady(prototypeControls);

  // Core attachment hides emitter layers, so restore whichever renderer mode
  // the user selected while the dynamic module was still loading.
  applySphereMode?.(getSphereMode());
  prototypeControls.select(prototypeControls.activeName);

  const panel = documentLike.getElementById('params-panel');
  documentLike.getElementById('params-toggle')?.addEventListener('click', () => {
    panel?.classList.toggle('hidden');
  });
  documentLike.getElementById('reset-core-params')?.addEventListener('click', () => {
    prototypeControls.select(prototypeControls.activeName);
  });

  const presetRuntime = await initializePresetRuntimeFn(presetRuntimeOptions);
  return { core, prototypeControls, presetRuntime };
}
