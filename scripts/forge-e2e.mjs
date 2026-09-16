#!/usr/bin/env node
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const APP = process.env.FORGE_URL || "http://127.0.0.1:8080/";
const MOCK = process.env.MOCK_COMFY || "http://127.0.0.1:8188";

async function waitFor(fn, ms = 20000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout: ${last}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const shots = "/workspace/screenshots";
mkdirSync(shots, { recursive: true });

try {
  await fetch(`${MOCK}/reset`);
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const alive = await fetch(`${MOCK}/system_stats`).then((r) => r.ok);
  if (!alive) throw new Error("mock Comfy is not up");

  const box = page.getByPlaceholder(/What should we imagine/i);
  await box.click();
  await box.fill("alice in an alley, photoreal");
  await page.getByRole("button", { name: /^Generate$/ }).click();

  await waitFor(async () => {
    const jobs = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    return jobs.length >= 1 ? jobs : null;
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${shots}/e2e-t2i.png`, fullPage: true });

  const stageImg = page.locator("img").filter({ hasNot: page.locator("[alt='']") }).first();
  const anyImg = page.locator(".relative img, img").first();
  await waitFor(async () => (await anyImg.count()) > 0);

  const edit = page.getByRole("button", { name: "Edit this", exact: true });
  await waitFor(async () => (await edit.count()) > 0 && (await edit.isVisible()));
  await edit.click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Edit photo/i }).first().waitFor({ timeout: 5000 });

  await page.getByPlaceholder("the shirt", { exact: true }).fill("the shirt");
  await page.getByPlaceholder("a red jacket", { exact: true }).fill("a red jacket");
  const gen = page.getByRole("button", { name: /Generate|Queue another/i }).first();
  await gen.click();

  const jobs = await waitFor(async () => {
    const list = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    const edit = list.find((j) => j.load);
    return list.length >= 2 && edit ? list : null;
  }, 25000);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${shots}/e2e-i2i.png`, fullPage: true });

  const t2i = jobs.find((j) => !j.load);
  const i2i = jobs.find((j) => j.load);
  const report = {
    t2i: {
      loadImage: t2i.load,
      denoise: t2i.denoise,
      classes: Object.values(t2i.graph).map((n) => n.class_type),
    },
    i2i: {
      loadImage: i2i.load,
      denoise: i2i.denoise,
      classes: Object.values(i2i.graph).map((n) => n.class_type),
    },
  };
  writeFileSync(`${shots}/e2e-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (t2i.load) throw new Error("t2i should not LoadImage");
  if (t2i.denoise !== 1) throw new Error(`t2i denoise should be 1, got ${t2i.denoise}`);
  if (!i2i.load) throw new Error("edit pass did not LoadImage — i2i never ran");
  if (!(i2i.denoise > 0 && i2i.denoise < 1)) {
    throw new Error(`i2i denoise should be between 0 and 1, got ${i2i.denoise}`);
  }
  if (!/shirt|jacket/i.test(i2i.text || "")) {
    throw new Error(`i2i prompt missing the edit: ${i2i.text}`);
  }
  console.log("E2E PASS: generate (t2i) then edit (i2i) both queued");

  await fetch(`${MOCK}/reset`);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const dropPath = "/tmp/forge-drop.png";
  writeFileSync(dropPath, png);
  await page.getByRole("button", { name: /Edit photo/i }).first().click();
  await page.waitForTimeout(300);
  await page.setInputFiles('input[type="file"]', dropPath);
  await page.waitForTimeout(400);
  const changeBox = page.getByPlaceholder("remove the shirt, add a red jacket");
  await changeBox.fill("remove the shirt, add a red jacket");
  await page.getByRole("button", { name: /Generate|Queue another|Run /i }).first().click();
  const dropJobs = await waitFor(async () => {
    const list = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    return list.find((j) => j.load) ? list : null;
  }, 20000);
  const dropped = dropJobs.find((j) => j.load);
  if (!dropped) throw new Error("drop + edit did not LoadImage");
  if (!(dropped.denoise > 0 && dropped.denoise < 1)) throw new Error(`drop i2i denoise ${dropped.denoise}`);
  if (!/shirt|jacket/i.test(dropped.text || "")) throw new Error(`drop i2i text: ${dropped.text}`);
  console.log("E2E PASS: drop still + type change + i2i queued");
} catch (err) {
  await page.screenshot({ path: `${shots}/e2e-fail.png`, fullPage: true }).catch(() => {});
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
} finally {
  await browser.close();
}
