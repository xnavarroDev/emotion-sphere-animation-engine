/** Small normalized-RGB helpers used by scene, preset, and UI adapters. */
export function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export function rgbToHex(colour) {
  return `#${[0, 1, 2].map(index => Math.round(
    Math.max(0, Math.min(1, colour[index] || 0)) * 255,
  ).toString(16).padStart(2, '0')).join('')}`;
}

export function mixHex(from, to, fraction) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  return rgbToHex(start.map((value, index) => value + (end[index] - value) * fraction));
}
