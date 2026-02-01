const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.join(__dirname, "..");

const launchExtension = async () => {
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const serviceWorker =
    context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  const extensionId = serviceWorker.url().split("/")[2];

  return { context, extensionId };
};

test("sidepanel smoke", async () => {
  const { context, extensionId } = await launchExtension();
  const page = await context.newPage();

  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByRole("heading", { name: "Jot it!" })).toBeVisible();
  await expect(page.locator("#meetingName")).toBeVisible();
  await page.getByText("Options").click();
  await expect(page.locator("#templateSelect")).toBeVisible();
  await expect(page.locator("#exportFormat")).toBeVisible();

  const dateDisplay = page.locator("#meetingDateDisplay");
  await expect(dateDisplay).not.toHaveValue("");

  await page.locator("#openDatePicker").click();
  await expect(page.locator("#datePicker")).toHaveClass(/is-open/);
  await expect(page.locator("#timeMinute option")).toHaveCount(60);
  await page.locator("#dateToday").click();
  await page.locator("#dateDone").click();
  await expect(page.locator("#datePicker")).not.toHaveClass(/is-open/);

  const editor = page.locator("#notes");
  await editor.click();
  await page.keyboard.type("Hello ");
  await page.locator('[data-format="bold"]').click();
  await page.keyboard.type("bold");
  const html = await editor.evaluate((el) => el.innerHTML);
  expect(html).toMatch(/<b>|<strong>/);

  await context.close();
});
