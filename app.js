import { ParticleField, DEFAULTS } from "./field.js";

const canvas = document.getElementById("stage");
const field = new ParticleField(canvas, DEFAULTS);

const state = {
  playing: true,
  time: 0,
  lastTs: 0,
  displayW: 0,
  displayH: 0,
};

function fitCanvas() {
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  state.displayW = w;
  state.displayH = h;
  field.resize(w, h, dpr);
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

function loop(ts) {
  if (state.playing) {
    if (!state.lastTs) state.lastTs = ts;
    state.time += (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    field.draw(state.time);
  } else {
    state.lastTs = ts;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------- UI ----------------
const controls = document.getElementById("controls");
if (controls) {
  const SLIDERS = [
    ["count", 5000, 120000, 1000],
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

  const mkRow = (label, el) => {
    const row = document.createElement("label");
    row.className = "row";
    const span = document.createElement("span");
    span.textContent = label;
    const val = document.createElement("em");
    row.append(span, el, val);
    return { row, val };
  };

  for (const [key, min, max, step] of SLIDERS) {
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
    });
    controls.appendChild(row);
  }

  const presetBar = document.getElementById("presets");
  const PRESETS = {
    "Black (sensor)": {
      blendMode: "additive",
      background: [0, 0, 0, 1],
      color: [0.627, 0.792, 0.937],
      brightness: 0.8,
      pointSize: 4.5,
      coreBias: 1.0,
      count: 30000,
    },
  };
  for (const [name, preset] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = name;
    b.addEventListener("click", () => field.setParams(preset));
    presetBar.appendChild(b);
  }

  document.getElementById("playToggle").addEventListener("click", (e) => {
    state.playing = !state.playing;
    state.lastTs = 0;
    e.target.textContent = state.playing ? "Pause" : "Play";
  });
  document.getElementById("savePng").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `quickstart_${Date.now()}.png`;
    a.click();
  });
}
