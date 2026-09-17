/**
 * Owns pointer-driven sphere rotation and the small inertial tail after drag.
 *
 * Rendering stays outside this controller: the animation loop asks for the
 * next Euler angles and remains responsible for applying its auto-rotation
 * quaternion. Keeping listeners here makes the scene interaction lifecycle
 * discoverable and prevents input bookkeeping from spreading through app.js.
 */
export function createSphereDragController({
  canvas,
  windowLike,
  body,
  sensitivity = 0.006,
  damping = 0.92,
}) {
  if (!canvas || !windowLike || !body) throw new TypeError('canvas, windowLike, and body are required');

  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let rotationX = 0;
  let rotationY = 0;
  let velocityX = 0;
  let velocityY = 0;

  function begin(x, y, showMouseCursor) {
    dragging = true;
    previousX = x;
    previousY = y;
    velocityX = 0;
    velocityY = 0;
    if (showMouseCursor) body.classList.add('dragging');
  }

  function move(x, y) {
    if (!dragging) return;
    const dx = x - previousX;
    const dy = y - previousY;
    velocityX = dy * sensitivity;
    velocityY = dx * sensitivity;
    rotationX += velocityX;
    rotationY += velocityY;
    previousX = x;
    previousY = y;
  }

  const onMouseDown = event => begin(event.clientX, event.clientY, true);
  const onMouseMove = event => move(event.clientX, event.clientY);
  const onMouseUp = () => {
    dragging = false;
    body.classList.remove('dragging');
  };
  const onTouchStart = event => begin(event.touches[0].clientX, event.touches[0].clientY, false);
  const onTouchMove = event => move(event.touches[0].clientX, event.touches[0].clientY);
  const onTouchEnd = () => { dragging = false; };

  return {
    connect() {
      canvas.addEventListener('mousedown', onMouseDown);
      windowLike.addEventListener('mouseup', onMouseUp);
      windowLike.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      windowLike.addEventListener('touchend', onTouchEnd);
      canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    },

    disconnect() {
      canvas.removeEventListener('mousedown', onMouseDown);
      windowLike.removeEventListener('mouseup', onMouseUp);
      windowLike.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      windowLike.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchmove', onTouchMove);
      body.classList.remove('dragging');
      dragging = false;
    },

    // autoSpeed intentionally remains a per-frame increment for compatibility
    // with the original renderer's authored motion rates.
    step({ autoSpeed, suppressAutoSpeed }) {
      if (!dragging) {
        velocityX *= damping;
        velocityY *= damping;
        rotationX += velocityX;
        rotationY += velocityY + (suppressAutoSpeed ? 0 : autoSpeed);
      }
      return { x: rotationX, y: rotationY };
    },
  };
}

/**
 * Compose pointer rotation, authored per-frame drift, and timed auto-rotation.
 *
 * The drag controller owns input and inertia. This controller owns how that
 * Euler state is applied to the scene group and then premultiplied by an
 * accumulated world-space diagonal tumble. Keeping the accumulated angle here
 * prevents UI speed changes from causing orientation jumps.
 */
export function createSphereRotationController({ THREE, group, dragController }) {
  if (!THREE || !group || !dragController) {
    throw new TypeError('THREE, group, and dragController are required');
  }
  const diagonalAxis = new THREE.Vector3(1, 1, 0).normalize();
  const spinQuaternion = new THREE.Quaternion();
  let autoRotationAngle = 0;

  return {
    step({ deltaTime, autoSpeed, enabled, rotationSpeed }) {
      // Explicit auto-rotation suppresses the palette's authored per-frame
      // drift; otherwise a slow UI speed would be overwhelmed by both motions.
      const dragRotation = dragController.step({
        autoSpeed,
        suppressAutoSpeed: enabled,
      });

      // Set all Euler components before applying the quaternion. Leaving the
      // previous Z value would feed last frame's tumble back into this frame.
      group.rotation.set(dragRotation.x, dragRotation.y, 0);
      if (enabled) autoRotationAngle += rotationSpeed * (deltaTime || 0);
      if (autoRotationAngle) {
        group.quaternion.premultiply(
          spinQuaternion.setFromAxisAngle(diagonalAxis, autoRotationAngle),
        );
      }
      return { angle: autoRotationAngle, dragRotation };
    },
  };
}
