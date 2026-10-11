const doNothing = () => {};

// Builds the X or Y box for one row
function createNumberInput(axis, rowNumber) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.setAttribute('aria-label', `${axis} ${rowNumber}`);
  return input;
}

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

  function addRow() {
    const rowNumber = tableBody.rows.length + 1;
    const row = tableBody.insertRow();
    for (const axis of ['X', 'Y']) {
      row.insertCell().append(createNumberInput(axis, rowNumber));
    }
  }

  // Read every valid row-pair into a list
  function readPoints() {
    return [...tableBody.rows]
      .map(row => row.querySelectorAll('input'))
      .filter(([xInput, yInput]) => xInput.value !== '' && yInput.value !== '')
      .map(([xInput, yInput]) => ({ x: Number(xInput.value), y: Number(yInput.value) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  for (let i = 0; i < startingRowCount; i++) addRow();
  dataTable.querySelector('.add-row').addEventListener('click', addRow);
  tableBody.addEventListener('input', () => onPointsChange(readPoints()));

  return dataTable;
}
