export const SLIDER_DEFS = [
  ["count", 0, 120000, 1000],
  ["scale", 0.2, 0.95, 0.01],
  ["coreBias", 0.5, 3.5, 0.05],
  ["edgeFeather", 0.0, 0.6, 0.01],
  ["flowAmp", 0.0, 0.5, 0.005],
  ["flowFreq", 0.3, 5.0, 0.05],
  ["flowSpeed", 0.0, 1.0, 0.01],
  ["jitter", 0.0, 0.15, 0.005],
  ["jitterSpeed", 0.0, 2.0, 0.05],
  ["rotSpeed", -0.6, 0.6, 0.01],
  ["rotWander", 0.0, 2.5, 0.05],
  ["rotWanderFreq", 0.0, 0.5, 0.01],
  ["diffSwirl", 0.0, 2.0, 0.05],
  ["breathAmp", 0.0, 0.2, 0.005],
  ["breathSpeed", 0.0, 3.0, 0.05],
  ["pointSize", 1.0, 12.0, 0.5],
  ["sizeJitter", 0.0, 1.0, 0.05],
  ["glow", 1.0, 10.0, 0.1],
  ["brightness", 0.1, 1.6, 0.02],
  ["seed", 1, 200, 1],
];

export function attachParticleControls(field, root, { onChange } = {}) {
  if (!root) return;

  const mkRow = (label, el) => {
    const row = document.createElement("label");
    row.className = "row";
    const span = document.createElement("span");
    span.textContent = label;
    const val = document.createElement("em");
    row.append(span, el, val);
    return { row, val };
  };

  for (const [key, min, max, step] of SLIDER_DEFS) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = field.params[key];
    const { row, val } = mkRow(key, input);
    val.textContent = (+input.value).toFixed(step < 1 ? 2 : 0);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      val.textContent = v.toFixed(step < 1 ? 2 : 0);
      field.setParams({ [key]: v });
      onChange?.({ [key]: v });
    });
    root.appendChild(row);
  }
}
