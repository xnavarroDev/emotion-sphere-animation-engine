/**
 * Creates the small procedural textures used by particle point materials.
 * Keeping canvas drawing beside shader customization makes material setup
 * reusable without coupling it to scene objects or animation state.
 */
export function createRadialGlowTexture({ THREE, documentLike }) {
  const canvas = documentLike.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createFacetGlowTexture({ THREE, documentLike }) {
  const canvas = documentLike.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 64, 64);
  context.save();
  context.translate(32, 32);
  context.rotate(Math.PI / 4);
  context.scale(1.15, 0.58);
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, 30);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.32, 'rgba(255,255,255,0.52)');
  glow.addColorStop(0.72, 'rgba(255,255,255,0.12)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(-30, -30, 60, 60);
  context.restore();
  const streak = context.createLinearGradient(6, 32, 58, 32);
  streak.addColorStop(0, 'rgba(255,255,255,0)');
  streak.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  streak.addColorStop(0.55, 'rgba(255,255,255,0.42)');
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = streak;
  context.fillRect(6, 28, 52, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// THREE's stock points shader supports one uniform size. This targeted patch
// multiplies that value by a geometry attribute while retaining all built-in
// perspective attenuation and material behavior.
export function patchPerVertexPointSize(pointsMaterial, attributeName) {
  pointsMaterial.customProgramCacheKey = () => `pvSize:${attributeName}:${pointsMaterial.size}`;
  pointsMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float ${attributeName};`)
      .replace('#include <pointsize>', `#include <pointsize>\n gl_PointSize *= ${attributeName};`);
  };
  pointsMaterial.needsUpdate = true;
}
