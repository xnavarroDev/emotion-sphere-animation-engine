import { createParticleColorRenderer } from '../scene/particle-colors.js';
import { createParticleSpawner } from '../scene/particle-spawner.js';
import { createParticleTrailSystem } from '../scene/particle-trails.js';
import { createSceneFrameRunner } from '../scene/scene-frame-runner.js';
import {
  createSphereDragController,
  createSphereRotationController,
} from '../scene/sphere-drag.js';
import { createEditorViewport } from '../ui/shell/editor-viewport.js';

const DEFAULT_SERVICES = {
  createParticleColorRenderer,
  createParticleSpawner,
  createParticleTrailSystem,
  createSceneFrameRunner,
  createSphereDragController,
  createSphereRotationController,
  createEditorViewport,
};

/**
 * Boots the continuously running scene-render subsystem.
 *
 * Buffer construction remains with the entry point because those resources are
 * also used by thumbnail capture. This bootstrap owns the runtime services that
 * operate on those buffers: births, trails, color passes, drag/rotation, frame
 * ordering, and viewport updates.
 */
export function initializeSceneRenderRuntime({
  THREE,
  documentLike,
  windowLike,
  group,
  sceneRuntime,
  cloud,
  getCore,
  classic,
  shell,
  inner,
  materials,
  trailTexture,
  getTrailLifetime,
  getSpawnInterval,
  onSpawn,
  getColorState,
  getFrameState,
  tickCycle,
  updateInnerLayers,
  onSceneResize,
  services = DEFAULT_SERVICES,
}) {
  const particleTrails = services.createParticleTrailSystem({
    THREE,
    group,
    texture: trailTexture,
    particleCount: inner.count,
    initialPositions: inner.initialPositions,
    getLifetime: getTrailLifetime,
  });
  const particleSpawner = services.createParticleSpawner({
    particleCount: inner.count,
    getInterval: getSpawnInterval,
    onSpawn: (index, currentTime) => onSpawn(index, currentTime, particleTrails),
  });

  const colorRenderer = services.createParticleColorRenderer({
    shell: {
      count: shell.count,
      origin: shell.origin,
      phase: shell.phases,
      colors: shell.colors,
      geometry: shell.geometry,
    },
    inner: {
      count: inner.count,
      origin: inner.origin,
      phase: inner.phases,
      colors: inner.colors,
      geometry: inner.geometry,
      sequenceTint: inner.sequenceTint,
    },
    getState: getColorState,
  });
  const updateColors = time => colorRenderer.update(time);
  updateColors(0);

  const sphereDrag = services.createSphereDragController({
    canvas: sceneRuntime.canvas,
    windowLike,
    body: documentLike.body,
  });
  sphereDrag.connect();
  const sphereRotation = services.createSphereRotationController({
    THREE,
    group,
    dragController: sphereDrag,
  });
  const clock = new THREE.Clock();

  const frameRunner = services.createSceneFrameRunner({
    classic,
    shell: {
      origin: shell.origin,
      phases: shell.phases,
      positionAttribute: shell.geometry.getAttribute('position'),
    },
    inner: {
      origin: inner.origin,
      phases: inner.phases,
      axes: inner.axes,
      births: inner.births,
      visibility: inner.visibility,
      colors: inner.colors,
      positionAttribute: inner.geometry.getAttribute('position'),
      sizeAttribute: inner.geometry.attributes.aSize,
      colorAttribute: inner.geometry.attributes.color,
    },
    materials,
    particleSpawner,
    particleTrails,
    sphereRotation,
    presentation: { cloud, getCore, group },
    getState: getFrameState,
    updateColors,
    updateInnerLayers,
    render: () => sceneRuntime.render(),
  });

  function animate() {
    windowLike.requestAnimationFrame(animate);
    tickCycle();
    frameRunner.run(clock.getElapsedTime());
  }
  animate();

  const viewport = services.createEditorViewport({
    windowLike,
    documentLike,
    sceneRuntime,
    onSceneResize,
  });
  viewport.connect();

  return {
    clock,
    particleSpawner,
    particleTrails,
    setAnimationSpeed: multiplier => frameRunner.setAnimationSpeed(multiplier),
    trailPoints: particleTrails.points,
    viewport,
  };
}
