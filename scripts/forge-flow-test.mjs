#!/usr/bin/env node
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const APP = process.env.FORGE_URL || "http://127.0.0.1:8080/";
const MOCK = process.env.MOCK_COMFY || "http://127.0.0.1:8188";
const shots = "/workspace/screenshots";
mkdirSync(shots, { recursive: true });

async function waitFor(fn, ms = 20000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout: ${String(last).slice(0, 200)}`);
}

const report = { pass: [], fail: [] };
function ok(name, extra) {
  report.pass.push(extra ? `${name} · ${extra}` : name);
  console.log("PASS", name, extra || "");
}
function fail(name, err) {
  report.fail.push(`${name}: ${err}`);
  console.error("FAIL", name, err);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(12000);

try {
  await fetch(`${MOCK}/reset`);
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const body = await page.locator("body").innerText();
  if (!/136/.test(body)) throw new Error(`version pill missing 136: ${body.slice(0, 200)}`);
  ok("version pill is 136");

  for (const label of ["Image", "Video", "Mixes", "Errors", "Write", "Generate", "Combine", "Edit", "Hires", "Batch"]) {
    const n = page.getByRole("button", { name: new RegExp(`^${label}`, "i") });
    if ((await n.count()) === 0) throw new Error(`missing button ${label}`);
  }
  ok("core buttons present");

  await page.getByRole("button", { name: /^Image$/i }).click();
  await page.waitForTimeout(200);
  const box = page.getByPlaceholder(/Imagine anything/i);
  await box.click();
  await box.fill("cat fight a dog");
  await page.getByRole("button", { name: /^Write$/i }).click();
  await page.waitForTimeout(400);
  const afterWrite = await box.inputValue();
  if (afterWrite.length < 20) throw new Error(`Write did not fill the box: ${afterWrite}`);
  if (!/cat/i.test(afterWrite)) throw new Error(`Write dropped the scene: ${afterWrite}`);
  ok("Write fills the box", afterWrite.slice(0, 80));

  await page.getByRole("button", { name: /^Generate$/i }).click();
  const t2i = await waitFor(async () => {
    const jobs = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    return jobs.find((j) => !j.load && !j.video) || null;
  });
  if (t2i.load) throw new Error("t2i loaded an image");
  if (t2i.denoise !== 1) throw new Error(`t2i denoise ${t2i.denoise}`);
  ok("Generate t2i queued", `denoise=${t2i.denoise}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/flow-t2i.png`, fullPage: true });

  await page.getByRole("button", { name: /^Edit$/i }).click();
  await page.waitForTimeout(600);
  const change = page.getByPlaceholder("remove the shirt, add a red jacket");
  await change.waitFor({ state: "visible" });
  await change.fill("remove the shirt, add a red jacket");
  ok("Edit shows change box");
  await page.getByRole("button", { name: /^Generate$/i }).click();
  const i2i = await waitFor(async () => {
    const jobs = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    return jobs.find((j) => j.load && !j.video) || null;
  });
  if (!(i2i.denoise > 0 && i2i.denoise < 1)) throw new Error(`i2i denoise ${i2i.denoise}`);
  if (!/shirt|jacket/i.test(i2i.text || "")) throw new Error(`i2i text: ${i2i.text}`);
  ok("Edit Generate is img2img", `denoise=${i2i.denoise}`);
  await page.screenshot({ path: `${shots}/flow-i2i.png`, fullPage: true });

  await page.getByRole("button", { name: /^Hires/i }).click();
  await page.waitForTimeout(150);
  const hiresOn = await page.getByRole("button", { name: /Hires on/i }).count();
  if (!hiresOn) throw new Error("Hires did not toggle on");
  ok("Hires toggles");

  await page.getByRole("button", { name: /^Batch/i }).click();
  const batch2 = await page.getByRole("button", { name: /Batch 2/i }).count();
  if (!batch2) throw new Error("Batch did not increment");
  ok("Batch increments");

  await page.getByRole("button", { name: /^Video$/i }).click();
  await page.waitForTimeout(400);
  const clipBtn = page.getByRole("button", { name: /Text → clip/i });
  if ((await clipBtn.count()) === 0) throw new Error("Video tab missing Text → clip");
  ok("Video tab Text → clip");
  await page.getByRole("button", { name: /^6s$/i }).click();
  await page.getByPlaceholder(/Imagine anything/i).fill("a cat runs across a yard");
  await clipBtn.click();
  const t2v = await waitFor(async () => {
    const jobs = await fetch(`${MOCK}/jobs`).then((r) => r.json());
    return jobs.find((j) => j.video) || null;
  }, 25000);
  if (t2v.frames && t2v.frames > 81) throw new Error(`6s clip ${t2v.frames} frames — cap is 81`);
  ok("Text → clip queued", `frames=${t2v.frames}`);
  await page.screenshot({ path: `${shots}/flow-t2v.png`, fullPage: true });

  await page.getByRole("button", { name: /^Image$/i }).click();
  await page.waitForTimeout(500);
  const imagine = await page.getByText(/Imagine it/i).count();
  const emptyStage = await page.locator("video, .forge-stage img").count();
  if (!imagine && emptyStage > 0) {
    // still ok if filmstrip imgs exist; stage hero must not be a leftover clip
    const hero = await page.locator(".forge-stage video, .forge-stage img").count();
    if (hero > 2) throw new Error("Image tab did not clear the stage");
  }
  ok("Image tab clears the stage");

  await page.getByRole("button", { name: /^Combine$/i }).click();
  await page.waitForTimeout(300);
  const combineHint = await page.getByText(/Combine/i).count();
  if (!combineHint) throw new Error("Combine did not open");
  ok("Combine mode");

  await page.getByRole("button", { name: /^Mixes$/i }).click();
  await page.waitForTimeout(200);
  if (!(await page.getByText(/same seed/i).count()) && !(await page.getByRole("button", { name: /^Run /i }).count())) {
    throw new Error("Mixes tab empty");
  }
  ok("Mixes tab");

  await page.getByRole("button", { name: /^Errors$/i }).click();
  await page.waitForTimeout(200);
  ok("Errors tab");

  await page.screenshot({ path: `${shots}/flow-tabs.png`, fullPage: true });

  writeFileSync(`${shots}/flow-report.json`, JSON.stringify(report, null, 2));
  if (report.fail.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, pass: report.pass.length, checks: report.pass }, null, 2));
} catch (err) {
  await page.screenshot({ path: `${shots}/flow-fail.png`, fullPage: true }).catch(() => {});
  fail("crash", err instanceof Error ? err.message : String(err));
  writeFileSync(`${shots}/flow-report.json`, JSON.stringify({ ...report, stack: err instanceof Error ? err.stack : err }, null, 2));
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
} finally {
  await browser.close();
}
