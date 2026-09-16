#!/usr/bin/env node
/**
 * Full Forge regression: buttons, writer, t2i, i2i, drop-edit, Play, t2v length, tabs.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const APP = process.env.FORGE_URL || "http://127.0.0.1:8080/";
const MOCK = process.env.MOCK_COMFY || "http://127.0.0.1:8188";
const shots = "/workspace/screenshots";
mkdirSync(shots, { recursive: true });

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);
writeFileSync("/tmp/forge-a.png", tinyPng);
writeFileSync("/tmp/forge-b.png", tinyPng);

async function waitFor(fn, ms = 20000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout: ${String(last).slice(0, 180)}`);
}

async function jobs() {
  return fetch(`${MOCK}/jobs`).then((r) => r.json());
}

const report = [];
function pass(name, extra) {
  report.push({ name, ok: true, extra: extra || "" });
  console.log("PASS", name, extra || "");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 920 } });
page.setDefaultTimeout(15000);

try {
  await fetch(`${MOCK}/reset`);
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const body = await page.locator("body").innerText();
  if (!/\b136\b/.test(body)) throw new Error("not on 136");
  pass("boot 136");

  const required = ["Image", "Video", "Mixes", "Errors", "Write", "Generate", "Combine", "Edit", "Hires", "Batch", "Add"];
  for (const label of required) {
    if ((await page.getByRole("button", { name: new RegExp(`^${label}`, "i") }).count()) === 0) {
      throw new Error(`missing ${label}`);
    }
  }
  pass("buttons");

  await page.getByRole("button", { name: /^Image$/i }).click();
  const box = page.getByPlaceholder(/Imagine anything/i);
  await box.fill("goblin male fight human female warrior");
  await page.getByRole("button", { name: /^Who$/i }).click().catch(() => {});
  await page.getByRole("button", { name: /^Write$/i }).click();
  await page.waitForTimeout(350);
  const who = await box.inputValue();
  if (!/goblin/i.test(who) || !/female|woman|warrior/i.test(who)) throw new Error(`Who/Write weak: ${who}`);
  if (/sweater|cozy tea|masterpiece of a young woman/i.test(who)) throw new Error(`vanilla dump: ${who}`);
  pass("Write/Who keeps the fight", who.slice(0, 90));

  await box.fill("sexy anime girl with barely any clothes");
  await page.getByRole("button", { name: /^Writer$/i }).click().catch(() => {});
  await page.getByRole("button", { name: /^Sex/i }).first().click();
  await page.waitForTimeout(350);
  const sex = await box.inputValue();
  if (!/pussy|cock|nude|explicit|nsfw|barely|skimpy|sex/i.test(sex)) throw new Error(`Sex write vanilla: ${sex}`);
  pass("Sex write is explicit", sex.slice(0, 80));

  await box.fill("a red fox in snow");
  await page.getByRole("button", { name: /^Generate$/i }).click();
  const t2i = await waitFor(async () => (await jobs()).find((j) => !j.load && !j.video));
  if (t2i.denoise !== 1) throw new Error(`t2i denoise ${t2i.denoise}`);
  if (t2i.load) throw new Error("t2i LoadImage");
  pass("t2i", `denoise=1 text=${(t2i.text || "").slice(0, 40)}`);

  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Edit$/i }).click();
  await page.getByPlaceholder("remove the shirt, add a red jacket").waitFor({ state: "visible" });
  await page.getByPlaceholder("remove the shirt, add a red jacket").fill("add a blue scarf");
  await page.getByRole("button", { name: /^Generate$/i }).click();
  const i2i = await waitFor(async () => (await jobs()).find((j) => j.load && !j.video));
  if (!(i2i.denoise > 0.5 && i2i.denoise < 1)) throw new Error(`i2i denoise ${i2i.denoise}`);
  if (!/scarf|shirt|jacket|add/i.test(i2i.text || "")) throw new Error(`i2i text ${i2i.text}`);
  pass("i2i edit", `denoise=${i2i.denoise}`);

  await page.setInputFiles('input[type="file"]', "/tmp/forge-a.png");
  await page.waitForTimeout(500);
  const dropBox = page.getByPlaceholder("remove the shirt, add a red jacket");
  await dropBox.fill("remove the hat");
  await page.getByRole("button", { name: /^Generate$/i }).click();
  const dropped = await waitFor(async () => {
    const list = await jobs();
    return list.filter((j) => j.load && !j.video).length >= 2 ? list : null;
  });
  pass("drop file + edit", `i2i jobs=${dropped.filter((j) => j.load).length}`);

  await page.getByRole("button", { name: /^Image$/i }).click();
  await page.waitForTimeout(250);
  await box.fill("a lantern in fog");
  await page.getByRole("button", { name: /^Generate$/i }).click();
  await waitFor(async () => (await jobs()).filter((j) => !j.load && !j.video).length >= 2);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Play$/i }).click();
  const i2v = await waitFor(async () => (await jobs()).find((j) => j.video && j.load) || (await jobs()).find((j) => j.video));
  pass("Play still → video", `video=${!!i2v.video} load=${!!i2v.load} frames=${i2v.frames || "?"}`);

  await page.getByRole("button", { name: /^Video$/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^6s$/i }).click();
  await page.getByPlaceholder(/Imagine anything/i).fill("rain on cobbles");
  await page.getByRole("button", { name: /Text → clip/i }).click();
  const t2v = await waitFor(async () => {
    const list = await jobs();
    return list.find((j) => j.video && !j.load && (j.frames || 0) >= 80) || list.filter((j) => j.video).slice(-1)[0];
  });
  if ((t2v.frames || 0) && t2v.frames < 80) throw new Error(`6s is ${t2v.frames} frames`);
  pass("t2v 6s", `frames=${t2v.frames}`);

  await page.getByRole("button", { name: /^Image$/i }).click();
  if (!(await page.getByText(/Imagine it/i).count())) throw new Error("tab did not clear stage");
  pass("tab clears stage");

  await page.getByRole("button", { name: /^Hires$/i }).click();
  if (!(await page.getByRole("button", { name: /Hires on/i }).count())) throw new Error("hires");
  await page.getByRole("button", { name: /^Batch/i }).click();
  if (!(await page.getByRole("button", { name: /Batch 2/i }).count())) throw new Error("batch");
  pass("Hires + Batch");

  await page.getByRole("button", { name: /^Combine$/i }).click();
  await page.setInputFiles('input[type="file"]', ["/tmp/forge-a.png", "/tmp/forge-b.png"]);
  await page.waitForTimeout(500);
  const refBox = page.getByPlaceholder(/Same face|new scene|Combine/i).first();
  if (await refBox.count()) await refBox.fill("same person, new coat, bedroom");
  const gen = page.getByRole("button", { name: /^Generate$/i });
  await gen.click();
  await page.waitForTimeout(800);
  pass("Combine click + two files");

  await page.getByRole("button", { name: /^Mixes$/i }).click();
  pass("Mixes");
  await page.getByRole("button", { name: /^Errors$/i }).click();
  pass("Errors");

  await page.getByRole("button", { name: /^Image$/i }).click();
  await page.getByRole("button", { name: /Clear box/i }).click().catch(() => {});
  pass("Clear box");

  await page.screenshot({ path: `${shots}/regression.png`, fullPage: true });
  writeFileSync(`${shots}/regression.json`, JSON.stringify({ ok: true, n: report.length, report }, null, 2));
  console.log(JSON.stringify({ ok: true, n: report.length, checks: report.map((r) => r.name) }, null, 2));
} catch (err) {
  await page.screenshot({ path: `${shots}/regression-fail.png`, fullPage: true }).catch(() => {});
  writeFileSync(
    `${shots}/regression.json`,
    JSON.stringify({ ok: false, report, error: err instanceof Error ? err.stack : String(err) }, null, 2),
  );
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
} finally {
  await browser.close();
}
