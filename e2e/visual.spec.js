/**
 * Basic visual coverage: one representative state per UI region.
 * Functional flows live in smoke.spec.js and graph-export.spec.js.
 *
 * Adding a scenario:
 * 1. Add a test to the matching describe block below.
 * 2. Prepare its state through UI controls; reuse samples/ where possible.
 * 3. Assert readiness, clearFocus(), then capture only the relevant region:
 *      await expect(page.locator('#chart'))
 *        .toHaveScreenshot(['chart', 'your-scenario.png']);
 * 4. Generate on Ubuntu 24.04 / Chromium, inspect the image, and commit it:
 *      npx playwright test e2e/visual.spec.js --project=chromium --update-snapshots
 *
 * Baselines document reviewed, expected UI. Fix known visual defects before
 * adding their regression screenshots. Normal runs never update baselines.
 */
const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

// Shared environment: stable viewport and offline fonts for every scenario.

test.skip(process.platform !== "linux", "Visual baselines are Linux-only.");
test.use({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "en-US",
  timezoneId: "UTC",
  headless: true,
});

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baselines are Chromium-only.");
  // Avoid network-dependent font substitution; exercise the offline fallback.
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#graph-settings")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

// Shared preparation helpers. Keep scenario-specific settings in the tests.

/** Remove incidental input focus and button hover before capturing the UI. */
async function clearFocus(page) {
  await page.locator("header strong").click();
  await page.mouse.move(0, 0);
}

/** Upload a repository CSV and wait for both status and rendered points. */
async function loadSample(page, filename, pointCount) {
  await page
    .getByLabel("Load CSV")
    .setInputFiles(path.join(__dirname, "..", "samples", filename));
  await expect(page.locator("#csv-status")).toContainText(
    `Parsed ${pointCount} points.`,
  );
  await expect(page.locator("#chart .data-point")).toHaveCount(pointCount);
}

/** Enter a small custom dataset when the existing samples do not fit a scenario. */
async function enterPoints(page, points) {
  for (let index = 0; index < points.length; index++) {
    if (index >= 3)
      await page.getByRole("button", { name: "Add row", exact: true }).click();
    await page
      .getByLabel(`X ${index + 1}`, { exact: true })
      .fill(String(points[index][0]));
    await page
      .getByLabel(`Y ${index + 1}`, { exact: true })
      .fill(String(points[index][1]));
  }
  await expect(page.locator("#chart .data-point")).toHaveCount(points.length);
}

/** Range controls commit on blur; Tab ensures the final value is applied. */
async function setRanges(page, values) {
  for (const [label, value] of Object.entries(values)) {
    const input = page.getByLabel(label, { exact: true });
    await input.fill(String(value));
    await input.press("Tab");
  }
}

/** Download the real PNG and display it at native size for a visual assertion.
 * This replaces the editor page, so call it after all graph settings are ready.
 */
async function downloadedPng(page, testInfo) {
  await page.getByLabel("Format", { exact: true }).selectOption("png");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save graph", exact: true }).click();
  const download = await downloadPromise;
  const filename = testInfo.outputPath("styled-export.png");
  await download.saveAs(filename);
  expect(await download.failure()).toBeNull();

  const bytes = await readFile(filename);

  // Compare the downloaded image, not the editor preview: export inlines styles
  // and rasterizes separately. Display at native resolution to avoid resampling.
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.setContent(
    '<style>body { margin: 0; } img { display: block; }</style><img alt="Downloaded graph">',
  );
  const image = page.locator("img");
  const dimensions = await image.evaluate(async (element, base64) => {
    element.src = `data:image/png;base64,${base64}`;
    await element.decode();
    return [element.naturalWidth, element.naturalHeight];
  }, bytes.toString("base64"));
  expect(dimensions).toEqual([1600, 800]);
  return image;
}

// Each group maps directly to a baseline subfolder and a screenshot boundary.

test.describe("page", () => {
  // Whole editor: layout, settings, uploaded data and the default graph.
  test("sample editor layout", async ({ page }) => {
    await loadSample(page, "test.csv", 5);
    await clearFocus(page);
    await expect(page).toHaveScreenshot(["page", "sample-editor.png"]);
  });
});

test.describe("chart", () => {
  // Plot only: origin axes, positive/negative ticks and grid alignment.
  test("four-quadrant grid", async ({ page }) => {
    await enterPoints(page, [
      [-4, -3],
      [-2, 4],
      [2, -2],
      [4, 3],
    ]);
    await setRanges(page, { "X min": -5, "X max": 5, "Y min": -5, "Y max": 5 });
    await page.getByLabel("Show grid", { exact: true }).check();
    await expect(page.locator("#chart .chart-grid")).toBeVisible();
    await clearFocus(page);
    await expect(page.locator("#chart")).toHaveScreenshot([
      "chart",
      "four-quadrants-grid.png",
    ]);
  });
});

test.describe("chart-panel", () => {
  // Plot plus toolbar: transparency checkerboard and JPEG background hint.
  test("transparent scatter with JPEG hint", async ({ page }) => {
    await loadSample(page, "test.csv", 5);
    await page.getByLabel("Scatter", { exact: true }).check();
    await page.getByLabel("Point style").selectOption("square");
    await page.getByLabel("Point color", { exact: true }).fill("#c02648");
    await page.getByLabel("Transparent background", { exact: true }).check();
    await expect(page.locator("#export-hint")).toBeVisible();
    await expect(
      page.getByLabel("Background color", { exact: true }),
    ).toBeDisabled();
    await clearFocus(page);
    await expect(page.locator(".chart-panel")).toHaveScreenshot([
      "chart-panel",
      "transparent-square.png",
    ]);
  });
});

test.describe("data-table", () => {
  // Table only: series column, CSV headers and the collapsed-table button.
  test("large sample collapsed to ten rows", async ({ page }) => {
    await loadSample(page, "agents-vs-bugs-large.csv", 3000);
    await expect(page.locator("#data-table tbody tr:visible")).toHaveCount(10);
    await expect(
      page.getByRole("button", { name: "Show all 3000 rows", exact: true }),
    ).toBeVisible();
    await clearFocus(page);
    await expect(page.locator("#data-table")).toHaveScreenshot([
      "data-table",
      "collapsed.png",
    ]);
  });
});

test.describe("export", () => {
  // Actual downloaded image: title, labels, colors, point style and grid.
  test("styled PNG", async ({ page }, testInfo) => {
    await loadSample(page, "test.csv", 5);
    await page.getByLabel("Show grid", { exact: true }).check();
    for (const [label, value] of [
      ["Title", "Styled export"],
      ["X axis name", "Time"],
      ["Y axis name", "Value"],
      ["Point color", "#c02648"],
      ["Line color", "#2563eb"],
      ["Axes color", "#334155"],
      ["Background color", "#f1f5f9"],
    ]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByLabel("Point style").selectOption("triangle");
    const image = await downloadedPng(page, testInfo);
    await expect(image).toHaveScreenshot(["export", "styled-png.png"]);
  });
});
