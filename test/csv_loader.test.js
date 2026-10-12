const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const parser = fs.readFileSync(path.join(__dirname, '../data_processer.js'), 'utf8');
  const loaderPath = path.join(__dirname, '../csv_loader.js');
  const source = fs.existsSync(loaderPath) ? fs.readFileSync(loaderPath, 'utf8') : '';
  const api = vm.runInNewContext(parser + '\n' + source +
    '\n({ parseCSV, create: typeof createCsvLoader === "function" ? createCsvLoader : undefined })');
  assert.equal(typeof api.create, 'function', 'CSV loading must be available');
  const messages = [];
  const loader = api.create({ parse: api.parseCSV, onStatus: message => messages.push(message) });
  return { loader, messages };
}

function delayedFile(name) {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { file: { name, text: () => promise }, resolve, reject };
}

const csvFile = (text, name = 'data.csv') => new File([text], name, { type: 'text/csv' });

test('loads a real CSV File into parser results', async () => {
  const { loader, messages } = setup();
  const result = await loader.load(csvFile('Time,Temperature\n1,72\n2,75'));
  assert.equal(result.success, true);
  assert.equal(result.headers.x, 'Time');
  assert.equal(result.data.length, 2);
  assert.equal(result.data[1].y, 75);
  assert.match(messages[0], /Reading/);
  assert.match(messages.at(-1), /Parsed 2 points/);
});

test('reports parser errors instead of returning partial successful data', async () => {
  const { loader, messages } = setup();
  const result = await loader.load(csvFile('x,y\n1,'));
  assert.equal(result.success, false);
  assert.equal(result.data, undefined);
  assert.match(messages.at(-1), /missing value/);
});

test('shows warnings while returning successful points', async () => {
  const { loader, messages } = setup();
  const result = await loader.load(csvFile('x,y\n0x10,5'));
  assert.equal(result.data[0].x, 16);
  assert.match(messages.at(-1), /Warning:.*hex/);
});

test('handles a failed file read without rejecting the event handler', async () => {
  const { loader, messages } = setup();
  const failed = delayedFile('unreadable.csv');
  const pending = loader.load(failed.file);
  failed.reject(new Error('Cannot read file'));
  assert.equal(await pending, null);
  assert.match(messages.at(-1), /Unable to read/);
});

test('cancelled file selection preserves existing feedback', async () => {
  const { loader, messages } = setup();
  await loader.load(csvFile('1,2'));
  const before = [...messages];
  assert.equal(await loader.load(null), null);
  assert.deepEqual(messages, before);
});

test('the same file can be loaded more than once', async () => {
  const { loader } = setup();
  const file = csvFile('1,2');
  assert.equal((await loader.load(file)).data[0].x, 1);
  assert.equal((await loader.load(file)).data[0].y, 2);
});

test('an older successful read cannot replace a newer result or feedback', async () => {
  const { loader, messages } = setup();
  const old = delayedFile('old.csv');
  const pending = loader.load(old.file);
  const current = await loader.load(csvFile('3,4', 'new.csv'));
  const before = [...messages];
  old.resolve('1,2');
  assert.equal(await pending, null);
  assert.equal(current.data[0].x, 3);
  assert.deepEqual(messages, before);
});

test('an older failed read cannot replace newer success feedback', async () => {
  const { loader, messages } = setup();
  const old = delayedFile('old.csv');
  const pending = loader.load(old.file);
  await loader.load(csvFile('3,4'));
  const before = [...messages];
  old.reject(new Error('Old read failed'));
  assert.equal(await pending, null);
  assert.deepEqual(messages, before);
});

test('manual input invalidates a pending read and clears file feedback', async () => {
  const { loader, messages } = setup();
  const old = delayedFile('old.csv');
  const pending = loader.load(old.file);
  loader.cancel();
  assert.equal(messages.at(-1), '');
  old.resolve('1,2');
  assert.equal(await pending, null);
  assert.equal(messages.at(-1), '');
});

test('a successful load clears previous error feedback', async () => {
  const { loader, messages } = setup();
  await loader.load(csvFile('x,y\n1,'));
  await loader.load(csvFile('1,2'));
  assert.match(messages.at(-1), /Parsed 1 points/);
  assert.doesNotMatch(messages.at(-1), /missing value|Warning:/);
});
