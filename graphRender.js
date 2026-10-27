/* SVG namespace used to render graph */
const SVG_NS = "http://www.w3.org/2000/svg";

/* Default chart size */
const CHART = { width: 800, height: 400, margin: { top: 52, right: 32, bottom: 76, left: 92 } };
let clipIdCounter = 0;

/**
 * Picks a clean interval for the axis labels, such as 1, 2, or 5.
 * @param {number} range - The distance covered by the axis.
 * @returns {number} The distance between tick marks.
 */
function niceStep(range) {
  const roughStep = range / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

/**
 * Finds the axis limits and tick labels. It leaves a little room around the data,
 * then starts the labels at a clean interval inside the range.
 * @param {Array<{x: number, y: number}>} points - The valid graph points.
 * @param {"x"|"y"} key - The axis value to use.
 * @param {?number} requestedMin - The minimum set in the UI.
 * @param {?number} requestedMax - The maximum set in the UI.
 * @returns {{min: number, max: number, ticks: number[]}} The axis range and tick labels.
 */
function calculateBounds(points, key, requestedMin, requestedMax) {
  const values = points.map(point => point[key]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(min) * 0.2, 1);
  min -= span * 0.08;
  max += span * 0.08;

  const step = niceStep(max - min);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (Number.isFinite(requestedMin)) min = requestedMin;
  if (Number.isFinite(requestedMax)) max = requestedMax;
  if (max <= min) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    if (Number.isFinite(requestedMin) && !Number.isFinite(requestedMax)) max = min + padding;
    else if (!Number.isFinite(requestedMin) && Number.isFinite(requestedMax)) min = max - padding;
    else { min -= padding; max += padding; }
  }

  const tickStep = niceStep(max - min);
  const ticks = [];
  // Start at the first clean label inside the range. The limit prevents a bad
  // range from creating an endless list of labels.
  for (let value = Math.ceil(min / tickStep) * tickStep, i = 0;
    value <= max + tickStep * 1e-8 && i < 100; value += tickStep, i++) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return { min, max, ticks };
}

/**
 * Maps a graph value to its position in the SVG chart.
 * SVG y-coordinates grow downward, so the y-axis uses the invert option.
 * @param {number} min - The smallest value on the axis.
 * @param {number} max - The largest value on the axis.
 * @param {number} pixelMin - The first pixel position on the axis.
 * @param {number} pixelMax - The last pixel position on the axis.
 * @param {boolean} invert - Whether to flip the positions for the y-axis.
 * @returns {function(number): number} A function that maps values to pixel positions.
 */
function createScale(min, max, pixelMin, pixelMax, invert = false) {
  return value => {
    const ratio = (value - min) / (max - min);
    return invert ? pixelMax - ratio * (pixelMax - pixelMin) : pixelMin + ratio * (pixelMax - pixelMin);
  };
}

/**
 * Create SVG element
 * Commonly used when adding to DOM later with svg.appendChild(svgElement())
 * @param {string} name - SVG name of element (e.g. "line", "circle")
 * @param {Object<string, string|number>} attributes - attribute names and their values (e.g. position)
 * @returns {SVGElement} The new SVG element
 *
 * @example
 * svg.appendChild(svgElement("circle", { cx: x, cy: y, r: 7, fill: color, class: "data-point" }))
 */
function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);

  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

/**
 * Adds a text label to the SVG.
 * @param {SVGElement} svg - The SVG element to draw in.
 * @param {string} text - The text to show.
 * @param {number} x - The x position in the SVG.
 * @param {number} y - The y position in the SVG.
 * @param {Object<string, string|number>} attributes - Extra attributes, such as alignment or class.
 * @returns {void}
 */
function addText(svg, text, x, y, attributes = {}) {
  const element = svgElement("text", { x, y, ...attributes });
  element.textContent = text;
  svg.appendChild(element);
}

/**
 * Formats a tick value for its axis label.
 * Rounding to 6 significant digits hides floating-point noise,
 * so a tick shows "0.3" instead of "0.30000000000000004".
 * @param {number} value - The tick value.
 * @returns {string} The label text.
 */
function formatTick(value) {
  return Number(value.toPrecision(6)).toString();
}

/**
 * Draws both axes, their tick marks, and the labels from the graph settings.
 * @param {SVGElement} svg - The SVG element to draw in.
 * @param {{ticks: number[]}} xBounds - The x-axis tick values.
 * @param {{ticks: number[]}} yBounds - The y-axis tick values.
 * @param {function(number): number} scaleX - Maps x values to SVG positions.
 * @param {function(number): number} scaleY - Maps y values to SVG positions.
 * @param {Object} graph - The graph settings for axis names and color.
 * @returns {void}
 */
function drawAxes(svg, xBounds, yBounds, scaleX, scaleY, graph) {
  const { width, height, margin } = CHART;
  const left = margin.left;
  const right = width - margin.right;
  const top = margin.top;
  const bottom = height - margin.bottom;
  const axesColor = graph.axesColor || "var(--color-ink, #000000)";
  const axisStyle = { stroke: axesColor, "stroke-width": 2.5 };

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

  addText(svg, graph.xAxisName || "X", (left + right) / 2, height - 12, {
    "text-anchor": "middle", class: "axis-label", fill: axesColor
  });
  addText(svg, graph.yAxisName || "Y", 19, (top + bottom) / 2, {
    "text-anchor": "middle", class: "axis-label", fill: axesColor,
    transform: `rotate(-90 19 ${(top + bottom) / 2})`
  });
}

