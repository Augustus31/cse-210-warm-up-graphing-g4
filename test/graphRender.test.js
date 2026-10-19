const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Small DOM doubles let the SVG renderer run under node --test.
function makeNode(tag) {
  return {
    tag, attributes: {}, children: [], textContent: '', style: {},
    classList: { toggle() {} },
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
  };
}

function findAll(node, match) {
  const found = match(node) ? [node] : [];
  for (const child of node.children) found.push(...findAll(child, match));
  return found;
}

const { renderGraph, axisCrossing } = (() => {
  const source = fs.readFileSync(path.join(__dirname, '../graphRender.js'), 'utf8');
  const context = {
    document: {
      createElementNS: (_, tag) => makeNode(tag),
      createElement: tag => makeNode(tag),
    },
  };
  return vm.runInNewContext(
    source.replace(/export function /g, 'function ') + '\n({ renderGraph, axisCrossing })', context);
})();

const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
const range = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };

function render(overrides = {}) {
  const container = makeNode('div');
  renderGraph({ type: 'scatter', points, ...overrides }, container);
  const svg = container.children[0];
  const grid = findAll(svg, node => node.attributes.class === 'chart-grid')[0];
  return { svg, grid };
}

const gridLines = grid => grid.children.filter(node => node.attributes.class === 'grid-line');
const isVertical = node => node.attributes.x1 === node.attributes.x2;

test('grid is hidden by default', () => {
  assert.equal(render().grid, undefined);
  assert.equal(render({ showGrid: false }).grid, undefined);
});

for (const type of ['scatter', 'line']) {
  test(`${type} chart draws a grid when enabled`, () => {
    const { grid } = render({ type, showGrid: true });
    assert.ok(grid);
    assert.equal(grid.attributes['aria-hidden'], 'true');
    assert.ok(gridLines(grid).length > 0);
  });
}

test('grid lines sit exactly on the axis ticks of a custom range', () => {
  const { grid } = render({ showGrid: true, range });
  const lines = gridLines(grid);
  // x: 0, 5, 10 across the plot area (92 to 768); y: 0, 5, 10 (324 to 52).
  assert.deepEqual(lines.filter(isVertical).map(node => node.attributes.x1), [92, 430, 768]);
  assert.deepEqual(lines.filter(node => !isVertical(node)).map(node => node.attributes.y1), [324, 188, 52]);
});

test('grid lines span the whole plot area', () => {
  const { grid } = render({ showGrid: true, range: range });
  for (const line of gridLines(grid)) {
    if (isVertical(line)) {
      assert.equal(line.attributes.y1, 52);
      assert.equal(line.attributes.y2, 324);
    } else {
      assert.equal(line.attributes.x1, 92);
      assert.equal(line.attributes.x2, 768);
    }
  }
});

test('grid lines match the tick labels when the range is automatic', () => {
  const { svg, grid } = render({ showGrid: true });
  const labels = findAll(svg, node => node.attributes.class === 'tick-label');
  // The data starts at 0, so the padded range dips below 0 and the axes cross at
  // the origin. Both 0 ticks then share one "0" label there instead of one each.
  const originLabels = labels.filter(node => node.textContent === '0');
  assert.equal(originLabels.length, 1);
  const { xAxis, yAxis } = axisLines(svg);
  const tickX = labels.filter(node => node.attributes['text-anchor'] === 'middle')
    .map(node => node.attributes.x)
    .concat(yAxis.x1);
  // Y labels are drawn 4px below their tick so the text is vertically centred.
  const tickY = labels.filter(node => node.attributes['text-anchor'] === 'end' && node !== originLabels[0])
    .map(node => node.attributes.y - 4)
    .concat(xAxis.y1);
  const lines = gridLines(grid);
  const sorted = values => [...values].sort((a, b) => a - b);
  assert.deepEqual(sorted(lines.filter(isVertical).map(node => node.attributes.x1)), sorted(tickX));
  assert.deepEqual(sorted(lines.filter(node => !isVertical(node)).map(node => node.attributes.y1)), sorted(tickY));
});

