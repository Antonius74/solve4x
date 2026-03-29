const MODE_2D = "2d";
const MODE_3D = "3d";

const RESERVED_IDENTIFIERS = new Set([
  "e",
  "E",
  "pi",
  "PI",
  "tau",
  "phi",
  "i",
  "Infinity",
  "NaN",
  "true",
  "false",
  "null",
  "undefined",
]);

const presets = [
  {
    expression: "sin(x)",
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    resolution: 220,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Viridis",
    params: {},
  },
  {
    expression: "z = x^2 + y^2",
    xMin: -8,
    xMax: 8,
    yMin: -8,
    yMax: 8,
    resolution: 120,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Turbo",
    params: {},
  },
  {
    expression: "a * sin(b * x) * exp(-abs(x)/c)",
    xMin: -14,
    xMax: 14,
    yMin: -10,
    yMax: 10,
    resolution: 260,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Viridis",
    params: { a: 1, b: 4, c: 3 },
  },
  {
    expression: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + k)",
    xMin: -12,
    xMax: 12,
    yMin: -12,
    yMax: 12,
    resolution: 120,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Plasma",
    params: { k: 0.1 },
  },
  {
    expression: "log(x)",
    xMin: 0.1,
    xMax: 30,
    yMin: -10,
    yMax: 10,
    resolution: 240,
    xScale: "log",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Cividis",
    params: {},
  },
];

const LINE_COLORS = ["#0b57d0", "#e07a16", "#188038", "#b3261e", "#7b1fa2", "#006c73", "#7f5539", "#37474f"];
const SURFACE_COLOR_SCALES = ["Viridis", "Turbo", "Plasma", "Inferno", "Cividis", "Electric"];

const refs = {
  expression: document.getElementById("expression"),
  expressionLatex: document.getElementById("expressionLatex"),
  expressionHint: document.getElementById("expressionHint"),
  detectedMode: document.getElementById("detectedMode"),
  xRangeLabel: document.getElementById("xRangeLabel"),
  yRangeLabel: document.getElementById("yRangeLabel"),
  xMin: document.getElementById("xMin"),
  xMax: document.getElementById("xMax"),
  yMin: document.getElementById("yMin"),
  yMax: document.getElementById("yMax"),
  yRangeGroup: document.getElementById("yRangeGroup"),
  paramGroup: document.getElementById("paramGroup"),
  paramInputs: document.getElementById("paramInputs"),
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

let expressionDebounceId;
let currentInference = null;
const parameterValues = {};

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
    throw new Error("La scala log richiede limiti maggiori di zero.");
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

function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (value && typeof value.toNumber === "function") {
    const asNumber = value.toNumber();
    return Number.isFinite(asNumber) ? asNumber : null;
  }

  if (value && typeof value.re === "number" && typeof value.im === "number") {
    if (Math.abs(value.im) > 1e-9) return null;
    return Number.isFinite(value.re) ? value.re : null;
  }

  return null;
}

function normalizeExpressionInput(rawInput) {
  const normalized = rawInput
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/;+$/g, "");

  if (!normalized) throw new Error("Inserisci una funzione valida.");

  const eqIndex = normalized.indexOf("=");
  if (eqIndex >= 0) {
    const lhs = normalized.slice(0, eqIndex).trim().toLowerCase();
    const rhs = normalized.slice(eqIndex + 1).trim();
    if (!rhs) throw new Error("Manca il termine a destra del segno '='.");
    return { formula: rhs, lhs };
  }

  return { formula: normalized, lhs: "" };
}