/**
 * Filters the points and prepares the SVG chart and its scales.
 * If there are no complete numeric points, it shows a short message instead.
 * @param {Object} graph - The current graph settings and point data.
 * @param {Element} container - The chart area that will hold the SVG.
 * @param {string} title - A fallback label for the chart's accessible name.
 * @returns {?Object} The prepared chart parts, or null when there is no chart to draw.
 */
function prepareChart(graph, container, title) {
  if (!container || typeof container.replaceChildren !== "function") return null;
  const points = Array.isArray(graph.points)
    ? graph.points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  if (points.length === 0) {
    container.replaceChildren();
    const message = document.createElement("p");
    message.className = "chart-empty";
    message.textContent = "Add at least one complete X/Y pair to see the graph.";
    container.appendChild(message);
    return null;
  }

  const { width, height, margin } = CHART;
  const range = graph.range && typeof graph.range === "object" ? graph.range : {};
  const xBounds = calculateBounds(points, "x", range.xMin, range.xMax);
  const yBounds = calculateBounds(points, "y", range.yMin, range.yMax);

  const visiblePoints = points.filter(p =>
    p.x >= xBounds.min && p.x <= xBounds.max &&
    p.y >= yBounds.min && p.y <= yBounds.max
  );

  const scaleX = createScale(xBounds.min, xBounds.max, margin.left, width - margin.right);
  const scaleY = createScale(yBounds.min, yBounds.max, margin.top, height - margin.bottom, true);
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "font-family": "var(--font-body, inherit)",
    "aria-label": graph.title || title
  });

  if (graph.title) addText(svg, graph.title, width / 2, 30, { "text-anchor": "middle", class: "chart-title" });
  drawAxes(svg, xBounds, yBounds, scaleX, scaleY, graph);
  return { svg, points: visiblePoints, allPoints: points, scaleX, scaleY };
}

/**
 * Draws the given points using the selected shape and color.
 * @param {SVGElement} svg - The SVG element to draw in.
 * @param {Array<{x: number, y: number}>} points - The points to draw.
 * @param {function(number): number} scaleX - Maps x values to SVG positions.
 * @param {function(number): number} scaleY - Maps y values to SVG positions.
 * @param {Object} graph - The graph settings for point shape and color.
 * @returns {void}
 */
function drawPoints(svg, points, scaleX, scaleY, graph) {
  const color = graph.pointColor || "var(--color-ink, #000000)";
  for (const point of points) {
    const x = scaleX(point.x);
    const y = scaleY(point.y);
    let mark;
    if (graph.pointStyle === "square") {
      mark = svgElement("rect", { x: x - 7, y: y - 7, width: 14, height: 14, fill: color, class: "data-point" });
    } else if (graph.pointStyle === "triangle") {
      mark = svgElement("polygon", { points: `${x},${y - 8} ${x - 7},${y + 6} ${x + 7},${y + 6}`, fill: color, class: "data-point" });
    } else if (graph.pointStyle === "cross") {
      mark = svgElement("path", {
        d: `M ${x - 6} ${y - 6} L ${x + 6} ${y + 6} M ${x + 6} ${y - 6} L ${x - 6} ${y + 6}`,
        stroke: color, class: "data-point data-point-cross"
      });
    } else {
      mark = svgElement("circle", { cx: x, cy: y, r: 7, fill: color, class: "data-point" });
    }
    svg.appendChild(mark);
  }
}

/**
 * Draws the points as a scatter plot.
 * @param {Object} graph - The graph settings and point data.
 * @param {Element} container - The chart area that will hold the SVG.
 * @returns {void}
 */
function renderScatterPlot(graph, container) {
  const chart = prepareChart(graph, container, "Scatter graph");
  if (!chart) return;
  drawPoints(chart.svg, chart.points, chart.scaleX, chart.scaleY, graph);
  container.replaceChildren(chart.svg);
}

/**
 * Draws the points and connects them in x-order.
 * The line can reach the chart edge, but the SVG clips it to the plot area.
 * @param {Object} graph - The graph settings and point data.
 * @param {Element} container - The chart area that will hold the SVG.
 * @returns {void}
 */
function renderLineChart(graph, container) {
  const chart = prepareChart(graph, container, "Line graph");
  if (!chart) return;

  // Keep off-range points in the line so it reaches the chart edge.
  // The clip path trims anything outside the plot area.
  const allSorted = [...chart.allPoints].sort((a, b) => a.x - b.x);
  if (allSorted.length > 1) {
    const { width, height, margin } = CHART;
    const clipId = `line-clip-${++clipIdCounter}`;

    const clipPath = svgElement("clipPath", { id: clipId });
    clipPath.appendChild(svgElement("rect", {
      x: margin.left,
      y: margin.top,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    }));
    chart.svg.appendChild(clipPath);

    const coordinates = allSorted
      .map(point => `${chart.scaleX(point.x)},${chart.scaleY(point.y)}`)
      .join(" ");
    chart.svg.appendChild(svgElement("polyline", {
      points: coordinates,
      class: "data-line",
      stroke: graph.lineColor || "var(--color-ink, #000000)",
      "clip-path": `url(#${clipId})`,
    }));
  }

  // Markers outside the selected range stay hidden.
  const sortedPoints = [...chart.points].sort((a, b) => a.x - b.x);
  drawPoints(chart.svg, sortedPoints, chart.scaleX, chart.scaleY, graph);
  container.replaceChildren(chart.svg);
}

/**
 * Draws the current graph in the chart area.
 * @param {Object} data - The graph settings and points from the UI.
 * @param {Element} container - The chart area where the SVG goes.
 */
export function renderGraph(data, container) {
  const graph = data && typeof data === "object" ? data : {};
  if (graph.type === "line") return renderLineChart(graph, container);
  return renderScatterPlot(graph, container);
}
