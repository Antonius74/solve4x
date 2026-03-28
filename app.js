const MODE_2D = "2d";
const MODE_3D = "3d";

const presets = {
  "2d": [
    { expression: "sin(x)", xMin: -10, xMax: 10, resolution: 220, xScale: "linear", yScale: "linear" },
    {
      expression: "sin(4*x) * exp(-abs(x)/3)",
      xMin: -12,
      xMax: 12,
      resolution: 260,
      xScale: "linear",
      yScale: "linear",
    },
    { expression: "log(x)", xMin: 0.1, xMax: 30, resolution: 220, xScale: "log", yScale: "linear" },
    { expression: "x^3 - 4*x", xMin: -6, xMax: 6, resolution: 180, xScale: "linear", yScale: "linear" },
  ],
  "3d": [
    {
      expression: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)",
      xMin: -12,
      xMax: 12,
      yMin: -12,
      yMax: 12,
      resolution: 120,
      xScale: "linear",
      yScale: "linear",
      zScale: "linear",
      colorMap: "Viridis",
    },
    {
      expression: "x^2 - y^2",
      xMin: -6,
      xMax: 6,
      yMin: -6,
      yMax: 6,
      resolution: 110,
      xScale: "linear",
      yScale: "linear",
      zScale: "linear",
      colorMap: "Turbo",
    },
    {
      expression: "exp(-(x^2 + y^2)/8)",
      xMin: -8,
      xMax: 8,
      yMin: -8,
      yMax: 8,
      resolution: 130,
      xScale: "linear",
      yScale: "linear",
      zScale: "linear",
      colorMap: "Plasma",
    },
    {
      expression: "log(x + y + 4)",
      xMin: 0.1,
      xMax: 20,
      yMin: 0.1,
      yMax: 20,
      resolution: 110,
      xScale: "log",
      yScale: "log",
      zScale: "linear",
      colorMap: "Cividis",
    },
  ],
};

const refs = {
  modeSegment: document.getElementById("modeSegment"),
  expression: document.getElementById("expression"),
  expressionHint: document.getElementById("expressionHint"),
  xMin: document.getElementById("xMin"),
  xMax: document.getElementById("xMax"),
  yMin: document.getElementById("yMin"),
  yMax: document.getElementById("yMax"),
  yRangeGroup: document.getElementById("yRangeGroup"),
  resolution: document.getElementById("resolution"),
  xScale: document.getElementById("xScale"),
  yScale: document.getElementById("yScale"),
  zScale: document.getElementById("zScale"),
  colorMap: document.getElementById("colorMap"),
  colorGroup: document.getElementById("colorGroup"),
  plotBtn: document.getElementById("plotBtn"),
  resetBtn: document.getElementById("resetBtn"),
  presetBtn: document.getElementById("presetBtn"),
  plotTitle: document.getElementById("plotTitle"),
  plot: document.getElementById("plot"),
  message: document.getElementById("message"),
};

const initialState = {
  mode: MODE_2D,
  expression: "sin(x)",
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
  resolution: 160,
  xScale: "linear",
  yScale: "linear",
  zScale: "linear",
  colorMap: "Viridis",
};

let currentMode = initialState.mode;

function setMessage(text, type = "") {
  refs.message.className = "message";
  if (type) refs.message.classList.add(type);
  refs.message.textContent = text;
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function linspaceLinear(min, max, count) {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function linspaceLog(min, max, count) {
  if (min <= 0 || max <= 0) {
    throw new Error("La scala log richiede estremi > 0.");
  }
  if (count <= 1) return [min];
  const minLog = Math.log10(min);
  const maxLog = Math.log10(max);
  const step = (maxLog - minLog) / (count - 1);
  return Array.from({ length: count }, (_, i) => 10 ** (minLog + i * step));
}

function buildAxisValues(min, max, count, scaleType) {
  if (scaleType === "log") return linspaceLog(min, max, count);
  return linspaceLinear(min, max, count);
}

function toFiniteValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value && typeof value.re === "number" && typeof value.im === "number") {
    // For real-valued plots, keep only purely real values from complex results.
    if (Math.abs(value.im) > 1e-9) return null;
    return Number.isFinite(value.re) ? value.re : null;
  }
  return null;
}

function readInputs() {
  return {
    expression: refs.expression.value.trim(),
    xMin: safeNumber(refs.xMin.value, initialState.xMin),
    xMax: safeNumber(refs.xMax.value, initialState.xMax),
    yMin: safeNumber(refs.yMin.value, initialState.yMin),
    yMax: safeNumber(refs.yMax.value, initialState.yMax),
    resolution: Math.max(20, Math.min(500, Math.round(safeNumber(refs.resolution.value, initialState.resolution)))),
    xScale: refs.xScale.value,
    yScale: refs.yScale.value,
    zScale: refs.zScale.value,
    colorMap: refs.colorMap.value,
  };
}

function updateUiByMode(mode) {
  currentMode = mode;
  refs.modeSegment.querySelectorAll(".segment").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  const is3d = mode === MODE_3D;
  refs.yRangeGroup.style.display = is3d ? "block" : "none";
  refs.colorGroup.style.display = is3d ? "block" : "none";
  refs.zScale.style.display = is3d ? "block" : "none";
  refs.expression.placeholder = is3d ? "Esempio 3D: sin(sqrt(x^2+y^2))" : "Esempio 2D: sin(x) + x^2/10";
  refs.expressionHint.textContent = is3d ? "Usa x e y per i grafici 3D (z = f(x,y))." : "Usa x per i grafici 2D.";
  refs.plotTitle.textContent = is3d ? "Grafico 3D" : "Grafico 2D";
}

