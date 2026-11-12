import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

function logOfflineErrors(page: Page) {
  page.on("pageerror", (error) =>
    console.info("ECHO_PAGE_ERROR", error.message),
  );
  page.on("requestfailed", (request) =>
    console.info("ECHO_REQUEST_FAILED", request.url(), request.failure()),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.info("ECHO_BROWSER_CONSOLE", message.text());
  });
}
test("phrase lifecycle, persistence, favorites, theme, language and backup", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Make yourself heard." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New phrase", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Phrase", exact: true })
    .fill("My test phrase");
  await dialog.getByLabel("Add to favorites").check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "My test phrase", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My test phrase", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search phrases" })
    .fill("My test phrase");
  await page.getByRole("button", { name: "Edit phrase", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Phrase", exact: true })
    .fill("My edited phrase");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search phrases" }).fill("edited");
  await expect(
    page.getByRole("button", { name: "My edited phrase" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  expect((await download).suggestedFilename()).toContain("echo-backup");
  await page.getByLabel("Interface language").selectOption("ru");
  await expect(
    page.getByRole("heading", { name: "Настройки", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Библиотека", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск фраз" }).fill("edited");
  await page
    .getByRole("button", { name: "Удалить фразу", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "My edited phrase" }),
  ).toHaveCount(0);
});
test("category creation, rename and deletion", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "New category", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Work");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("button", { name: "Rename Work", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Meetings");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rename Meetings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete category Meetings" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rename Meetings" }),
  ).toHaveCount(0);
});
test("mobile screens fit, voice states are honest, offline reload works", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // ready means an active worker exists, but it may not yet control the page.
  await expect.poll(() => page.evaluate(
    () => Boolean(navigator.serviceWorker.controller),
  )).toBe(true);
  await page.reload();
  for (const label of [
    "Home",
    "Communicate",
    "Voice Studio",
    "Library",
    "Settings",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-voice.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  logOfflineErrors(page);
  await context.setOffline(true);
  const offlineResponse = await page.reload();
  const offlineInfo = await page.evaluate(async () => ({
    body: document.body?.innerText.slice(0, 500),
    controlled: Boolean(navigator.serviceWorker?.controller),
    caches: await caches.keys(),
    cacheFiles: await (async () => {
      const names = await caches.keys();
      const cached = names[0] && await caches.open(names[0]);
      return cached ? (await cached.keys()).map((r) => new URL(r.url).pathname) : [];
    })(),
    scripts: Array.from(document.scripts).map((script) => script.src),
    url: location.href,
  }));
  console.info("ECHO_OFFLINE_DIAGNOSTIC", JSON.stringify({
    ...offlineInfo,
    responseStatus: offlineResponse?.status(),
  }));
  await expect(
    page.getByRole("heading", { name: "Make yourself heard." }),
  ).toBeVisible();
});

test("basic accessibility across all screens and dialog", async ({ page }) => {
  await page.goto("./");
  for (const label of [
    "Home",
    "Communicate",
    "Voice Studio",
    "Library",
    "Settings",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "New phrase", exact: true }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

test("browser recording, playback, persistence and backup restore", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.goto("./");
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await page.getByLabel("Recording name").fill("Personal greeting");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop & save", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stop & save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Personal greeting/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Personal greeting/ }).click();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((element) => (element as HTMLAudioElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await page.reload();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Personal greeting/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const backup = await downloaded;
  const path = await backup.path();
  if (!path) throw new Error("No backup downloaded");
  await page.getByRole("button", { name: "Delete all personal data" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles(path);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText("Backup restored.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Personal greeting/ }),
  ).toBeVisible();
});
test("dark theme contrast and desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  for (const label of [
    "Home",
    "Communicate",
    "Voice Studio",
    "Library",
    "Settings",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: "test-results/desktop-dark.png",
    fullPage: true,
  });
});

test("deep links, browser history and first-load offline assets", async ({
  page,
  context,
}) => {
  await page.goto("./#library");
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // ready means an active worker exists, but it may not yet control the page.
  await expect.poll(() => page.evaluate(
    () => Boolean(navigator.serviceWorker.controller),
  )).toBe(true);
  logOfflineErrors(page);
  await context.setOffline(true);
  const offlineResponse = await page.reload();
  const offlineInfo = await page.evaluate(async () => ({
    body: document.body?.innerText.slice(0, 500),
    controlled: Boolean(navigator.serviceWorker?.controller),
    caches: await caches.keys(),
    cacheFiles: await (async () => {
      const names = await caches.keys();
      const cached = names[0] && await caches.open(names[0]);
      return cached ? (await cached.keys()).map((r) => new URL(r.url).pathname) : [];
    })(),
    scripts: Array.from(document.scripts).map((script) => script.src),
    url: location.href,
  }));
  console.info("ECHO_OFFLINE_DIAGNOSTIC", JSON.stringify({
    ...offlineInfo,
    responseStatus: offlineResponse?.status(),
  }));
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
});