function splitExpressions(rawInput) {
  return String(rawInput || "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderLatexPreview(rawExpression) {
  if (!refs.expressionLatex) return;

  const expressions = splitExpressions(rawExpression);
  refs.expressionLatex.innerHTML = "";

  if (!expressions.length) {
    refs.expressionLatex.classList.remove("invalid");
    refs.expressionLatex.textContent = "f(x)";
    return;
  }

  if (!window.katex || typeof window.katex.render !== "function" || !window.math) {
    refs.expressionLatex.classList.add("invalid");
    refs.expressionLatex.textContent = expressions.join(" ; ");
    return;
  }

  refs.expressionLatex.classList.remove("invalid");

  expressions.forEach((expression, index) => {
    const line = document.createElement("div");
    line.className = "latex-line";

    try {
      const normalized = normalizeExpressionInput(expression);
      const parsed = math.parse(normalized.formula);
      const texBody = parsed.toTex({ parenthesis: "auto", implicit: "show" });
      const fullTex = normalized.lhs ? `${normalized.lhs} = ${texBody}` : texBody;

      window.katex.render(fullTex, line, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
    } catch {
      line.classList.add("latex-line-invalid");
      line.textContent = expression;
    }

    if (index > 0) line.classList.add("latex-line-secondary");
    refs.expressionLatex.appendChild(line);
  });

  if ([...refs.expressionLatex.querySelectorAll(".latex-line-invalid")].length > 0) {
    refs.expressionLatex.classList.add("invalid");
  }
}

function collectVariableNames(parsed) {
  const symbols = new Set();
  const calledFunctions = new Set();

  parsed.traverse((node) => {
    if (node && node.isSymbolNode) {
      symbols.add(node.name);
    }

    if (node && node.isFunctionNode && node.fn && node.fn.isSymbolNode) {
      calledFunctions.add(node.fn.name);
    }
  });

  return [...symbols]
    .filter((name) => !calledFunctions.has(name))
    .filter((name) => !RESERVED_IDENTIFIERS.has(name))
    .sort((a, b) => {
      const priority = (name) => {
        if (name === "x") return 0;
        if (name === "y") return 1;
        return 9;
      };
      return priority(a) - priority(b) || a.localeCompare(b);
    });
}

function inferAxes(variableNames) {
  if (variableNames.length === 0) {
    return { mode: MODE_2D, axisVars: ["x"] };
  }

  if (variableNames.length === 1) {
    return { mode: MODE_2D, axisVars: [variableNames[0]] };
  }

  const first = variableNames.includes("x") ? "x" : variableNames[0];
  const second = first !== "y" && variableNames.includes("y") ? "y" : variableNames.find((name) => name !== first);

  return { mode: MODE_3D, axisVars: [first, second] };
}

function inferFromExpression(expressionInput) {
  const normalized = normalizeExpressionInput(expressionInput);

  let parsed;
  try {
    parsed = math.parse(normalized.formula);
  } catch (error) {
    throw new Error(`Sintassi non valida: ${error.message}`);
  }

  const variables = collectVariableNames(parsed);
  const axisInfo = inferAxes(variables);
  const axisVars = axisInfo.axisVars.filter(Boolean);

  const parameterVars = variables.filter((name) => !axisVars.includes(name));

  return {
    formula: normalized.formula,
    lhs: normalized.lhs,
    variables,
    mode: axisInfo.mode,
    axisVars,
    parameterVars,
    compiled: math.compile(normalized.formula),
  };
}

function inferMultipleExpressions(rawExpressionInput) {
  const expressions = splitExpressions(rawExpressionInput);
  if (!expressions.length) {
    throw new Error("Inserisci almeno una funzione.");
  }

  const functions = expressions.map((expression) => {
    const inferred = inferFromExpression(expression);
    return { ...inferred, originalExpression: expression };
  });

  const mode = functions[0].mode;
  const mixedMode = functions.some((item) => item.mode !== mode);
  if (mixedMode) {
    throw new Error("Non puoi mescolare funzioni 2D e 3D nello stesso grafico.");
  }

  const parameterVarsSet = new Set();
  functions.forEach((item) => {
    item.parameterVars.forEach((name) => parameterVarsSet.add(name));
  });

  return {
    mode,
    axisVars: functions[0].axisVars,
    parameterVars: [...parameterVarsSet].sort((a, b) => a.localeCompare(b)),
    functions,
    functionCount: functions.length,
  };
}

function readInputs() {
  return {
    expression: refs.expression.value.trim(),
    xMin: safeNumber(refs.xMin.value, initialState.xMin),
    xMax: safeNumber(refs.xMax.value, initialState.xMax),
    yMin: safeNumber(refs.yMin.value, initialState.yMin),
    yMax: safeNumber(refs.yMax.value, initialState.yMax),
    resolution: Math.max(20, Math.min(420, Math.round(safeNumber(refs.resolution.value, initialState.resolution)))),
    xScale: refs.xScale.value,
    yScale: refs.yScale.value,
    zScale: refs.zScale.value,
    colorMap: refs.colorMap.value,
  };
}

function setScaleSelectText(select, label) {
  if (!select || !select.options || select.options.length < 2) return;
  select.options[0].textContent = `${label} lineare`;
  select.options[1].textContent = `${label} log`;
}

function updateUiFromInference(inference) {
  const axisA = inference.axisVars[0] || "x";
  const axisB = inference.axisVars[1] || "y";

  refs.xRangeLabel.textContent = `Intervallo ${axisA}`;
  refs.yRangeLabel.textContent = `Intervallo ${axisB}`;
  refs.yRangeGroup.style.display = inference.mode === MODE_3D ? "block" : "none";
  refs.colorGroup.style.display = inference.mode === MODE_3D ? "block" : "none";
  refs.zScale.style.display = inference.mode === MODE_3D ? "block" : "none";
  refs.plotTitle.textContent = inference.mode === MODE_3D ? "Grafico 3D" : "Grafico 2D";

  const modeText =
    inference.mode === MODE_3D ? `3D | z = f(${axisA}, ${axisB})` : `2D | f(${axisA})`;
  const functionText = inference.functionCount > 1 ? `${inference.functionCount} funzioni` : "1 funzione";

  refs.detectedMode.textContent = modeText;
  refs.expressionHint.textContent =
    inference.parameterVars.length > 0
      ? `${functionText}. Variabili extra: ${inference.parameterVars.join(", ")} (parametri condivisi).`
      : `${functionText}. Nessun parametro extra: plotting diretto.`;

  setScaleSelectText(refs.xScale, axisA);
  if (inference.mode === MODE_3D) {
    setScaleSelectText(refs.yScale, axisB);
    setScaleSelectText(refs.zScale, "z");
  } else {
    setScaleSelectText(refs.yScale, `f(${axisA})`);
  }
}

function buildParameterScope(parameterVars) {
  const scope = {};
  parameterVars.forEach((name) => {
    const value = safeNumber(parameterValues[name], 1);
    parameterValues[name] = value;
    scope[name] = value;
  });
  return scope;
}

function renderParameterInputs(parameterVars) {
  if (!parameterVars.length) {
    refs.paramGroup.style.display = "none";
    refs.paramInputs.innerHTML = "";
    return;
  }

  refs.paramGroup.style.display = "block";
  refs.paramInputs.innerHTML = "";

  parameterVars.forEach((name) => {
    if (!(name in parameterValues)) {
      parameterValues[name] = 1;
    }

    const row = document.createElement("div");
    row.className = "param-row";

    const label = document.createElement("label");
    label.className = "param-name";
    label.htmlFor = `param-${name}`;
    label.textContent = name;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.id = `param-${name}`;
    input.className = "input";
    input.value = String(parameterValues[name]);

    input.addEventListener("input", () => {
      parameterValues[name] = safeNumber(input.value, 1);
    });

    input.addEventListener("change", () => {
      parameterValues[name] = safeNumber(input.value, 1);
      renderPlot();
    });

    row.appendChild(label);
    row.appendChild(input);
    refs.paramInputs.appendChild(row);
  });
}

function validateRanges(values, inference) {
  if (values.xMin >= values.xMax) {
    throw new Error(`${inference.axisVars[0]}: il minimo deve essere minore del massimo.`);
  }

  if (values.xScale === "log" && values.xMin <= 0) {
    throw new Error(`Scala log su ${inference.axisVars[0]}: il minimo deve essere > 0.`);
  }

  if (inference.mode === MODE_3D) {
    if (values.yMin >= values.yMax) {
      throw new Error(`${inference.axisVars[1]}: il minimo deve essere minore del massimo.`);
    }

    if (values.yScale === "log" && values.yMin <= 0) {
      throw new Error(`Scala log su ${inference.axisVars[1]}: il minimo deve essere > 0.`);
    }
  }
}

function plot2D(values, inference) {
  const axis = inference.axisVars[0] || "x";
  const xValues = buildAxisValues(values.xMin, values.xMax, values.resolution, values.xScale);
  const baseScope = buildParameterScope(inference.parameterVars);

  const traces = inference.functions
    .map((fn, index) => {
      const fnAxis = fn.axisVars[0] || axis;
      let validCount = 0;
      let positiveCount = 0;

      const yValues = xValues.map((axisValue) => {
        try {
          const evaluated = toFiniteNumber(fn.compiled.evaluate({ ...baseScope, [fnAxis]: axisValue }));
          if (evaluated === null) return null;
          validCount += 1;

          if (values.yScale === "log") {
            if (evaluated > 0) {
              positiveCount += 1;
              return evaluated;
            }
            return null;
          }

          return evaluated;
        } catch {
          return null;
        }
      });

      if (validCount === 0) return null;
      if (values.yScale === "log" && positiveCount === 0) return null;

      return {
        x: xValues,
        y: yValues,
        type: "scattergl",
        mode: "lines",
        name: fn.originalExpression,
        line: {
          color: LINE_COLORS[index % LINE_COLORS.length],
          width: 2.8,
          shape: "spline",
          smoothing: 1.05,
        },
        hovertemplate: `${fn.originalExpression}<br>${axis}=%{x:.6g}<br>f=%{y:.6g}<extra></extra>`,
      };
    })
    .filter(Boolean);

  if (!traces.length) {
    throw new Error("Nessun valore numerico valido in 2D. Controlla funzione/intervallo.");
  }

  const layout = {
    margin: { l: 46, r: 20, t: 14, b: 44 },
    paper_bgcolor: "#fcfdff",
    plot_bgcolor: "#fcfdff",
    uirevision: "keep-view",
    dragmode: "zoom",
    showlegend: inference.functionCount > 1,
    legend: { orientation: "h", x: 0, y: 1.14 },
    xaxis: { title: axis, type: values.xScale, gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
    yaxis: { title: `f(${axis})`, type: values.yScale, gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
  };

  const config = {
    responsive: true,
    displaylogo: false,
    displayModeBar: true,
    scrollZoom: true,
    doubleClick: "reset+autosize",
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  return Plotly.react(refs.plot, traces, layout, config);
}

function plot3D(values, inference) {
  const xAxis = inference.axisVars[0];
  const yAxis = inference.axisVars[1];

  const xValues = buildAxisValues(values.xMin, values.xMax, values.resolution, values.xScale);
  const yValues = buildAxisValues(values.yMin, values.yMax, values.resolution, values.yScale);
  const baseScope = buildParameterScope(inference.parameterVars);

  const availableColorScales = [values.colorMap, ...SURFACE_COLOR_SCALES.filter((name) => name !== values.colorMap)];
  const traces = inference.functions
    .map((fn, index) => {
      const fnXAxis = fn.axisVars[0] || xAxis;
      const fnYAxis = fn.axisVars[1] || yAxis;
      let validCount = 0;
      let positiveCount = 0;

      const zValues = yValues.map((yValue) =>
        xValues.map((xValue) => {
          try {
            const evaluated = toFiniteNumber(fn.compiled.evaluate({ ...baseScope, [fnXAxis]: xValue, [fnYAxis]: yValue }));
            if (evaluated === null) return Number.NaN;
            validCount += 1;

            if (values.zScale === "log") {
              if (evaluated > 0) {
                positiveCount += 1;
                return evaluated;
              }
              return Number.NaN;
            }

            return evaluated;
          } catch {
            return Number.NaN;
          }
        }),
      );

      if (validCount === 0) return null;
      if (values.zScale === "log" && positiveCount === 0) return null;

      return {
        type: "surface",
        x: xValues,
        y: yValues,
        z: zValues,
        name: fn.originalExpression,
        colorscale: availableColorScales[index % availableColorScales.length],
        opacity: inference.functionCount > 1 ? 0.82 : 1,
        showscale: index === 0,
        connectgaps: false,
        hovertemplate: `${fn.originalExpression}<br>${xAxis}=%{x:.6g}<br>${yAxis}=%{y:.6g}<br>z=%{z:.6g}<extra></extra>`,
      };
    })
    .filter(Boolean);

  if (!traces.length) {
    throw new Error("Nessun valore numerico valido in 3D. Controlla funzione/intervallo.");
  }

  const layout = {
    margin: { l: 0, r: 0, t: 8, b: 0 },
    paper_bgcolor: "#fcfdff",
    uirevision: "keep-view",
    showlegend: inference.functionCount > 1,
    scene: {
      dragmode: "orbit",
      xaxis: { title: xAxis, type: values.xScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      yaxis: { title: yAxis, type: values.yScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      zaxis: { title: "z", type: values.zScale, backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
      aspectmode: "cube",
      camera: { eye: { x: 1.6, y: 1.45, z: 0.95 } },
    },
  };

  const config = {
    responsive: true,
    displaylogo: false,
    displayModeBar: true,
    scrollZoom: true,
    doubleClick: "reset",
  };

  return Plotly.react(refs.plot, traces, layout, config);
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

function previewInference() {
  renderLatexPreview(refs.expression.value);
  try {
    const inference = inferMultipleExpressions(refs.expression.value);
    currentInference = inference;
    updateUiFromInference(inference);
    renderParameterInputs(inference.parameterVars);
  } catch {
    // Ignore transient syntax errors while typing.
  }
}

async function renderPlot() {
  try {
    const values = readInputs();
    const inference = inferMultipleExpressions(values.expression);
    currentInference = inference;

    updateUiFromInference(inference);
    renderParameterInputs(inference.parameterVars);
    validateRanges(values, inference);

    setMessage("Rendering in corso...", "ok");

    if (inference.mode === MODE_3D) {
      await plot3D(values, inference);
      setMessage(
        `Grafico 3D aggiornato (${inference.functionCount} funzioni su assi ${inference.axisVars[0]}, ${inference.axisVars[1]}).`,
        "ok",
      );
    } else {
      await plot2D(values, inference);
      setMessage(`Grafico 2D aggiornato (${inference.functionCount} funzioni su asse ${inference.axisVars[0]}).`, "ok");
    }
  } catch (error) {
    setMessage(error.message || "Errore durante il plotting.", "error");
  }
}

function resetAll() {
  Object.keys(parameterValues).forEach((key) => {
    delete parameterValues[key];
  });

  applyState(initialState);
  setMessage("");
  previewInference();
  renderPlot();
}

function loadRandomPreset() {
  const choice = presets[Math.floor(Math.random() * presets.length)];

  applyState({
    expression: choice.expression,
    xMin: choice.xMin,
    xMax: choice.xMax,
    yMin: choice.yMin,
    yMax: choice.yMax,
    resolution: choice.resolution,
    xScale: choice.xScale,
    yScale: choice.yScale,
    zScale: choice.zScale,
    colorMap: choice.colorMap,
  });

  Object.keys(parameterValues).forEach((key) => {
    delete parameterValues[key];
  });

  Object.entries(choice.params || {}).forEach(([name, value]) => {
    parameterValues[name] = value;
  });

  previewInference();
  renderPlot();
}

refs.plotBtn.addEventListener("click", renderPlot);
refs.presetBtn.addEventListener("click", loadRandomPreset);
refs.resetBtn.addEventListener("click", resetAll);

refs.expression.addEventListener("keydown", (event) => {
  if (event.key === "Enter") renderPlot();
});

refs.expression.addEventListener("input", () => {
  clearTimeout(expressionDebounceId);
  expressionDebounceId = setTimeout(previewInference, 180);
});

window.addEventListener("resize", () => {
  if (!refs.plot || !refs.plot.data) return;
  Plotly.Plots.resize(refs.plot);
});

applyState(initialState);
previewInference();
renderPlot();
