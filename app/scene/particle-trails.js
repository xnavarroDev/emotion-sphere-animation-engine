/**
 * Owns the fixed-size trail pool used by classic firefly particles.
 *
 * A ring buffer avoids allocations during animation, while a compact active
 * index keeps decay work proportional to visible trail dots. The caller owns
 * live particle motion; this system remembers only the previous positions
 * needed to decide when a particle has moved far enough to leave a trail.
 */
export function createParticleTrailSystem({
  THREE,
  group,
  texture,
  particleCount,
  initialPositions,
  poolSize = 2200,
  emitStep = 0.042,
  getLifetime,
  random = Math.random,
}) {
  if (!THREE || !group || !texture || typeof getLifetime !== 'function') {
    throw new TypeError('THREE, group, texture, and getLifetime are required');
  }

  const positions = new Float32Array(poolSize * 3);
  const colors = new Float32Array(poolSize * 3);
  const baseColors = new Float32Array(poolSize * 3);
  const velocities = new Float32Array(poolSize * 3);
  const ages = new Float32Array(poolSize);
  const alive = new Uint8Array(poolSize);
  const active = new Uint32Array(poolSize);
  const previous = new Float32Array(particleCount * 3);
  previous.set(initialPositions);
  let activeCount = 0;
  let head = 0;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.11,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 6;
  points.frustumCulled = false;
  group.add(points);

  function resetPrevious(index) {
    const offset = index * 3;
    previous[offset] = previous[offset + 1] = previous[offset + 2] = 0;
  }

  function update({ deltaTime, particlePositions, particleColors, visibility }) {
    const lifetime = getLifetime();
    for (let index = 0; index < particleCount; index += 1) {
      const visible = visibility[index];
      if (visible < 0.05) continue;
      const offset = index * 3;
      const x = particlePositions[offset];
      const y = particlePositions[offset + 1];
      const z = particlePositions[offset + 2];
      const dx = x - previous[offset];
      const dy = y - previous[offset + 1];
      const dz = z - previous[offset + 2];
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < emitStep) continue;

      // Disabling trails still synchronizes the baseline; reenabling them must
      // not draw one long segment from a stale historical position.
      if (lifetime < 0.05) {
        previous[offset] = x; previous[offset + 1] = y; previous[offset + 2] = z;
        continue;
      }

      const slot = head++ % poolSize;
      const trailOffset = slot * 3;
      const jitter = 0.042;
      positions[trailOffset] = x + (random() - 0.5) * jitter;
      positions[trailOffset + 1] = y + (random() - 0.5) * jitter;
      positions[trailOffset + 2] = z + (random() - 0.5) * jitter;
      velocities[trailOffset] = dx * 0.4 + (random() - 0.5) * 0.028;
      velocities[trailOffset + 1] = dy * 0.4 + (random() - 0.5) * 0.028 + 0.012;
      velocities[trailOffset + 2] = dz * 0.4 + (random() - 0.5) * 0.028;
      for (let channel = 0; channel < 3; channel += 1) {
        const color = particleColors[offset + channel] * visible;
        baseColors[trailOffset + channel] = color;
        colors[trailOffset + channel] = color;
      }
      ages[slot] = lifetime;
      if (!alive[slot]) {
        alive[slot] = 1;
        active[activeCount++] = slot;
      }
      previous[offset] = x; previous[offset + 1] = y; previous[offset + 2] = z;
    }

    // Swap-removal keeps the active list dense without preserving an order
    // that has no visual meaning.
    for (let activeIndex = activeCount - 1; activeIndex >= 0; activeIndex -= 1) {
      const slot = active[activeIndex];
      const trailOffset = slot * 3;
      const age = ages[slot] - deltaTime;
      if (age <= 0) {
        ages[slot] = 0;
        alive[slot] = 0;
        positions[trailOffset] = positions[trailOffset + 1] = positions[trailOffset + 2] = 0;
        colors[trailOffset] = colors[trailOffset + 1] = colors[trailOffset + 2] = 0;
        active[activeIndex] = active[--activeCount];
        continue;
      }
      ages[slot] = age;
      positions[trailOffset] += velocities[trailOffset] * deltaTime;
      positions[trailOffset + 1] += velocities[trailOffset + 1] * deltaTime;
      positions[trailOffset + 2] += velocities[trailOffset + 2] * deltaTime;
      velocities[trailOffset] *= 0.985;
      velocities[trailOffset + 1] *= 0.985;
      velocities[trailOffset + 2] *= 0.985;
      const fade = Math.pow(Math.min(1, age / lifetime), 1.5);
      colors[trailOffset] = baseColors[trailOffset] * fade;
      colors[trailOffset + 1] = baseColors[trailOffset + 1] * fade;
      colors[trailOffset + 2] = baseColors[trailOffset + 2] * fade;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  return { points, resetPrevious, update };
}
