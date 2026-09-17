/**
 * Build the outer shell's Fibonacci-sphere buffers. The stable spiral avoids
 * latitude clustering while small radial and phase jitter keeps the rendered
 * border from reading as a rigid mathematical grid.
 */
export function createShellParticleState({ count, random = Math.random }) {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError('shell particle count must be an integer of at least 2');
  }
  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2;
    const horizontalRadius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const shellRadius = 0.97 + random() * 0.05;
    const offset = index * 3;
    positions[offset] = origins[offset] = horizontalRadius * Math.cos(theta) * shellRadius;
    positions[offset + 1] = origins[offset + 1] = y * shellRadius;
    positions[offset + 2] = origins[offset + 2] = horizontalRadius * Math.sin(theta) * shellRadius;
    phases[index] = random() * Math.PI * 2;
  }

  return { colors, origins, phases, positions };
}
