const { test, expect } = require("@playwright/test");

test("opens the website", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Simpligraph");
  await expect(page.getByLabel("X 1")).toBeVisible();
});

test("plots a graph", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("X 1").fill("1");
  await page.getByLabel("Y 1").fill("2");
  await page.getByLabel("X 2").fill("3");
  await page.getByLabel("Y 2").fill("4");

  await expect(page.locator("#chart .data-point")).toHaveCount(2);
  await expect(page.locator("#chart .data-line")).toBeVisible();
});

test("loads a CSV file and plots it", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[name="csv"]').setInputFiles({
    name: "temps.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Time,Temperature\n1,72\n2,75\n3,73"),
  });

  await expect(page.getByRole("status")).toHaveText(
    "Parsed 3 points. X: Time, Y: Temperature",
  );
  await expect(page.locator("#chart .data-point")).toHaveCount(3);
  await expect(page.getByLabel("X 1")).toHaveValue("1");
  await expect(page.getByLabel("X axis name")).toHaveValue("Time");
  await expect(page.getByRole("columnheader", { name: "Time" })).toBeVisible();
});
