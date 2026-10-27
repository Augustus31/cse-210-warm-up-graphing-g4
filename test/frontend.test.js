const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let graphInstance = 0;

async function setup() {
  function createElement(tag) {
    const element = {
      listeners: {},
      addEventListener(type, callback) {
        this.listeners[type] = callback;
      },
      dispatchEvent(event) {
        this.listeners[event.type]();
      },
      setAttribute() {},
    };

    if (tag === "tbody") {
      element.rows = [];
      element.insertRow = () => {
        const row = {
          cells: [],
          insertCell() {
            const cell = {
              append(input) {
                this.input = input;
              },
            };
            this.cells.push(cell);
            return cell;
          },
          querySelectorAll() {
            return this.cells.map((cell) => cell.input);
          },
        };
        element.rows.push(row);
        return row;
      };
      element.replaceChildren = () => {
        element.rows = [];
      };
    }

    return element;
  }

  const tableBody = createElement("tbody");
  const addButton = createElement("button");
  const table = createElement("div");
  table.querySelector = (selector) =>
    selector === "tbody" ? tableBody : addButton;
  table.querySelectorAll = () => [{}, {}];
  const document = {
    createElement: (tag) => (tag === "div" ? table : createElement(tag)),
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../components/DataTable.js"),
    "utf8",
  );
  const DataTable = vm.runInNewContext(
    source.replace("export function DataTable", "function DataTable") +
      "\nDataTable;",
    { document },
  );
  const graphSource = fs.readFileSync(
    path.join(__dirname, "../graphState.js"),
    "utf8",
  );
  const graphState = await import(
    "data:text/javascript;base64," +
      Buffer.from(graphSource).toString("base64") +
      "#" +
      graphInstance++
  );
  const snapshots = [];
  graphState.subscribeToGraph((graph) => snapshots.push(graph));
  graphState.updateGraph();

  DataTable({
    startingRowCount: 1,
    onPointsChange: (points) => graphState.setGraphValue("points", points),
  });

  return { tableBody, graph: () => snapshots.at(-1) };
}

test("adding a point to the table adds it to the graph", async () => {
  const { tableBody, graph } = await setup();
  const [x, y] = tableBody.rows[0].querySelectorAll("input");
  x.value = "3";
  y.value = "7";
  tableBody.dispatchEvent({ type: "input" });

  assert.deepEqual(graph().points, [{ x: 3, y: 7 }]);
});
