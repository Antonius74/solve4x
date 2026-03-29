const MODE_2D = "2d";
const MODE_3D = "3d";
const TAB_FUNCTIONS = "functions";
const TAB_LINEAR = "linear";

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

const LINE_COLORS = ["#0b57d0", "#e07a16", "#188038", "#b3261e", "#7b1fa2", "#006c73", "#7f5539", "#37474f"];
const SURFACE_COLOR_SCALES = ["Viridis", "Turbo", "Plasma", "Inferno", "Cividis", "Electric"];

const presets = [
  {
    expressions: ["sin(x)"],
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    resolution: 120,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Viridis",
    params: {},
  },
  {
    expressions: ["sin(x)", "0.5*cos(2*x)", "x^2/20"],
    xMin: -12,
    xMax: 12,
    yMin: -10,
    yMax: 10,
    resolution: 120,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Viridis",
    params: {},
  },
  {
    expressions: ["z = x^2 + y^2"],
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
    expressions: ["sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + k)", "0.2*(x^2-y^2)"],
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    resolution: 130,
    xScale: "linear",
    yScale: "linear",
    zScale: "linear",
    colorMap: "Plasma",
    params: { k: 0.1 },
  },
];

const linearExamples = {
  2: {
    matrixA: "1 2; 0 1",
    vectorV: "1, 1",
    vectorB: "2, 1",
  },
  3: {
    matrixA: "1 0 1; 0 2 0; 0 0 1",
    vectorV: "1, 1, 1",
    vectorB: "2, 1, 3",
  },
};

const refs = {
  mainTabs: document.getElementById("mainTabs"),
  functionsTab: document.getElementById("functionsTab"),
  linearTab: document.getElementById("linearTab"),

  presetBtn: document.getElementById("presetBtn"),

  functionList: document.getElementById("functionList"),
  addFunctionBtn: document.getElementById("addFunctionBtn"),
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

  resolutionGroup: document.getElementById("resolutionGroup"),
  resolutionLabel: document.getElementById("resolutionLabel"),
  resolutionHint: document.getElementById("resolutionHint"),
  resolution: document.getElementById("resolution"),

  xScale: document.getElementById("xScale"),
  yScale: document.getElementById("yScale"),
  zScale: document.getElementById("zScale"),
  colorMap: document.getElementById("colorMap"),
  colorGroup: document.getElementById("colorGroup"),

  plotBtn: document.getElementById("plotBtn"),
  resetBtn: document.getElementById("resetBtn"),

  plotTitle: document.getElementById("plotTitle"),
  plot: document.getElementById("plot"),
  message: document.getElementById("message"),

  laDimension: document.getElementById("laDimension"),
  laMatrixA: document.getElementById("laMatrixA"),
  laVectorV: document.getElementById("laVectorV"),
  laVectorB: document.getElementById("laVectorB"),
  laApplyBtn: document.getElementById("laApplyBtn"),
  laExampleBtn: document.getElementById("laExampleBtn"),
  laResetBtn: document.getElementById("laResetBtn"),
  laPlot: document.getElementById("linearPlot"),
  laOutput: document.getElementById("linearOutput"),
  laMessage: document.getElementById("laMessage"),
};

const initialFunctionState = {
  expressions: ["sin(x)"],
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
  resolution: 120,
  xScale: "linear",
  yScale: "linear",
  zScale: "linear",
  colorMap: "Viridis",
};

let activeTab = TAB_FUNCTIONS;
let expressionDebounceId;
let resizeDebounceId;
const parameterValues = {};

function setMessage(target, text, type = "") {
  if (!target) return;
  target.className = "message";
  if (type) target.classList.add(type);
  target.textContent = text;
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAxisVarWithX(formula, axisVar) {
  if (!axisVar || axisVar === "x") return formula;
  const pattern = new RegExp(`\\b${escapeRegExp(axisVar)}\\b`, "g");
  return formula.replace(pattern, "x");
}

function normalizeExpressionInput(rawInput) {
  const normalized = String(rawInput || "")
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/·/g, "*")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, " ")
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

function expressionToLatex(expression) {
  try {
    const normalized = normalizeExpressionInput(expression);
    const parsed = math.parse(normalized.formula);
    const tex = parsed.toTex({ parenthesis: "auto", implicit: "show" });
    return normalized.lhs ? `${normalized.lhs}=${tex}` : tex;
  } catch {
    return String(expression || "");
  }
}

