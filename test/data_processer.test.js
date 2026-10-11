
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Load the existing browser JavaScript without modifying it.
const source = fs.readFileSync(
    path.join(__dirname, "../data_processer.js"),
    "utf8"
);
const parseCSV = vm.runInThisContext(source + "\nparseCSV;");

// Test 1: Valid CSV with a good format.
test("parses valid CSV", () => {
    const result = parseCSV("Time,Temperature\n1,72\n2,75");

    assert.equal(result.success, true);
    assert.deepStrictEqual(result.headers, {
        x: "Time",
        y: "Temperature"
    });
    assert.deepStrictEqual(result.data, [
        { x: 1, y: 72 },
        { x: 2, y: 75 }
    ]);
});

// Test 2: Invalid numeric value
test("rejects non-numeric values", () => {
    const result = parseCSV("Time,Temperature\n1,hello"); // invalid value "hello"

    assert.equal(result.success, false);
    assert.match(result.error, /not a valid number/);
});

// Test 3: Missing value
test("rejects missing values", () => {
    const result = parseCSV("Time,Temperature\n1,"); // missing value for Temperature

    assert.equal(result.success, false);
    assert.match(result.error, /missing value/);
});

//Test 4: CSV is empty
test("rejects empty CSV", () => {
    const result = parseCSV("");

    assert.equal(result.success, false);
});

// Test 5: CSV with extra columns
test("rejects CSV with extra columns", () => {
    const result = parseCSV("Time,Temperature,Humidity\n1,72,50");

    assert.equal(result.success, false);
});


// Test 6: CSV with Windows line endings
test("handles Windows line endings", () => {
    const result = parseCSV("Time,Temperature\r\n1,72\r\n2,75");

    assert.equal(result.success, true);
    assert.equal(result.data.length, 2);
});

