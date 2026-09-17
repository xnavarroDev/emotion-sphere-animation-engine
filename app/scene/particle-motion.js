/**
 * Pure motion primitives shared by the legacy particle integration loop.
 *
 * Keeping these calculations free of geometry buffers makes their authored
 * frequencies and amplitudes easy to verify without advancing the renderer.
 */
export const FLAT_SPHERE_BREATH = Object.freeze({
  breath: 0.5,
  swell: 0,
  scale: 1,
  disperse: 0,
  innerScale: 1,
});

/** Authored amplitudes for the two legacy particle clouds. */
export const PARTICLE_SWIRL = Object.freeze({
  shellTangential: 0.14,
  shellInward: 0.32,
  innerTangential: 0.1,
  innerInward: 0.4,
});

/**
 * Calculate a particle's coiling displacement toward the sphere center.
 *
 * The input origin remains untouched. Returning a small value object keeps
 * buffer mutation in the renderer loop while this geometry stays unit-testable.
 */
export function inwardSwirl(time, phase, originX, originY, originZ, radius, tangentialAmount, inwardAmount) {
  const inverseRadius = 1 / (radius || 1);
  const normalX = originX * inverseRadius;
  const normalY = originY * inverseRadius;
  const normalZ = originZ * inverseRadius;

  let tangentX = normalY * 0.55 - normalZ * 0.35;
  let tangentY = normalZ * 0.5 - normalX * 0.4;
  let tangentZ = normalX * 0.45 - normalY * 0.5;
  // Keep the original square-root calculation so extraction does not alter
  // floating-point rounding in the animation's existing render path.
  const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ) || 1;
  tangentX /= tangentLength;
  tangentY /= tangentLength;
  tangentZ /= tangentLength;

  let binormalX = normalY * tangentZ - normalZ * tangentY;
  let binormalY = normalZ * tangentX - normalX * tangentZ;
  let binormalZ = normalX * tangentY - normalY * tangentX;
  const binormalLength = Math.sqrt(
    binormalX * binormalX + binormalY * binormalY + binormalZ * binormalZ,
  ) || 1;
  binormalX /= binormalLength;
  binormalY /= binormalLength;
  binormalZ /= binormalLength;

  const edge = Math.min(1, Math.max(0.42, radius * 0.95));
  const angle = time * 1.35 + phase * 2.4 + (1.05 - radius) * time * 0.55;
  const coil = Math.sin(angle * 1.35 - radius * 2.4) * 0.5 + 0.5;
  const pull = inwardAmount * (0.55 + 0.45 * coil);
  const spin = tangentialAmount * radius * edge * (1.1 + 0.25 * Math.sin(time * 0.42 + phase));
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotatedX = normalX * cosine - normalZ * sine * 0.35;
  const rotatedY = normalY * cosine + normalX * sine * 0.2;
  const rotatedZ = normalZ * cosine + normalX * sine * 0.35;

  return {
    dx: (tangentX * cosine + binormalX * sine) * spin + (rotatedX - normalX) * radius * pull * 0.35,
    dy: (tangentY * cosine + binormalY * sine) * spin + (rotatedY - normalY) * radius * pull * 0.35,
    dz: (tangentZ * cosine + binormalZ * sine) * spin + (rotatedZ - normalZ) * radius * pull * 0.35,
    radScale: Math.max(0.42, 1 - pull),
  };
}

export function innerJitter(time, phase, x, y, z, amount) {
  const a = Math.sin(time * 1.6 + phase * 2.3 + y * 3.4);
  const b = Math.sin(time * 2.1 + x * 4.2 + phase * 1.7);
  const c = Math.cos(time * 1.9 + z * 3.8 + phase * 0.9);
  const d = Math.sin(time * 3.4 + phase * 3.1 + x * z * 5);
  const e = Math.cos(time * 2.7 + y * 5.1 + phase * 2.5);
  return {
    x: (a * b + d * 0.5) * amount,
    y: (c * a + e * 0.45) * amount,
    z: (b * c + d * 0.55) * amount,
  };
}
