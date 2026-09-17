/** Shared renderer factories for the two inner-layer implementations. */

import { createTimeline as createDefaultTimeline } from '../animation/timeline.js';

function createEdgeFadeTexture({ THREE, documentLike, size = 512, fade = 60 }) {
  const canvas = documentLike.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, size, size);

  const gradient = (x0, y0, x1, y1) => {
    const value = context.createLinearGradient(x0, y0, x1, y1);
    value.addColorStop(0, 'black');
    value.addColorStop(1, 'rgba(0,0,0,0)');
    return value;
  };
  // Fade only the outer strips. The center remains opaque so large point
  // sprites lose the square canvas edge without dimming the sphere itself.
  context.fillStyle = gradient(0, 0, fade, 0); context.fillRect(0, 0, fade, size);
  context.fillStyle = gradient(size, 0, size - fade, 0); context.fillRect(size - fade, 0, fade, size);
  context.fillStyle = gradient(0, 0, 0, fade); context.fillRect(0, 0, size, fade);
  context.fillStyle = gradient(0, size, 0, size - fade); context.fillRect(0, size - fade, size, fade);
  return new THREE.CanvasTexture(canvas);
}

/** Create the legacy canvas-rendered inner sprites and attach them to `group`. */
export function createCanvasParticleLayers({
  THREE, documentLike, ParticleField, defaults, presets, group,
}) {
  const edgeMask = createEdgeFadeTexture({ THREE, documentLike });
  return presets.map(preset => {
    const canvas = documentLike.createElement('canvas');
    canvas.width = canvas.height = 512;
    const field = new ParticleField(canvas, {
      ...defaults,
      background: [0, 0, 0, 0],
      glowOscAmp: 0,
      breathAmp: 0,
      breathSpeed: 0,
      ...preset,
    });
    field.resize(512, 512, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.premultiplyAlpha = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      alphaMap: edgeMask,
      alphaTest: 0.01,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0.5);
    sprite.renderOrder = 4;
    sprite.scale.set(1.8, 1.8, 1);
    group.add(sprite);
    return { field, tex: texture, sprite, overrides: {} };
  });
}

/**
 * Create a stateful firefly-layer factory with deterministic rotation axes.
 * Axis allocation belongs to the factory so added and split layers continue
 * the same Fibonacci distribution as initially authored layers.
 */
export function createFireflyLayerFactory({
  THREE, createFireflyField, group, pixelRatio, getActiveEmotion,
  getSphereMode, defaultColors, createTimeline = createDefaultTimeline, maxLayers = 8,
}) {
  let axisSeed = 0;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  function axisFor(index) {
    let z = 1 - (index + 0.5) * (2 / maxLayers);
    z = Math.max(-0.98, Math.min(0.98, z));
    const radius = Math.sqrt(1 - z * z);
    const theta = goldenAngle * index;
    return new THREE.Vector3(radius * Math.cos(theta), z, radius * Math.sin(theta));
  }

  return {
    maxLayers,
    create(preset = {}, overrides = {}) {
      const field = createFireflyField(THREE, {
        shape: 'sphere',
        color: defaultColors[getActiveEmotion()] ?? 0xffc24a,
        dpr: pixelRatio,
        ...preset,
      });
      field.overrides = { ...overrides };
      field.anim = true;
      field.name = null;
      field.idle = { ...field.params };
      field.timeline = createTimeline();
      field._animPrevT = 0;
      field.spinAxis = axisFor(axisSeed++ % maxLayers);
      field.points.visible = getSphereMode() === 'circles';
      group.add(field.points);
      return field;
    },
    dispose(field) {
      group.remove(field.points);
      field.points.geometry.dispose();
      field.points.material.dispose();
    },
  };
}
