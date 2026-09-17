/**
 * Allocate the mutable CPU buffers for the classic inner-particle renderer.
 * Respawns reuse `rollParticle`, ensuring newborn particles honor the current
 * core-bias setting instead of the value that happened to exist at boot.
 */
export function createClassicParticleState({
  count,
  getCoreBias,
  random = Math.random,
}) {
  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const axes = new Float32Array(count * 3);
  const births = new Float32Array(count);
  const visibility = new Float32Array(count);
  const sequenceTint = new Uint8Array(count);
  const sizes = new Float32Array(count);

  function rollParticle(index) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = Math.pow(random(), getCoreBias()) * 0.75;
    const offset = index * 3;
    positions[offset] = origins[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = origins[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[offset + 2] = origins[offset + 2] = radius * Math.cos(phi);

    // Build a normalized tangent axis from the radial direction and a random
    // vector. The integrator uses it as the particle's stable wobble axis.
    const nx = origins[offset];
    const ny = origins[offset + 1];
    const nz = origins[offset + 2];
    const inverseLength = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    const ux = nx * inverseLength;
    const uy = ny * inverseLength;
    const uz = nz * inverseLength;
    const rx = random() * 2 - 1;
    const ry = random() * 2 - 1;
    const rz = random() * 2 - 1;
    let ax = uy * rz - uz * ry;
    let ay = uz * rx - ux * rz;
    let az = ux * ry - uy * rx;
    const axisLength = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= axisLength;
    ay /= axisLength;
    az /= axisLength;
    axes[offset] = ax;
    axes[offset + 1] = ay;
    axes[offset + 2] = az;
  }

  for (let index = 0; index < count; index += 1) {
    const tintNoise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
    sequenceTint[index] = tintNoise < 0.2 ? 2 : (tintNoise < 0.5 ? 1 : 0);
    rollParticle(index);
    phases[index] = random() * Math.PI * 2;
    births[index] = -1;
    visibility[index] = 1;
    sizes[index] = 1;
  }

  return {
    axes,
    births,
    colors,
    origins,
    phases,
    positions,
    rollParticle,
    sequenceTint,
    sizes,
    visibility,
  };
}
