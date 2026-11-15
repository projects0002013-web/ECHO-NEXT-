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
test("ECHO brand logo and Kokoro voice selection render and persist", async ({ page }) => {
  await page.goto("./");
  const brandLogo = page.locator(".brand-mark-logo img").first();
  await expect(brandLogo).toHaveAttribute("src", /icon\.svg$/);
  await expect.poll(() => brandLogo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const shortcuts = page.locator(".voice-engine-nav");
  await expect(shortcuts.getByRole("button", { name: "System TTS" })).toBeVisible();
  await shortcuts.getByRole("button", { name: "Kokoro" }).click();
  await expect(page.locator("#kokoro-voice-engine")).toBeInViewport();
  await shortcuts.getByRole("button", { name: "Supertonic" }).click();
  await expect(page.locator("#supertonic-voice-engine")).toBeInViewport();
  await shortcuts.getByRole("button", { name: "My recordings" }).click();
  await expect(page.locator("#recorded-voice-panel")).toBeInViewport();
  await shortcuts.getByRole("button", { name: "System TTS" }).click();
  await expect(page.locator("#system-voice-engine")).toBeInViewport();
  const panel = page.getByRole("region", { name: "Local AI speech synthesis" });
  await expect(panel.getByRole("heading", { name: "Find your voice" })).toBeVisible();
  await expect(panel.locator(".voice-choice")).toHaveCount(28);
  await panel.getByRole("button", { name: "UK English", exact: true }).click();
  await expect(panel.locator(".voice-choice")).toHaveCount(8);
  await panel.getByRole("button", { name: "Female", exact: true }).click();
  await expect(panel.locator(".voice-choice")).toHaveCount(4);
  await panel.getByRole("button", { name: "All", exact: true }).click();
  await expect(panel.locator(".voice-choice")).toHaveCount(8);
  await panel.getByPlaceholder("Search by name, accent or voice type").fill("Emma");
  await expect(panel.locator(".voice-choice")).toHaveCount(1);
  await panel.locator(".voice-choice-select").click();
  await expect(panel.locator(".voice-choice.selected .voice-choice-copy strong")).toHaveText("Emma");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await expect(page.getByRole("region", { name: "Local AI speech synthesis" }).locator(".voice-choice.selected .voice-choice-copy strong")).toHaveText("Emma");
  await page.reload();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  await expect(page.getByRole("region", { name: "Local AI speech synthesis" }).locator(".voice-choice.selected .voice-choice-copy strong")).toHaveText("Emma");
});

test("system voice selection has a clear searchable choice interface", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const picker = page.locator(".system-voice-picker");
  await expect(picker.getByRole("button", { name: /Device default/ })).toBeVisible();
  await expect(picker.getByPlaceholder("Search by name or language")).toBeVisible();
  await expect(picker.getByRole("button", { name: "Offline", exact: true })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Online", exact: true })).toBeVisible();
});

test("Supertonic voice preferences survive a full app reload", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const panel = page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" });
  await panel.getByRole("button", { name: /Male M3/ }).click();
  await panel.getByLabel("Speech language").selectOption("ru");
  await panel.getByLabel("Quality steps").selectOption("12");
  await panel.getByLabel("Adaptive pacing").uncheck();
  const speedControl = panel.getByLabel("Speech speed");
  await speedControl.focus();
  for (let step = 0; step < 7; step++) await speedControl.press("ArrowRight");
  await expect(panel.getByLabel("Speech speed")).toHaveValue("1.35");
  await page.reload();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const restored = page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" });
  await expect(restored.getByRole("button", { name: "Male M3" })).toHaveAttribute("aria-pressed", "true");
  await expect(restored.getByLabel("Speech language")).toHaveValue("ru");
  await expect(restored.getByLabel("Quality steps")).toHaveValue("12");
  await expect(restored.getByLabel("Adaptive pacing")).not.toBeChecked();
  await expect(restored.getByLabel("Speech speed")).toHaveValue("1.35");
});

test("partial Supertonic cache resumes only missing assets", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const cache = await caches.open("echo-supertonic-3-v1");
    const root = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46";
    await cache.put(`${root}/onnx/duration_predictor.onnx`, new Response("cached"));
    await cache.put(`${root}/voice_styles/F1.json`, new Response("{}"));
  });
  await page.reload();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const panel = page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" });
  await expect(panel.getByRole("button", { name: "Resume setup (missing files only)" })).toBeEnabled();
  await expect(panel.getByText(/Saved locally: 1\/6 model files and 1\/10 voice styles/)).toBeVisible();
  await expect(panel.getByRole("button", { name: /Download & load \(~400 MB\)/ })).toHaveCount(0);
});

test("cached Supertonic files are offered for reload after app restart", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const cache = await caches.open("echo-supertonic-3-v1");
    const root = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46";
    const files = ["duration_predictor.onnx", "text_encoder.onnx", "vector_estimator.onnx", "vocoder.onnx", "tts.json", "unicode_indexer.json"];
    for (const file of files) await cache.put(`${root}/onnx/${file}`, new Response("cached"));
    for (const voice of ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"]) {
      await cache.put(`${root}/voice_styles/${voice}.json`, new Response("{}"));
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "Voice Studio", exact: true }).click();
  const panel = page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" });
  await expect(panel.getByText("Cached", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Load cached model" })).toBeEnabled();
});

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
  await expect(page.getByRole("heading", { name: "Make yourself heard." })).toBeVisible();
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
  await expect(page.getByRole("dialog")).toBeHidden();
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
  await expect(page.getByRole("heading", { name: "Neural voice synthesis" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Local AI speech synthesis" }).getByRole("button", { name: "Generate speech" })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Supertonic 3 multilingual neural speech" }).getByRole("button", { name: /Download & load/ })).toBeEnabled();
  await expect(page.getByText(/This does not clone a person/)).toBeVisible();
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


test("a first phrase can be saved after personal data has been cleared", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Delete all personal data" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "New phrase", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/General category will be created automatically/i)).toBeVisible();
  await dialog.getByRole("textbox", { name: "Phrase", exact: true }).fill("A fresh start");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Communicate", exact: true }).click();
  await expect(page.getByRole("button", { name: "A fresh start", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename General" })).toBeVisible();
});

test("mobile composer keeps voice selection and speaking controls easy to reach", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("./");
  await expect(page.locator(".composer-shortcut")).toBeVisible();
  await expect(page.locator(".voice-chip")).toBeVisible();
  await expect(page.locator(".composer-actions .primary")).toBeVisible();
  await expect(page.locator(".composer-actions .primary")).toHaveCSS("min-height", "46px");
});
