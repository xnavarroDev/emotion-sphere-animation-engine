/**
 * Owns the long-lived Three.js scene, camera, renderer, and render-target I/O.
 * Higher-level scene modules receive this API instead of mutating renderer
 * lifecycle state independently.
 */
export function createSceneRuntime({ THREE, mount, width, height, pixelRatio }) {
  if (!THREE || !mount) throw new TypeError('THREE and mount are required');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 120);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000);
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  mount.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  return {
    scene,
    camera,
    renderer,
    group,
    canvas: renderer.domElement,

    get aspect() {
      return camera.aspect;
    },

    get pixelRatio() {
      return renderer.getPixelRatio();
    },

    getViewportSize() {
      return {
        width: Math.max(1, renderer.domElement.width),
        height: Math.max(1, renderer.domElement.height),
      };
    },

    resize(nextWidth, nextHeight, left = 0) {
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      renderer.domElement.style.left = `${left}px`;
      renderer.domElement.style.top = '0px';
    },

    setVerticalViewOffset(viewWidth, viewHeight, occludedHeight) {
      if (occludedHeight > 0) {
        camera.setViewOffset(
          viewWidth,
          viewHeight + occludedHeight,
          0,
          occludedHeight,
          viewWidth,
          viewHeight,
        );
      } else {
        camera.clearViewOffset();
      }
    },

    setTransparentBackground() {
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.mixBlendMode = 'plus-lighter';
    },

    render() {
      renderer.render(scene, camera);
    },

    readPixels(target, widthPx, heightPx, pixelBuffer) {
      renderer.setRenderTarget(target);
      try {
        renderer.setClearColor(0x000000, 0);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, widthPx, heightPx, pixelBuffer);
      } finally {
        renderer.setRenderTarget(null);
      }
    },
  };
}
