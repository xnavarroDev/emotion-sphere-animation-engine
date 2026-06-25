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

  // Keep references so presets can sync the sliders.
  const sliders = {};
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
    sliders[key] = { input, val, step };
  }

  const syncSliders = () => {
    for (const [key, { input, val, step }] of Object.entries(sliders)) {
      input.value = field.params[key];
      val.textContent = (+input.value).toFixed(step < 1 ? 2 : 0);
    }
  };

  const presetBar = document.getElementById("presets");
  // The "sensor" look shared by every prototype (dark backdrop, blue additive glow).
  const SENSOR = {
    blendMode: "additive",
    background: [0, 0, 0, 1],
    color: [0.627, 0.792, 0.937],
  };
  const PRESETS = {
    // Original — calm, even blue nebula.
    "Black (sensor)": {
      ...SENSOR,
      brightness: 0.8,
      pointSize: 4.5,
      coreBias: 1.0,
      count: 30000,
    },
    // Prototype A — dense, hot core that fades to a soft rim.
    "Dense core": {
      ...SENSOR,
      count: 90000,
      coreBias: 2.8,
      edgeFeather: 0.32,
      pointSize: 3.0,
      sizeJitter: 0.8,
      glow: 8.5,
      brightness: 0.95,
    },
    // Prototype B — turbulent filaments, lots of independent drift.
    "Turbulent flow": {
      ...SENSOR,
      count: 60000,
      coreBias: 1.2,
      flowAmp: 0.34,
      flowFreq: 3.2,
      flowSpeed: 0.45,
      jitter: 0.1,
      jitterSpeed: 1.2,
      diffSwirl: 1.4,
      pointSize: 4.0,
      brightness: 0.85,
    },
    // Prototype C — large, slow, breathing sphere with big soft grains.
    "Slow breath": {
      ...SENSOR,
      count: 40000,
      scale: 0.85,
      coreBias: 0.9,
      breathAmp: 0.13,
      breathSpeed: 0.4,
      rotSpeed: 0.03,
      rotWander: 1.6,
      pointSize: 7.5,
      sizeJitter: 0.4,
      glow: 7.0,
      brightness: 0.75,
    },
  };
  for (const [name, preset] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = name;
    // Reset to defaults first so each prototype is reproducible regardless of
    // which preset (or slider tweaks) came before it.
    b.addEventListener("click", () => {
      field.setParams({ ...DEFAULTS, ...preset });
      syncSliders();
    });
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
