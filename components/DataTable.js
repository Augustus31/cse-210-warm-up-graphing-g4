const doNothing = () => {};

/**
 * Builds a numeric input element for an axis coordinate cell.
 * @param {string} axis - The axis name identifier ('X' or 'Y').
 * @param {number} rowNumber - The row index/number for accessibility labeling.
 * @returns {HTMLInputElement} The constructed number input DOM element.
 */
function createNumberInput(axis, rowNumber) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.setAttribute('aria-label', `${axis} ${rowNumber}`);
  return input;
}

/**
 * Builds a data table for graphing.
 * @param {Object} [options={}] - The callback configuration object.
 * @param {Function} [options.onPointsChange=doNothing] - Callback triggered when any point value changes.
 * @param {number} [options.startingRowCount=3] - The number of rows to start with.
 * @returns {HTMLDivElement} The constructed DOM.
 */
export function DataTable({ onPointsChange = doNothing, startingRowCount = 3 } = {}) {
  const dataTable = document.createElement('div');
  dataTable.className = 'data-table';
  dataTable.innerHTML = `
    <div class="table-scroll">
      <table class="coordinate-table">
        <thead>
          <tr><th>X axis</th><th>Y axis</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <button type="button" class="add-row">Add row</button>
  `;
  const tableBody = dataTable.querySelector('tbody');
  const [xHeader, yHeader] = dataTable.querySelectorAll('th');

  function addRow() {
    const rowNumber = tableBody.rows.length + 1;
    const row = tableBody.insertRow();
    for (const axis of ['X', 'Y']) {
      row.insertCell().append(createNumberInput(axis, rowNumber));
    }
    return row;
  }

  // Read every valid row-pair into a list
  function readPoints() {
    return [...tableBody.rows]
      .map(row => row.querySelectorAll('input'))
      .filter(([xInput, yInput]) => xInput.value !== '' && yInput.value !== '')
      .map(([xInput, yInput]) => ({ x: Number(xInput.value), y: Number(yInput.value) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  // Checking if two lists of points have the same points
  function samePoints(a, b) {
    return a.length === b.length && a.every((point, i) => point.x === b[i].x && point.y === b[i].y);
  }

  // rebuild data table from points only when they differ from the current ppoits
  dataTable.setPoints = function (points) {
    if (samePoints(points, readPoints())) return;
    tableBody.replaceChildren();
    for (const point of points) {
      const [xInput, yInput] = addRow().querySelectorAll('input');
      xInput.value = point.x;
      yInput.value = point.y;
    }
  };

  // Column headers show the axis names or "X axis" / "Y axis" if empty
  dataTable.setAxisNames = function (xName, yName) {
    xHeader.textContent = xName || 'X axis';
    yHeader.textContent = yName || 'Y axis';
  };

  for (let i = 0; i < startingRowCount; i++) addRow();
  dataTable.querySelector('.add-row').addEventListener('click', addRow);
  tableBody.addEventListener('input', () => onPointsChange(readPoints()));

  return dataTable;
}
