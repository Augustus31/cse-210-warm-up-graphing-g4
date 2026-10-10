const SVG_NS = "http://www.w3.org/2000/svg";
const CHART = { width: 640, height: 400, margin: { top: 24, right: 24, bottom: 62, left: 72 } };

// Ignore malformed points so one bad observation does not prevent a chart.
function validPoints(data) {
  return Array.isArray(data)
    ? data.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
}

function niceStep(range) {
  const roughStep = range / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

// Pad each data range, then round its limits to readable tick intervals.
function calculateBounds(points, key) {
  const values = points.map(point => point[key]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(min) * 0.2, 1);
  min -= span * 0.08;
  max += span * 0.08;

  const step = niceStep(max - min);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = min, i = 0; value <= max + step * 1e-8 && i < 100; value += step, i++) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return { min, max, ticks };
}

function createScale(min, max, pixelMin, pixelMax, invert = false) {
  return value => {
    const ratio = (value - min) / (max - min);
    return invert ? pixelMax - ratio * (pixelMax - pixelMin) : pixelMin + ratio * (pixelMax - pixelMin);
  };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function addText(svg, text, x, y, attributes = {}) {
  const element = svgElement("text", { x, y, ...attributes });
  element.textContent = text;
  svg.appendChild(element);
}

function formatTick(value) {
  return Number(value.toPrecision(6)).toString();
}

// Shared axes keep tick positions and chart points on the same scales.
function drawAxes(svg, xBounds, yBounds, scaleX, scaleY) {
  const { width, height, margin } = CHART;
  const left = margin.left;
  const right = width - margin.right;
  const top = margin.top;
  const bottom = height - margin.bottom;
  const axisStyle = { stroke: "#475569", "stroke-width": 1.5 };

  svg.appendChild(svgElement("line", { x1: left, y1: bottom, x2: right, y2: bottom, ...axisStyle }));
  svg.appendChild(svgElement("line", { x1: left, y1: top, x2: left, y2: bottom, ...axisStyle }));

  for (const tick of xBounds.ticks) {
    const x = scaleX(tick);
    svg.appendChild(svgElement("line", { x1: x, y1: bottom, x2: x, y2: bottom + 5, ...axisStyle }));
    addText(svg, formatTick(tick), x, bottom + 21, { "text-anchor": "middle", class: "tick-label" });
  }

  for (const tick of yBounds.ticks) {
    const y = scaleY(tick);
    svg.appendChild(svgElement("line", { x1: left - 5, y1: y, x2: left, y2: y, ...axisStyle }));
    addText(svg, formatTick(tick), left - 9, y + 4, { "text-anchor": "end", class: "tick-label" });
  }

  addText(svg, "X", (left + right) / 2, height - 12, { "text-anchor": "middle", class: "axis-label" });
  addText(svg, "Y", 19, (top + bottom) / 2, {
    "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 19 ${(top + bottom) / 2})`
  });
}

function prepareChart(data, container, title) {
  if (!(container instanceof Element)) return null;
  container.replaceChildren();
  const points = validPoints(data);
  if (points.length === 0) {
    container.textContent = "No valid data to display.";
    return null;
  }

  const { width, height, margin } = CHART;
  const xBounds = calculateBounds(points, "x");
  const yBounds = calculateBounds(points, "y");
  const scaleX = createScale(xBounds.min, xBounds.max, margin.left, width - margin.right);
  const scaleY = createScale(yBounds.min, yBounds.max, margin.top, height - margin.bottom, true);
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": title
  });

  drawAxes(svg, xBounds, yBounds, scaleX, scaleY);
  return { svg, points, scaleX, scaleY };
}

function drawPoints(svg, points, scaleX, scaleY) {
  for (const point of points) {
    svg.appendChild(svgElement("circle", {
      cx: scaleX(point.x), cy: scaleY(point.y), r: 5, class: "data-point"
    }));
  }
}

function renderScatterPlot(data, container) {
  const chart = prepareChart(data, container, "Scatter plot");
  if (!chart) return;
  drawPoints(chart.svg, chart.points, chart.scaleX, chart.scaleY);
  container.appendChild(chart.svg);
}

function renderLineChart(data, container) {
  const chart = prepareChart(data, container, "Line chart");
  if (!chart) return;

  // Sort a copy so the caller's array keeps its original order.
  const sortedPoints = [...chart.points].sort((a, b) => a.x - b.x);
  const coordinates = sortedPoints
    .map(point => `${chart.scaleX(point.x)},${chart.scaleY(point.y)}`)
    .join(" ");
  chart.svg.appendChild(svgElement("polyline", { points: coordinates, class: "data-line" }));
  drawPoints(chart.svg, sortedPoints, chart.scaleX, chart.scaleY);
  container.appendChild(chart.svg);
}