function splitExpressions(rawInput) {
  return String(rawInput || "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function customMathFieldAvailable() {
  return typeof customElements !== "undefined" && !!customElements.get("math-field");
}

function createFunctionEditor(initialExpression) {
  if (customMathFieldAvailable()) {
    const field = document.createElement("math-field");
    field.className = "function-mathfield function-editor";
    field.setAttribute("virtual-keyboard-mode", "manual");
    field.setAttribute("smart-fence", "true");
    field.value = expressionToLatex(initialExpression);
    return field;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input function-editor";
  input.value = initialExpression;
  input.placeholder = "Esempio: sin(x)";
  return input;
}

function getFunctionEditorValue(editor) {
  if (!editor) return "";

  if (editor.tagName === "MATH-FIELD" && typeof editor.getValue === "function") {
    return String(editor.getValue("ascii-math") || "")
      .replace(/[−–]/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .trim();
  }

  return String(editor.value || "").trim();
}

function getFunctionEditors() {
  return [...refs.functionList.querySelectorAll(".function-editor")];
}

function readExpressionList() {
  return getFunctionEditors()
    .map((editor) => getFunctionEditorValue(editor))
    .filter(Boolean);
}

function updateRemoveButtonsState() {
  const buttons = [...refs.functionList.querySelectorAll(".function-remove")];
  const disabled = buttons.length <= 1;
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function addFunctionInput(initialExpression = "", focus = false) {
  const row = document.createElement("div");
  row.className = "function-row";

  const editor = createFunctionEditor(initialExpression);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn-outline function-remove";
  removeButton.title = "Rimuovi funzione";
  removeButton.textContent = "−";

  row.appendChild(editor);
  row.appendChild(removeButton);
  refs.functionList.appendChild(row);

  updateRemoveButtonsState();

  if (focus) {
    setTimeout(() => {
      if (typeof editor.focus === "function") editor.focus();
    }, 0);
  }
}

function setFunctionExpressions(expressions) {
  refs.functionList.innerHTML = "";
  const items = Array.isArray(expressions) ? expressions : splitExpressions(expressions);
  const sanitized = items.map((item) => String(item).trim()).filter(Boolean);
  const finalItems = sanitized.length ? sanitized : ["sin(x)"];
  finalItems.forEach((expression) => addFunctionInput(expression, false));
}

function collectVariableNames(parsed) {
  const symbols = new Set();
  const calledFunctions = new Set();

  parsed.traverse((node) => {
    if (node && node.isSymbolNode) symbols.add(node.name);
    if (node && node.isFunctionNode && node.fn && node.fn.isSymbolNode) calledFunctions.add(node.fn.name);
  });

  return [...symbols]
    .filter((name) => !calledFunctions.has(name))
    .filter((name) => !RESERVED_IDENTIFIERS.has(name))
    .sort((a, b) => {
      const rank = (name) => {
        if (name === "x") return 0;
        if (name === "y") return 1;
        return 9;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });
}

function inferAxes(variableNames, lhs = "") {
  const hasX = variableNames.includes("x");
  const hasY = variableNames.includes("y");

  const firstNonY = variableNames.find((name) => name !== "y");
  const fallback2DAxis = hasX ? "x" : firstNonY || variableNames[0] || "x";

  if (lhs === "z") {
    if (hasX || hasY) {
      const axisA = hasX ? "x" : firstNonY || "x";
      const axisB = hasY ? "y" : axisA === "x" ? "y" : "x";
      return { mode: MODE_3D, axisVars: [axisA, axisB] };
    }
    if (variableNames.length >= 2) {
      return { mode: MODE_3D, axisVars: [variableNames[0], variableNames[1]] };
    }
    if (variableNames.length === 1) {
      const axisA = variableNames[0];
      return { mode: MODE_3D, axisVars: [axisA, axisA === "x" ? "y" : "x"] };
    }
    return { mode: MODE_3D, axisVars: ["x", "y"] };
  }

  if (lhs === "y") {
    return { mode: MODE_2D, axisVars: [fallback2DAxis] };
  }

  if (hasX && hasY) {
    return { mode: MODE_3D, axisVars: ["x", "y"] };
  }

  return { mode: MODE_2D, axisVars: [fallback2DAxis] };
}

function inferFromExpression(expressionInput) {
  const normalized = normalizeExpressionInput(expressionInput);

  let parsed;
  try {
    parsed = math.parse(normalized.formula);
  } catch (error) {
    const detail = error && error.message ? error.message : "Errore di sintassi";
    if (detail.includes("Unexpected operator ,")) {
      throw new Error("Sintassi non valida: usa un textbox per funzione (bottone + Aggiungi funzione), non la virgola.");
    }
    throw new Error(`Sintassi non valida: ${detail}`);
  }

  const variables = collectVariableNames(parsed);
  const axisInfo = inferAxes(variables, normalized.lhs);
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

function inferMultipleExpressions(expressionsRaw) {
  const expressions = Array.isArray(expressionsRaw)
    ? expressionsRaw.map((item) => String(item).trim()).filter(Boolean)
    : splitExpressions(expressionsRaw);

  if (!expressions.length) throw new Error("Inserisci almeno una funzione.");

  const functions = expressions.map((expression) => {
    const inferred = inferFromExpression(expression);
    return { ...inferred, originalExpression: expression };
  });

  const mode = functions[0].mode;
  if (functions.some((item) => item.mode !== mode)) {
    throw new Error("Non puoi mescolare funzioni 2D e 3D nello stesso grafico.");
  }

  const parameterVars = new Set();
  functions.forEach((fn) => fn.parameterVars.forEach((param) => parameterVars.add(param)));

  return {
    mode,
    axisVars: functions[0].axisVars,
    parameterVars: [...parameterVars].sort((a, b) => a.localeCompare(b)),
    functions,
    functionCount: functions.length,
  };
}

function readFunctionInputs() {
  return {
    expressions: readExpressionList(),
    xMin: safeNumber(refs.xMin.value, initialFunctionState.xMin),
    xMax: safeNumber(refs.xMax.value, initialFunctionState.xMax),
    yMin: safeNumber(refs.yMin.value, initialFunctionState.yMin),
    yMax: safeNumber(refs.yMax.value, initialFunctionState.yMax),
    resolution: Math.max(25, Math.min(300, Math.round(safeNumber(refs.resolution.value, initialFunctionState.resolution)))),
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

function updateFunctionUi(inference) {
  const axisA = inference.axisVars[0] || "x";
  const axisB = inference.axisVars[1] || "y";
  const is3d = inference.mode === MODE_3D;

  refs.xRangeLabel.textContent = `Intervallo ${axisA}`;
  refs.yRangeLabel.textContent = `Intervallo ${axisB}`;
  refs.yRangeGroup.style.display = is3d ? "block" : "none";
  refs.colorGroup.style.display = is3d ? "block" : "none";
  refs.zScale.style.display = is3d ? "block" : "none";
  refs.resolutionGroup.style.display = is3d ? "block" : "none";
  refs.plotTitle.textContent = is3d ? "Grafico 3D" : "Grafico 2D (adaptive)";

  const modeText = is3d ? `3D | z = f(${axisA}, ${axisB})` : `2D | f(${axisA})`;
  const fnText = inference.functionCount > 1 ? `${inference.functionCount} funzioni` : "1 funzione";
  refs.detectedMode.textContent = modeText;

  refs.expressionHint.textContent =
    inference.parameterVars.length > 0
      ? `${fnText}. Parametri condivisi: ${inference.parameterVars.join(", ")}.`
      : `${fnText}. Nessun parametro extra.`;

  setScaleSelectText(refs.xScale, axisA);
  if (is3d) {
    setScaleSelectText(refs.yScale, axisB);
    setScaleSelectText(refs.zScale, "z");
    refs.resolutionLabel.textContent = "Densita griglia 3D";
    refs.resolutionHint.textContent = "Aumenta solo se necessario (impatta prestazioni).";
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
    if (!(name in parameterValues)) parameterValues[name] = 1;

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
      renderFunctionsPlot();
    });

    row.appendChild(label);
    row.appendChild(input);
    refs.paramInputs.appendChild(row);
  });
}

function validateRanges(values, inference) {
  if (values.xMin >= values.xMax) throw new Error(`${inference.axisVars[0]}: minimo deve essere < massimo.`);
  if (values.xScale === "log" && values.xMin <= 0) throw new Error(`Scala log su ${inference.axisVars[0]}: minimo > 0.`);

  if (inference.mode === MODE_3D) {
    if (values.yMin >= values.yMax) throw new Error(`${inference.axisVars[1]}: minimo deve essere < massimo.`);
    if (values.yScale === "log" && values.yMin <= 0) throw new Error(`Scala log su ${inference.axisVars[1]}: minimo > 0.`);
  }
}

function buildAxisValues(min, max, count, scaleType) {
  if (scaleType === "log") {
    if (min <= 0 || max <= 0) throw new Error("La scala log richiede estremi > 0.");
    if (count <= 1) return [min];
    const minLog = Math.log10(min);
    const maxLog = Math.log10(max);
    const step = (maxLog - minLog) / (count - 1);
    return Array.from({ length: count }, (_, i) => 10 ** (minLog + i * step));
  }

  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value && typeof value.toNumber === "function") {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value.re === "number" && typeof value.im === "number") {
    if (Math.abs(value.im) > 1e-9) return null;
    return Number.isFinite(value.re) ? value.re : null;
  }
  return null;
}

function purgePlotlyIfNeeded(target) {
  try {
    if (target && target._fullLayout) Plotly.purge(target);
  } catch {
    // Ignore purge failures.
  }
}

function denseSample(evalFn, min, max, count, scaleType = "linear") {
  const x = buildAxisValues(min, max, count, scaleType);
  const y = x.map((value) => {
    try {
      const result = evalFn(value);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  });
  return { x, y };
}

function plot2DWithFunctionPlot(values, inference) {
  if (typeof functionPlot !== "function") return false;
  if (values.xScale !== "linear" || values.yScale !== "linear") return false;

  const axis = inference.axisVars[0] || "x";
  const baseScope = buildParameterScope(inference.parameterVars);

  const data = inference.functions.map((fn, index) => {
    const fnAxis = fn.axisVars[0] || axis;
    const mappedFn = replaceAxisVarWithX(fn.formula, fnAxis);
    return {
      fn: mappedFn,
      graphType: "polyline",
      sampler: "interval",
      nSamples: 240,
      color: LINE_COLORS[index % LINE_COLORS.length],
      scope: baseScope,
    };
  });

  purgePlotlyIfNeeded(refs.plot);
  refs.plot.innerHTML = "";

  const width = Math.max(320, Math.floor(refs.plot.clientWidth));
  const height = Math.max(320, Math.floor(refs.plot.clientHeight));

  try {
    functionPlot({
      target: refs.plot,
      width,
      height,
      grid: true,
      xAxis: { label: axis, domain: [values.xMin, values.xMax] },
      yAxis: { label: `f(${axis})` },
      data,
      tip: { xLine: true, yLine: true },
      disableZoom: false,
    });
  } catch {
    return false;
  }

  return true;
}

function plot2DWithPlotly(values, inference) {
  const axis = inference.axisVars[0] || "x";
  const baseScope = buildParameterScope(inference.parameterVars);

  const traces = inference.functions
    .map((fn, index) => {
      const fnAxis = fn.axisVars[0] || axis;
      const sampleCount = Math.max(1100, Math.min(7200, Math.round((refs.plot.clientWidth || 640) * 2.8)));
      const sampled = denseSample(
        (x) => toFiniteNumber(fn.compiled.evaluate({ ...baseScope, [fnAxis]: x })),
        values.xMin,
        values.xMax,
        sampleCount,
        values.xScale,
      );

      const yValues = sampled.y.map((value) => {
        if (value === null) return null;
        if (values.yScale === "log" && value <= 0) return null;
        return value;
      });

      const anyValid = yValues.some((value) => value !== null);
      if (!anyValid) return null;

      return {
        x: sampled.x,
        y: yValues,
        type: "scatter",
        mode: "lines",
        name: fn.originalExpression,
        line: {
          color: LINE_COLORS[index % LINE_COLORS.length],
          width: 2.5,
          shape: "linear",
          simplify: false,
        },
        hovertemplate: `${fn.originalExpression}<br>${axis}=%{x:.6g}<br>f=%{y:.6g}<extra></extra>`,
      };
    })
    .filter(Boolean);

  if (!traces.length) {
    throw new Error("Nessun valore numerico valido in 2D. Controlla funzione/intervallo.");
  }

  refs.plot.innerHTML = "";

  const layout = {
    margin: { l: 46, r: 20, t: 14, b: 44 },
    paper_bgcolor: "#fcfdff",
    plot_bgcolor: "#fcfdff",
    uirevision: "keep-view",
    dragmode: "zoom",
    showlegend: inference.functionCount > 1,
    legend: { orientation: "h", x: 0, y: 1.14 },
    xaxis: { title: axis, type: values.xScale, range: [values.xMin, values.xMax], gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
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

  const scales = [values.colorMap, ...SURFACE_COLOR_SCALES.filter((name) => name !== values.colorMap)];

  const traces = inference.functions
    .map((fn, index) => {
      const fnXAxis = fn.axisVars[0] || xAxis;
      const fnYAxis = fn.axisVars[1] || yAxis;
      let validCount = 0;

      const zValues = yValues.map((yv) =>
        xValues.map((xv) => {
          const value = toFiniteNumber(fn.compiled.evaluate({ ...baseScope, [fnXAxis]: xv, [fnYAxis]: yv }));
          if (value === null) return Number.NaN;
          if (values.zScale === "log" && value <= 0) return Number.NaN;
          validCount += 1;
          return value;
        }),
      );

      if (!validCount) return null;

      return {
        type: "surface",
        x: xValues,
        y: yValues,
        z: zValues,
        name: fn.originalExpression,
        colorscale: scales[index % scales.length],
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

  refs.plot.innerHTML = "";

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

function applyFunctionState(state) {
  setFunctionExpressions(state.expressions || state.expression || ["sin(x)"]);
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

function previewFunctionInference() {
  try {
    const inference = inferMultipleExpressions(readExpressionList());
    updateFunctionUi(inference);
    renderParameterInputs(inference.parameterVars);
  } catch {
    // Keep last valid state while typing.
  }
}

function renderFunctionsPlot() {
  try {
    const values = readFunctionInputs();
    const inference = inferMultipleExpressions(values.expressions);

    updateFunctionUi(inference);
    renderParameterInputs(inference.parameterVars);
    validateRanges(values, inference);

    setMessage(refs.message, "Rendering in corso...", "ok");

    if (inference.mode === MODE_3D) {
      plot3D(values, inference);
      setMessage(
        refs.message,
        `Grafico 3D aggiornato (${inference.functionCount} funzioni su assi ${inference.axisVars[0]}, ${inference.axisVars[1]}).`,
        "ok",
      );
      return;
    }

    const usedAdaptive = plot2DWithFunctionPlot(values, inference);
    if (!usedAdaptive) {
      plot2DWithPlotly(values, inference);
    }

    const engineLabel = usedAdaptive ? "motore adaptive" : "fallback";
    setMessage(refs.message, `Grafico 2D aggiornato (${inference.functionCount} funzioni, ${engineLabel}).`, "ok");
  } catch (error) {
    setMessage(refs.message, error.message || "Errore durante il plotting.", "error");
  }
}

function resetFunctions() {
  Object.keys(parameterValues).forEach((key) => {
    delete parameterValues[key];
  });
  applyFunctionState(initialFunctionState);
  setMessage(refs.message, "", "");
  previewFunctionInference();
  renderFunctionsPlot();
}

function loadRandomPreset() {
  const choice = presets[Math.floor(Math.random() * presets.length)];
  Object.keys(parameterValues).forEach((key) => delete parameterValues[key]);
  Object.entries(choice.params || {}).forEach(([name, value]) => {
    parameterValues[name] = value;
  });

  applyFunctionState(choice);
  previewFunctionInference();
  renderFunctionsPlot();
}

function roundValue(value, decimals = 6) {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(decimals));
}

function formatScalar(value, decimals = 6) {
  if (typeof value === "number") return String(roundValue(value, decimals));

  if (value && typeof value.re === "number" && typeof value.im === "number") {
    const re = roundValue(value.re, decimals);
    const im = roundValue(Math.abs(value.im), decimals);
    const sign = value.im >= 0 ? "+" : "-";
    return `${re} ${sign} ${im}i`;
  }

  if (value && typeof value.toString === "function") {
    return value.toString();
  }

  return String(value);
}

function formatVector(values) {
  return `[${values.map((v) => formatScalar(v)).join(", ")}]`;
}

function parseMatrix(text, dimension) {
  const rows = String(text || "")
    .split(/[;\n]+/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length !== dimension) {
    throw new Error(`La matrice A deve avere ${dimension} righe.`);
  }

  const matrix = rows.map((row) =>
    row
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number),
  );

  matrix.forEach((row, index) => {
    if (row.length !== dimension) {
      throw new Error(`La riga ${index + 1} della matrice A deve avere ${dimension} colonne.`);
    }
    if (row.some((value) => !Number.isFinite(value))) {
      throw new Error(`La riga ${index + 1} della matrice A contiene valori non numerici.`);
    }
  });

  return matrix;
}

function parseVector(text, dimension, label) {
  const values = String(text || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number);

  if (values.length !== dimension) {
    throw new Error(`${label} deve contenere ${dimension} valori.`);
  }

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} contiene valori non numerici.`);
  }

  return values;
}

function matrixRank(matrix, tolerance = 1e-10) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const work = matrix.map((row) => row.map((value) => Number(value)));

  let rank = 0;
  let pivotRow = 0;
  let pivotCol = 0;

  while (pivotRow < rows && pivotCol < cols) {
    let bestRow = pivotRow;
    let bestValue = Math.abs(work[bestRow][pivotCol]);

    for (let row = pivotRow + 1; row < rows; row += 1) {
      const candidate = Math.abs(work[row][pivotCol]);
      if (candidate > bestValue) {
        bestValue = candidate;
        bestRow = row;
      }
    }

    if (bestValue <= tolerance) {
      pivotCol += 1;
      continue;
    }

    if (bestRow !== pivotRow) {
      const temp = work[pivotRow];
      work[pivotRow] = work[bestRow];
      work[bestRow] = temp;
    }

    const pivotValue = work[pivotRow][pivotCol];
    for (let col = pivotCol; col < cols; col += 1) {
      work[pivotRow][col] /= pivotValue;
    }

    for (let row = 0; row < rows; row += 1) {
      if (row === pivotRow) continue;
      const factor = work[row][pivotCol];
      if (Math.abs(factor) <= tolerance) continue;
      for (let col = pivotCol; col < cols; col += 1) {
        work[row][col] -= factor * work[pivotRow][col];
      }
    }

    rank += 1;
    pivotRow += 1;
    pivotCol += 1;
  }

  return rank;
}

function matrixDeterminant(matrix, tolerance = 1e-12) {
  const size = matrix.length;
  const work = matrix.map((row) => row.map((value) => Number(value)));
  let determinant = 1;
  let sign = 1;

  for (let pivot = 0; pivot < size; pivot += 1) {
    let bestRow = pivot;
    let bestValue = Math.abs(work[pivot][pivot]);
    for (let row = pivot + 1; row < size; row += 1) {
      const candidate = Math.abs(work[row][pivot]);
      if (candidate > bestValue) {
        bestValue = candidate;
        bestRow = row;
      }
    }

    if (bestValue <= tolerance) return 0;

    if (bestRow !== pivot) {
      const temp = work[pivot];
      work[pivot] = work[bestRow];
      work[bestRow] = temp;
      sign *= -1;
    }

    const pivotValue = work[pivot][pivot];
    determinant *= pivotValue;

    for (let row = pivot + 1; row < size; row += 1) {
      const factor = work[row][pivot] / pivotValue;
      for (let col = pivot; col < size; col += 1) {
        work[row][col] -= factor * work[pivot][col];
      }
    }
  }

  return sign * determinant;
}

function vectorTrace2D(vector, name, color, dash = "solid") {
  return {
    type: "scatter",
    mode: "lines+markers+text",
    x: [0, vector[0]],
    y: [0, vector[1]],
    text: ["", name],
    textposition: "top center",
    line: { color, width: 4, dash },
    marker: { size: 8, color },
    name,
  };
}

function vectorTrace3D(vector, name, color, dash = "solid") {
  return {
    type: "scatter3d",
    mode: "lines+markers+text",
    x: [0, vector[0]],
    y: [0, vector[1]],
    z: [0, vector[2]],
    text: ["", name],
    textposition: "top center",
    line: { color, width: 6, dash },
    marker: { size: 4, color },
    name,
  };
}

function renderLinearPlot(dimension, matrixA, vectorV, vectorB, transformedV) {
  purgePlotlyIfNeeded(refs.laPlot);
  refs.laPlot.innerHTML = "";

  if (dimension === 2) {
    const basis1 = [1, 0];
    const basis2 = [0, 1];
    const tBasis1 = math.multiply(matrixA, basis1).valueOf();
    const tBasis2 = math.multiply(matrixA, basis2).valueOf();

    const traces = [
      vectorTrace2D(vectorV, "v", "#0b57d0"),
      vectorTrace2D(transformedV, "A·v", "#b3261e"),
      vectorTrace2D(vectorB, "b", "#188038", "dot"),
      vectorTrace2D(tBasis1, "A·e1", "#7b1fa2", "dash"),
      vectorTrace2D(tBasis2, "A·e2", "#006c73", "dash"),
    ];

    return Plotly.react(
      refs.laPlot,
      traces,
      {
        margin: { l: 46, r: 20, t: 20, b: 46 },
        paper_bgcolor: "#fcfdff",
        plot_bgcolor: "#fcfdff",
        showlegend: true,
        dragmode: "pan",
        xaxis: { title: "x", gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef", scaleanchor: "y", scaleratio: 1 },
        yaxis: { title: "y", gridcolor: "#e5ebf7", zerolinecolor: "#c8d5ef" },
      },
      { responsive: true, displaylogo: false, scrollZoom: true },
    );
  }

  const basis1 = [1, 0, 0];
  const basis2 = [0, 1, 0];
  const basis3 = [0, 0, 1];
  const tBasis1 = math.multiply(matrixA, basis1).valueOf();
  const tBasis2 = math.multiply(matrixA, basis2).valueOf();
  const tBasis3 = math.multiply(matrixA, basis3).valueOf();

  const traces = [
    vectorTrace3D(vectorV, "v", "#0b57d0"),
    vectorTrace3D(transformedV, "A·v", "#b3261e"),
    vectorTrace3D(vectorB, "b", "#188038", "dot"),
    vectorTrace3D(tBasis1, "A·e1", "#7b1fa2", "dash"),
    vectorTrace3D(tBasis2, "A·e2", "#006c73", "dash"),
    vectorTrace3D(tBasis3, "A·e3", "#7f5539", "dash"),
  ];

  return Plotly.react(
    refs.laPlot,
    traces,
    {
      margin: { l: 0, r: 0, t: 8, b: 0 },
      paper_bgcolor: "#fcfdff",
      showlegend: true,
      scene: {
        dragmode: "orbit",
        xaxis: { title: "x", backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
        yaxis: { title: "y", backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
        zaxis: { title: "z", backgroundcolor: "#f8fbff", gridcolor: "#dce7fb" },
        aspectmode: "cube",
      },
    },
    { responsive: true, displaylogo: false, scrollZoom: true },
  );
}

function renderLinear() {
  try {
    const dimension = safeNumber(refs.laDimension.value, 2);
    const matrixA = parseMatrix(refs.laMatrixA.value, dimension);
    const vectorV = parseVector(refs.laVectorV.value, dimension, "Il vettore v");
    const vectorB = parseVector(refs.laVectorB.value, dimension, "Il vettore b");

    const transformedV = math.multiply(matrixA, vectorV).valueOf();
    const determinant =
      typeof math.det === "function" ? math.det(matrixA) : matrixDeterminant(matrixA);
    const rank = typeof math.rank === "function" ? math.rank(matrixA) : matrixRank(matrixA);

    let solution;
    try {
      solution = math.squeeze(math.lusolve(matrixA, vectorB)).valueOf();
    } catch {
      solution = null;
    }

    let eigenValues = null;
    try {
      const eig = math.eigs(matrixA);
      eigenValues = eig.values;
    } catch {
      eigenValues = null;
    }

    renderLinearPlot(dimension, matrixA, vectorV, vectorB, transformedV);

    refs.laOutput.innerHTML = [
      `<div><strong>A · v</strong> = ${formatVector(transformedV)}</div>`,
      `<div><strong>det(A)</strong> = ${roundValue(determinant)}</div>`,
      `<div><strong>rank(A)</strong> = ${rank}</div>`,
      `<div><strong>Soluzione Ax=b</strong> = ${solution ? formatVector(solution) : "non unica / non disponibile"}</div>`,
      `<div><strong>Autovalori</strong> = ${eigenValues ? formatVector(eigenValues) : "non disponibili"}</div>`,
    ].join("");

    setMessage(refs.laMessage, "Algebra lineare aggiornata.", "ok");
  } catch (error) {
    setMessage(refs.laMessage, error.message || "Errore in algebra lineare.", "error");
  }
}

function setLinearExample() {
  const dimension = safeNumber(refs.laDimension.value, 2);
  const sample = linearExamples[dimension] || linearExamples[2];
  refs.laMatrixA.value = sample.matrixA;
  refs.laVectorV.value = sample.vectorV;
  refs.laVectorB.value = sample.vectorB;
  renderLinear();
}

function resetLinear() {
  refs.laDimension.value = "2";
  refs.laMatrixA.value = linearExamples[2].matrixA;
  refs.laVectorV.value = linearExamples[2].vectorV;
  refs.laVectorB.value = linearExamples[2].vectorB;
  refs.laOutput.innerHTML = "";
  setMessage(refs.laMessage, "", "");
  renderLinear();
}

function switchTab(tab) {
  activeTab = tab;

  refs.mainTabs.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  const showFunctions = tab === TAB_FUNCTIONS;
  refs.functionsTab.classList.toggle("active", showFunctions);
  refs.linearTab.classList.toggle("active", !showFunctions);
  refs.presetBtn.style.display = showFunctions ? "inline-flex" : "none";

  if (showFunctions) {
    renderFunctionsPlot();
  } else {
    renderLinear();
  }
}

function handleResize() {
  clearTimeout(resizeDebounceId);
  resizeDebounceId = setTimeout(() => {
    if (activeTab === TAB_FUNCTIONS) {
      renderFunctionsPlot();
    } else {
      renderLinear();
    }
  }, 180);
}

refs.mainTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".tab-btn");
  if (!button) return;
  switchTab(button.dataset.tab === TAB_LINEAR ? TAB_LINEAR : TAB_FUNCTIONS);
});

refs.addFunctionBtn.addEventListener("click", () => {
  addFunctionInput("", true);
  previewFunctionInference();
});

refs.functionList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".function-remove");
  if (!removeButton) return;

  const row = removeButton.closest(".function-row");
  if (!row) return;

  const rows = [...refs.functionList.querySelectorAll(".function-row")];
  if (rows.length <= 1) {
    const editor = row.querySelector(".function-editor");
    if (editor) {
      if (editor.tagName === "MATH-FIELD") {
        editor.value = "";
      } else {
        editor.value = "";
      }
    }
  } else {
    row.remove();
  }

  updateRemoveButtonsState();
  previewFunctionInference();
  renderFunctionsPlot();
});

refs.functionList.addEventListener("keydown", (event) => {
  const editor = event.target.closest(".function-editor");
  if (!editor) return;
  if (event.key === "Enter") {
    event.preventDefault();
    renderFunctionsPlot();
  }
});

refs.functionList.addEventListener("input", (event) => {
  const editor = event.target.closest(".function-editor");
  if (!editor) return;
  clearTimeout(expressionDebounceId);
  expressionDebounceId = setTimeout(() => {
    previewFunctionInference();
  }, 160);
});

refs.plotBtn.addEventListener("click", renderFunctionsPlot);
refs.resetBtn.addEventListener("click", resetFunctions);
refs.presetBtn.addEventListener("click", loadRandomPreset);

refs.laApplyBtn.addEventListener("click", renderLinear);
refs.laExampleBtn.addEventListener("click", setLinearExample);
refs.laResetBtn.addEventListener("click", resetLinear);
refs.laDimension.addEventListener("change", setLinearExample);

window.addEventListener("resize", handleResize);

applyFunctionState(initialFunctionState);
previewFunctionInference();
renderFunctionsPlot();
resetLinear();
switchTab(TAB_FUNCTIONS);