function applyState(state) {
  refs.expression.value = state.expression;
  refs.xMin.value = state.xMin;
  refs.xMax.value = state.xMax;
  refs.yMin.value = state.yMin;
  refs.yMax.value = state.yMax;
  refs.resolution.value = state.resolution;
  refs.xScale.value = state.xScale;
  refs.yScale.value = state.yScale;
  refs.zScale.value = state.zScale;
  refs.colorMap.value = state.colorMap;
}

function validateRanges(values, mode) {
  if (values.xMin >= values.xMax) {
    throw new Error("Intervallo x non valido: xMin deve essere minore di xMax.");
  }
  if (mode === MODE_3D && values.yMin >= values.yMax) {
    throw new Error("Intervallo y non valido: yMin deve essere minore di yMax.");
  }
}

function plot2D(values) {
  const x = buildAxisValues(values.xMin, values.xMax, values.resolution, values.xScale);
  const compiled = math.compile(values.expression);

  const y = x.map((xVal) => {
    try {
      return toFiniteValue(compiled.evaluate({ x: xVal }));
    } catch {
      return null;
    }
  });

  const trace = {
    x,
    y,
    type: "scattergl",
    mode: "lines",
    line: {
      color: "#0b57d0",
      width: 2.7,
      shape: "spline",
      smoothing: 1.1,
    },
    hovertemplate: "x=%{x:.6g}<br>y=%{y:.6g}<extra></extra>",
  };

  const layout = {
    margin: { l: 42, r: 20, t: 16, b: 42 },
    paper_bgcolor: "#fcfdff",
    plot_bgcolor: "#fcfdff",
    xaxis: { title: "x", type: values.xScale, gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
    yaxis: { title: "f(x)", type: values.yScale, gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
    dragmode: "pan",
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  return Plotly.react(refs.plot, [trace], layout, config);
}

function plot3D(values) {
  const xValues = buildAxisValues(values.xMin, values.xMax, values.resolution, values.xScale);
  const yValues = buildAxisValues(values.yMin, values.yMax, values.resolution, values.yScale);
  const compiled = math.compile(values.expression);

  const z = yValues.map((yVal) =>
    xValues.map((xVal) => {
      try {
        return toFiniteValue(compiled.evaluate({ x: xVal, y: yVal }));
      } catch {
        return null;
      }
    }),
  );

  const trace = {
    type: "surface",
    x: xValues,
    y: yValues,
    z,
    colorscale: values.colorMap,
    contours: {
      z: {
        show: true,
        usecolormap: true,
        highlightwidth: 1,
      },
    },
    hovertemplate: "x=%{x:.5g}<br>y=%{y:.5g}<br>z=%{z:.5g}<extra></extra>",
  };

  const layout = {
    margin: { l: 0, r: 0, t: 10, b: 0 },
    paper_bgcolor: "#fcfdff",
    scene: {
      xaxis: { title: "x", type: values.xScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      yaxis: { title: "y", type: values.yScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      zaxis: { title: "z", type: values.zScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      aspectmode: "cube",
      camera: { eye: { x: 1.6, y: 1.5, z: 0.95 } },
    },
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
  };

  return Plotly.react(refs.plot, [trace], layout, config);
}

async function renderPlot() {
  try {
    const values = readInputs();
    validateRanges(values, currentMode);
    if (!values.expression) throw new Error("Inserisci una funzione valida prima di plottare.");

    setMessage("Rendering in corso...", "ok");

    if (currentMode === MODE_3D) {
      await plot3D(values);
    } else {
      await plot2D(values);
    }

    setMessage("Grafico aggiornato.", "ok");
  } catch (error) {
    setMessage(error.message || "Errore durante il plotting.", "error");
  }
}

function resetAll() {
  updateUiByMode(MODE_2D);
  applyState(initialState);
  setMessage("");
  renderPlot();
}

function loadRandomPreset() {
  const options = presets[currentMode];
  const choice = options[Math.floor(Math.random() * options.length)];
  applyState({ ...initialState, ...choice });
  renderPlot();
}

refs.modeSegment.addEventListener("click", (event) => {
  const button = event.target.closest(".segment");
  if (!button) return;
  const selectedMode = button.dataset.mode === MODE_3D ? MODE_3D : MODE_2D;
  updateUiByMode(selectedMode);

  if (selectedMode === MODE_2D && refs.expression.value.includes("y")) {
    refs.expression.value = "sin(x)";
  }
  if (selectedMode === MODE_3D && !refs.expression.value.includes("y")) {
    refs.expression.value = "sin(sqrt(x^2+y^2))";
  }

  renderPlot();
});

refs.plotBtn.addEventListener("click", renderPlot);
refs.presetBtn.addEventListener("click", loadRandomPreset);
refs.resetBtn.addEventListener("click", resetAll);

refs.expression.addEventListener("keydown", (event) => {
  if (event.key === "Enter") renderPlot();
});

window.addEventListener("resize", () => Plotly.Plots.resize(refs.plot));

updateUiByMode(MODE_2D);
applyState(initialState);
renderPlot();
