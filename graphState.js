//default value of the graph
const graph = {
  points: [],
  type: 'line',
  title: '',
  pointColor: '#000000',
  lineColor: '#000000',
  axesColor: '#000000',
  pointStyle: 'circle',
  xAxisName: '',
  yAxisName: '',
  range: { xMin: null, xMax: null, yMin: null, yMax: null },
};

const subscribers = [];

// Register a function that takes the graph as an input and does something with it
export function subscribeToGraph(subscriber) {
  subscribers.push(subscriber);
}

export function setGraphValue(key, value) {
  if (!Object.hasOwn(graph, key)) throw new Error(`value does not exist in graph`);
  graph[key] = value;
  updateGraph();
}

export function updateGraph() {
  const graphCopy = structuredClone(graph);
  for (const subscriber of subscribers) subscriber(graphCopy);
}
