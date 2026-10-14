//default fallback on callbacks
const doNothing = () => {};

/**
 * Builds a scrollable column
 * @param {string} title - The heading name that appears at the top of the fieldset box
 * @param {string} innerHtml - The form controls (inputs, buttons, dropdowns) placed inside that section.
 * @return {HTMLFieldSetElement} - The constructed DOM.
 */
function createSettingsColumn(title, innerHtml) {
  const column = document.createElement('fieldset');
  column.className = 'settings-column';
  column.innerHTML = `<legend>${title}</legend>${innerHtml}`;
  return column;
}

/**
 * Builds a Plot settings column containing plot type selection and title inputs.
 * @param {Object} [options={}] - The callback configuration object.
 * @param {Function} [options.onPlotTypeChange=doNothing] - Callback triggered when the plot type changes ('line' or 'scatter').
 * @param {Function} [options.onTitleChange=doNothing] - Callback triggered when the graph title input value changes.
 * @returns {HTMLFieldSetElement} The constructed DOM.
 */
function PlotSettings({ onPlotTypeChange = doNothing, onTitleChange = doNothing }) {
  const column = createSettingsColumn('Plot', `
    <div class="radio-row">
      <label><input type="radio" name="plot-type" value="line" checked> Line</label>
      <label><input type="radio" name="plot-type" value="scatter"> Scatter</label>
    </div>
    <label>Title <input type="text" name="title" placeholder="My graph"></label>
  `);
  column.querySelectorAll('[name="plot-type"]').forEach(radioButton =>
    radioButton.addEventListener('change', () => onPlotTypeChange(radioButton.value)));
  column.querySelector('[name="title"]')
    .addEventListener('input', event => onTitleChange(event.target.value));
  return column;
}


/**
 * Renders the Data settings column containing the CSV file upload button and file status display.
 * @param {Object} [options={}] - The callback configuration object.
 * @param {Function} [options.onCsvLoad=doNothing] - Callback triggered with the loaded File object when a valid CSV is chosen.
 * @returns {HTMLFieldSetElement} The constructed DOM.
 */
function DataSettings({ onCsvLoad = doNothing }) {
  const column = createSettingsColumn('Data', `
    <label class="file-button">
      Load CSV
      <input type="file" name="csv" accept=".csv,text/csv">
    </label>
    <span class="file-name">No file loaded</span>
  `);
  column.querySelector('[name="csv"]').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    column.querySelector('.file-name').textContent = file.name;
    onCsvLoad(file);
    event.target.value = ''; // so choosing the same file again still fires 'change'
  });
  return column;
}

/**
 * This renders the Style settings column containing color pickers and point style selector.
 * @param {Object} [options={}] - The callback configuration object.
 * @param {Function} [options.onPointColorChange=doNothing] - Callback triggered when the point color value changes.
 * @param {Function} [options.onLineColorChange=doNothing] - Callback triggered when the line color value changes.
 * @param {Function} [options.onAxesColorChange=doNothing] - Callback triggered when the axes color value changes.
 * @param {Function} [options.onPointStyleChange=doNothing] - Callback triggered when the point shape/style selection changes.
 * @returns {HTMLFieldSetElement} The constructed DOM.
 */
function StyleSettings({
  onPointColorChange = doNothing,
  onLineColorChange = doNothing,
  onAxesColorChange = doNothing,
  onPointStyleChange = doNothing,
}) {
  const column = createSettingsColumn('Style', `
    <label class="color-row">Point color <input type="color" name="point-color" value="#000000"></label>
    <label class="color-row">Line color <input type="color" name="line-color" value="#000000"></label>
    <label class="color-row">Axes color <input type="color" name="axes-color" value="#000000"></label>
    <label>Point style
      <select name="point-style">
        <option value="circle">Circle</option>
        <option value="square">Square</option>
        <option value="triangle">Triangle</option>
        <option value="cross">Cross</option>
      </select>
    </label>
  `);
  const getInput = name => column.querySelector(`[name="${name}"]`);
  getInput('point-color').addEventListener('input', event => onPointColorChange(event.target.value));
  getInput('line-color').addEventListener('input', event => onLineColorChange(event.target.value));
  getInput('axes-color').addEventListener('input', event => onAxesColorChange(event.target.value));
  getInput('point-style').addEventListener('change', event => onPointStyleChange(event.target.value));
  return column;
}

/**
 * Renders the Axes settings column containing axis names and range inputs.
 * @param {Object} [options={}] - The callback configuration object.
 * @param {Function} [options.onXAxisNameChange=doNothing] - Callback triggered when the X-axis name input changes.
 * @param {Function} [options.onYAxisNameChange=doNothing] - Callback triggered when the Y-axis name input changes.
 * @param {Function} [options.onAxisRangeChange=doNothing] - Callback triggered when any axis range value changes.
 * @returns {HTMLFieldSetElement} The constructed DOM.
 */
function AxesSettings({
  onXAxisNameChange = doNothing,
  onYAxisNameChange = doNothing,
  onAxisRangeChange = doNothing,
}) {
  const column = createSettingsColumn('Axes', `
    <label>X axis name <input type="text" name="x-name" placeholder="x"></label>
    <label>Y axis name <input type="text" name="y-name" placeholder="y"></label>
    <div class="range-grid">
      <label>X min <input type="number" step="any" name="x-min" placeholder="auto"></label>
      <label>X max <input type="number" step="any" name="x-max" placeholder="auto"></label>
      <label>Y min <input type="number" step="any" name="y-min" placeholder="auto"></label>
      <label>Y max <input type="number" step="any" name="y-max" placeholder="auto"></label>
    </div>
  `);
  const getInput = name => column.querySelector(`[name="${name}"]`);
  getInput('x-name').addEventListener('input', event => onXAxisNameChange(event.target.value));
  getInput('y-name').addEventListener('input', event => onYAxisNameChange(event.target.value));

  // Show axis names set from csv
  column.setAxisNames = function (xName, yName) {
    if (getInput('x-name').value !== xName) getInput('x-name').value = xName;
    if (getInput('y-name').value !== yName) getInput('y-name').value = yName;
  };

  // Report all four together; an empty box means "auto" (null)
  const readNumberOrNull = name => (getInput(name).value === '' ? null : Number(getInput(name).value));
  for (const name of ['x-min', 'x-max', 'y-min', 'y-max']) {
    getInput(name).addEventListener('change', () => onAxisRangeChange({
      xMin: readNumberOrNull('x-min'),
      xMax: readNumberOrNull('x-max'),
      yMin: readNumberOrNull('y-min'),
      yMax: readNumberOrNull('y-max'),
    }));
  }
  return column;
}

/**
 * Renders the full GraphSettings component containing all settings columns and a save button.
 * @param {Object} [callbacks={}] - Object containing callback handlers for all settings actions.
 * @returns {HTMLDivElement} The constructed DOM container.
 */
export function GraphSettings(callbacks = {}) {
  const graphSettings = document.createElement('div');
  graphSettings.className = 'graph-settings';

  const columns = document.createElement('div');
  columns.className = 'settings-columns';
  const axesSettings = AxesSettings(callbacks);
  columns.append(
    PlotSettings(callbacks),
    DataSettings(callbacks),
    StyleSettings(callbacks),
    axesSettings,
  );

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'save-button';
  saveButton.textContent = 'Save';
  saveButton.addEventListener('click', () => (callbacks.onSave ?? doNothing)());

  graphSettings.append(columns, /*saveButton*/);
  graphSettings.setAxisNames = axesSettings.setAxisNames;
  return graphSettings;
}
