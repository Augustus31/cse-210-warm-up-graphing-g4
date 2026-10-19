const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Small DOM doubles let the SVG renderer run under node --test.
function makeNode(strTag) {
  return {
    tag: strTag, attributes: {}, children: [], textContent: '', style: {},
    classList: { toggle() {} },
    setAttribute(strKey, value) { this.attributes[strKey] = value; },
    appendChild(objChild) { this.children.push(objChild); return objChild; },
    replaceChildren(...arrChildren) { this.children = arrChildren; },
  };
}

function findAll(objNode, fnMatch) {
  const arrFound = fnMatch(objNode) ? [objNode] : [];
  for (const objChild of objNode.children) arrFound.push(...findAll(objChild, fnMatch));
  return arrFound;
}

const { renderGraph } = (() => {
  const strSource = fs.readFileSync(path.join(__dirname, '../graphRender.js'), 'utf8');
  const objContext = {
    document: {
      createElementNS: (_, strTag) => makeNode(strTag),
      createElement: strTag => makeNode(strTag),
    },
  };
  return vm.runInNewContext(
    strSource.replace(/export function /g, 'function ') + '\n({ renderGraph })', objContext);
})();

const arrPoints = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
const objRange = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };

function render(objOverrides = {}) {
  const elContainer = makeNode('div');
  renderGraph({ type: 'scatter', points: arrPoints, ...objOverrides }, elContainer);
  const elSvg = elContainer.children[0];
  const elGrid = findAll(elSvg, node => node.attributes.class === 'chart-grid')[0];
  return { elSvg, elGrid };
}

const gridLines = elGrid => elGrid.children.filter(node => node.attributes.class === 'grid-line');
const isVertical = node => node.attributes.x1 === node.attributes.x2;

test('grid is hidden by default', () => {
  assert.equal(render().elGrid, undefined);
  assert.equal(render({ showGrid: false }).elGrid, undefined);
});

for (const strType of ['scatter', 'line']) {
  test(`${strType} chart draws a grid when enabled`, () => {
    const { elGrid } = render({ type: strType, showGrid: true });
    assert.ok(elGrid);
    assert.equal(elGrid.attributes['aria-hidden'], 'true');
    assert.ok(gridLines(elGrid).length > 0);
  });
}

test('grid lines sit exactly on the axis ticks of a custom range', () => {
  const { elGrid } = render({ showGrid: true, range: objRange });
  const arrLines = gridLines(elGrid);
  // x: 0, 5, 10 across the plot area (92 to 768); y: 0, 5, 10 (324 to 52).
  assert.deepEqual(arrLines.filter(isVertical).map(node => node.attributes.x1), [92, 430, 768]);
  assert.deepEqual(arrLines.filter(node => !isVertical(node)).map(node => node.attributes.y1), [324, 188, 52]);
});

test('grid lines span the whole plot area', () => {
  const { elGrid } = render({ showGrid: true, range: objRange });
  for (const objLine of gridLines(elGrid)) {
    if (isVertical(objLine)) {
      assert.equal(objLine.attributes.y1, 52);
      assert.equal(objLine.attributes.y2, 324);
    } else {
      assert.equal(objLine.attributes.x1, 92);
      assert.equal(objLine.attributes.x2, 768);
    }
  }
});

test('grid lines match the tick labels when the range is automatic', () => {
  const { elSvg, elGrid } = render({ showGrid: true });
  const arrLabels = findAll(elSvg, node => node.attributes.class === 'tick-label');
  const arrTickX = arrLabels.filter(node => node.attributes['text-anchor'] === 'middle')
    .map(node => node.attributes.x);
  // Y labels are drawn 4px below their tick so the text is vertically centred.
  const arrTickY = arrLabels.filter(node => node.attributes['text-anchor'] === 'end')
    .map(node => node.attributes.y - 4);
  const arrLines = gridLines(elGrid);
  assert.deepEqual(arrLines.filter(isVertical).map(node => node.attributes.x1), arrTickX);
  assert.deepEqual(arrLines.filter(node => !isVertical(node)).map(node => node.attributes.y1), arrTickY);
});

test('grid realigns when the axis range changes', () => {
  const arrNarrow = gridLines(render({ showGrid: true, range: objRange }).elGrid)
    .filter(isVertical).map(node => node.attributes.x1);
  const arrWide = gridLines(render({ showGrid: true, range: { ...objRange, xMax: 20 } }).elGrid)
    .filter(isVertical).map(node => node.attributes.x1);
  assert.notDeepEqual(arrWide, arrNarrow);
  assert.equal(arrWide[0], 92);
  assert.equal(arrWide.at(-1), 768);
});

test('grid uses the axes color, falling back to the page ink color', () => {
  const objCustom = render({ showGrid: true, axesColor: '#654321' });
  assert.ok(gridLines(objCustom.elGrid).every(node => node.attributes.stroke === '#654321'));
  const objDefault = render({ showGrid: true });
  assert.ok(gridLines(objDefault.elGrid).every(node => node.attributes.stroke === 'var(--color-ink, #000000)'));
});

test('grid is drawn behind the axes and data points', () => {
  const { elSvg, elGrid } = render({ showGrid: true });
  const intGrid = elSvg.children.indexOf(elGrid);
  const intAxis = elSvg.children.findIndex(node => node.tag === 'line');
  const intPoint = elSvg.children.findIndex(node => node.attributes.class === 'data-point');
  assert.ok(intGrid >= 0);
  assert.ok(intAxis >= 0);
  assert.ok(intPoint > intGrid);
  assert.ok(intGrid < intAxis);
});

test('grid is drawn on a transparent background too', () => {
  const { elSvg, elGrid } = render({ showGrid: true, transparentBackground: true });
  assert.equal(elSvg.children.some(node => node.attributes.class === 'chart-background'), false);
  assert.ok(elGrid);
});