test('grid realigns when the axis range changes', () => {
  const narrow = gridLines(render({ showGrid: true, range: range }).grid)
    .filter(isVertical).map(node => node.attributes.x1);
  const wide = gridLines(render({ showGrid: true, range: { ...range, xMax: 20 } }).grid)
    .filter(isVertical).map(node => node.attributes.x1);
  assert.notDeepEqual(wide, narrow);
  assert.equal(wide[0], 92);
  assert.equal(wide.at(-1), 768);
});

test('grid uses the axes color, falling back to the page ink color', () => {
  const custom = render({ showGrid: true, axesColor: '#654321' });
  assert.ok(gridLines(custom.grid).every(node => node.attributes.stroke === '#654321'));
  const defaultGraph = render({ showGrid: true });
  assert.ok(gridLines(defaultGraph.grid).every(node => node.attributes.stroke === 'var(--color-ink, #000000)'));
});

test('grid is drawn behind the axes and data points', () => {
  const { svg, grid } = render({ showGrid: true });
  const gridIndex = svg.children.indexOf(grid);
  const axisIndex = svg.children.findIndex(node => node.tag === 'line');
  const pointIndex = svg.children.findIndex(node => node.attributes.class === 'data-point');
  assert.ok(gridIndex >= 0);
  assert.ok(axisIndex >= 0);
  assert.ok(pointIndex > gridIndex);
  assert.ok(gridIndex < axisIndex);
});

test('grid is drawn on a transparent background too', () => {
  const { svg, grid } = render({ showGrid: true, transparentBackground: true });
  assert.equal(svg.children.some(node => node.attributes.class === 'chart-background'), false);
  assert.ok(grid);
});

// The first two top-level lines are the x axis and the y axis (grid lines sit inside a group).
function axisLines(svg) {
  const [xAxis, yAxis] = svg.children.filter(node => node.tag === 'line');
  return { xAxis: xAxis.attributes, yAxis: yAxis.attributes };
}

const tickLabels = svg => findAll(svg, node => node.attributes.class === 'tick-label')
  .map(node => node.textContent);

test('axes cross at 0 when 0 is in range', () => {
  assert.equal(axisCrossing({ min: -10, max: 10 }), 0);
  assert.equal(axisCrossing({ min: -10, max: 0 }), 0);
  assert.equal(axisCrossing({ min: 0, max: 10 }), 0);
});

test('axes stay on the low edge when 0 is out of range', () => {
  assert.equal(axisCrossing({ min: 2, max: 10 }), 2);
  assert.equal(axisCrossing({ min: -10, max: -2 }), -10);
});

test('axes go through the origin for four-quadrant data', () => {
  const { svg } = render({ points: [{ x: -5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }, { x: 5, y: -5 }] });
  const { xAxis, yAxis } = axisLines(svg);
  // Symmetric data, so the origin is the centre of the plot area.
  assert.equal(xAxis.y1, (52 + 324) / 2);
  assert.equal(yAxis.x1, (92 + 768) / 2);
  // 0 is labelled once at the origin instead of once per axis.
  assert.equal(tickLabels(svg).filter(label => label === '0').length, 1);
  assert.ok(tickLabels(svg).includes('-5'));
});

test('axes stay bottom and left when the range starts at 0', () => {
  const { svg } = render({ type: 'line', range });
  const { xAxis, yAxis } = axisLines(svg);
  assert.equal(xAxis.y1, 324);
  assert.equal(yAxis.x1, 92);
});

test('only the axis whose range contains 0 moves', () => {
  const { svg } = render({ range: { xMin: -4, xMax: 4, yMin: 2, yMax: 6 } });
  const { xAxis, yAxis } = axisLines(svg);
  assert.equal(xAxis.y1, 324);
  assert.equal(yAxis.x1, (92 + 768) / 2);
  // The x axis is still on the edge, so its 0 label does not hit the y axis.
  assert.ok(tickLabels(svg).includes('0'));
});
