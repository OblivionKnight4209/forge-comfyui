import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { ComfyStatus } from "./types";
import { designClipAudio, ensureVoice, espeakVoice, ffmpegBed } from "./clip-sound";
import { isNotALora, isRealCheckpoint } from "./types";
import { sniffMediaMime } from "./media-mime";

function trimBase(url: string) {
  return url.replace(/\/+$/, "");
}

async function comfyFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 4000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${trimBase(baseUrl)}${path}`, {
      ...init,
      headers: {
        origin: trimBase(baseUrl),
        referer: `${trimBase(baseUrl)}/`,
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

function comboList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  if (input[0] === "COMBO" && input[1] && typeof input[1] === "object") {
    const opts = (input[1] as { options?: unknown }).options;
    if (Array.isArray(opts)) return opts.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(input[0])) {
    return (input[0] as unknown[]).filter((x): x is string => typeof x === "string");
  }
  return [];
}

function widgetOptions(info: Record<string, unknown> | undefined, widget: string): string[] {
  if (!info || typeof info !== "object") return [];
  const bag = info.input as
    | { required?: Record<string, unknown>; optional?: Record<string, unknown> }
    | undefined;
  return [
    ...comboList(bag?.required?.[widget]),
    ...comboList(bag?.optional?.[widget]),
  ];
}

function collectNamed(info: Record<string, Record<string, unknown>>, re: RegExp): string[] {
  const names = new Set<string>();
  for (const [cls, node] of Object.entries(info)) {
    if (!re.test(cls)) continue;
    const bag = (node as { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } })
      .input;
    for (const group of [bag?.required, bag?.optional]) {
      if (!group) continue;
      for (const [key, spec] of Object.entries(group)) {
        if (!/lora|ckpt|unet/i.test(key) && key !== "lora_name") continue;
        for (const n of comboList(spec)) {
          if (n && n !== "None" && n !== "none") names.add(n);
        }
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function comfyRoots(): string[] {
  const roots = [
    process.env.COMFY_ROOT,
    `${os.homedir()}/comfy/ComfyUI`,
    `${os.homedir()}/ComfyUI`,
  ].filter((x): x is string => Boolean(x));
  const extra: string[] = [];
  for (const root of roots) {
    const yaml = path.join(root, "extra_model_paths.yaml");
    try {
      const text = fs.readFileSync(yaml, "utf8");
      for (const m of text.matchAll(/base_path:\s*(.+)/g)) {
        const p = m[1]?.trim();
        if (p) extra.push(p.replace(/\/+$/, ""));
      }
      for (const m of text.matchAll(/checkpoints:\s*(.+)/g)) {
        const p = m[1]?.trim();
        if (p?.startsWith("/")) extra.push(p.replace(/\/+$/, ""));
      }
    } catch {
      /* none */
    }
  }
  return [...new Set([...roots, ...extra])];
}

function safetensorsComplete(abs: string): boolean {
  try {
    const st = fs.statSync(abs);
    if (st.size < 64) return false;
    if (!/\.safetensors$/i.test(abs)) return st.size > 1024;
    const fd = fs.openSync(abs, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    const n = Number(buf.readBigUInt64LE(0));
    if (!Number.isFinite(n) || n < 2 || n > 80_000_000) return false;
    return st.size >= 8 + n + 32;
  } catch {
    return false;
  }
}

function quarantineBadLoras(): string[] {
  const junk = path.join(os.homedir(), "comfy/not-models");
  const moved: string[] = [];
  try {
    fs.mkdirSync(junk, { recursive: true });
  } catch {
    return moved;
  }
  for (const root of comfyRoots()) {
    const dir = path.join(root, "models/loras");
    let ents: import("node:fs").Dirent[] = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      if (!ent.isFile()) continue;
      const src = path.join(dir, ent.name);
      let size = 0;
      try {
        size = fs.statSync(src).size;
      } catch {
        continue;
      }
      const badName = isNotALora(ent.name) || /\.part$/i.test(ent.name);
      const truncated = /\.safetensors$/i.test(ent.name) && !safetensorsComplete(src);
      const huge = size > 800 * 1024 * 1024;
      if (!badName && !truncated && !huge) continue;
      const dest = path.join(junk, ent.name);
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(src);
        else fs.renameSync(src, dest);
        moved.push(ent.name);
      } catch {
        /* leave it */
      }
    }
  }
  return moved;
}

function walkFiles(dir: string, base: string, ext: RegExp, out: string[]) {
  let ents: import("node:fs").Dirent[] = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, base, ext, out);
    else if (ext.test(ent.name)) out.push(path.relative(base, p).replaceAll("\\", "/"));
  }
}

function scanRel(rel: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const root of comfyRoots()) {
    const dir = path.join(root, rel);
    walkFiles(dir, dir, ext, out);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

export function resolveComfyMedia(folder: "input" | "output", name: string): string | null {
  const safe = name.replace(/\.\./g, "").replace(/^\/+/, "");
  if (!safe) return null;
  const baseName = path.basename(safe);
  for (const root of comfyRoots()) {
    const base = path.resolve(path.join(root, folder));
    const resolved = path.resolve(path.join(root, folder, safe));
    if (resolved.startsWith(base) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    const walk = (d: string, depth: number): string | null => {
      if (depth > 3) return null;
      let ents: import("node:fs").Dirent[] = [];
      try {
        ents = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return null;
      }
      for (const ent of ents) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) {
          const hit = walk(p, depth + 1);
          if (hit) return hit;
        } else if (ent.name === baseName || ent.name.replace(/_+\d+\./, ".") === baseName) {
          return p;
        }
      }
      return null;
    };
    const found = walk(base, 0);
    if (found) return found;
  }
  return null;
}

export function readComfyMedia(
  folder: "input" | "output",
  name: string,
): { mime: string; bytes: Buffer } | null {
  const p = resolveComfyMedia(folder, name);
  if (!p) return null;
  const bytes = fs.readFileSync(p);
  const mime = sniffMediaMime(p, bytes);
  return { mime, bytes };
}

export function readStillFromPath(src: string): string | null {
  if (!src || src.startsWith("data:")) return null;
  try {
    const u = new URL(src, "http://127.0.0.1");
    const name = u.searchParams.get("name") || u.searchParams.get("filename") || "";
    if (!name) return null;
    const folder: "input" | "output" =
      u.searchParams.get("folder") === "input" || u.searchParams.get("type") === "input" ? "input" : "output";
    const file = readComfyMedia(folder, name);
    if (!file) return null;
    return `data:${file.mime};base64,${file.bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export function listComfyRecent(opts?: { all?: boolean }): { folder: "input" | "output"; name: string; mtime: number }[] {
  const files: { folder: "input" | "output"; name: string; mtime: number }[] = [];
  const img = /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|mkv|m4v)$/i;
  for (const root of comfyRoots()) {
    for (const folder of ["input", "output"] as const) {
      const dir = path.join(root, folder);
      const walk = (d: string, rel: string, depth: number) => {
        if (depth > 3 || files.length > 600) return;
        let ents: import("node:fs").Dirent[] = [];
        try {
          ents = fs.readdirSync(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of ents) {
          const p = path.join(d, ent.name);
          const r = rel ? `${rel}/${ent.name}` : ent.name;
          if (ent.isDirectory()) walk(p, r, depth + 1);
          else if (img.test(ent.name)) {
            try {
              files.push({ folder, name: r.replaceAll("\\", "/"), mtime: fs.statSync(p).mtimeMs });
            } catch {
              /* skip */
            }
          }
        }
      };
      walk(dir, "", 0);
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  const seen = new Set<string>();
  const uniq = files.filter((f) => {
    const k = `${f.folder}:${f.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.slice(0, opts?.all ? 240 : 120);
}

export function shredComfyFile(folder: "input" | "output", name: string): { ok: boolean; message: string } {
  let safe = name.replace(/\.\./g, "").replace(/^\/+/, "");
  try {
    safe = decodeURIComponent(safe);
  } catch {
    /* keep */
  }
  if (!safe || safe.includes("\0")) return { ok: false, message: "bad name" };
  const folders = [...new Set([folder, "output", "input", "temp"])];
  const tried: string[] = [];
  for (const root of comfyRoots()) {
    for (const f of folders) {
      const resolved = path.resolve(path.join(root, f, safe));
      const base = path.resolve(path.join(root, f));
      if (!resolved.startsWith(base)) continue;
      tried.push(resolved);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
      const r = spawnSync("shred", ["-f", "-v", "-u", "-n", "3", "-z", "--", resolved], { encoding: "utf8" });
      if (r.status === 0 || !fs.existsSync(resolved)) {
        return { ok: true, message: `shred ${resolved}` };
      }
      try {
        fs.unlinkSync(resolved);
        return { ok: true, message: `deleted ${resolved} (shred failed: ${r.stderr || r.stdout || r.status})` };
      } catch (err) {
        return { ok: false, message: `could not delete ${resolved}: ${err instanceof Error ? err.message : "fail"}` };
      }
    }
  }
  return { ok: false, message: `not found: ${safe} (looked in input/output/temp)` };
}

function scanCheckpoints(): string[] {
  const out: string[] = [];
  const ext = /\.(safetensors|ckpt)$/i;
  const minBytes = 500 * 1024 * 1024;
  for (const root of comfyRoots()) {
    const dir = path.join(root, "models/checkpoints");
    const walk = (d: string, base: string) => {
      let ents: import("node:fs").Dirent[] = [];
      try {
        ents = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of ents) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) {
          walk(p, base);
          continue;
        }
        if (!ext.test(ent.name) || !isRealCheckpoint(ent.name)) continue;
        try {
          if (fs.statSync(p).size < minBytes) continue;
        } catch {
          continue;
        }
        out.push(path.relative(base, p).replaceAll("\\", "/"));
      }
    };
    walk(dir, dir);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

function rescueStrayLoras(): string[] {
  const moved: string[] = [];
  const ext = /\.(safetensors|ckpt)$/i;
  const minBytes = 500 * 1024 * 1024;
  for (const root of comfyRoots()) {
    const ckptDir = path.join(root, "models/checkpoints");
    const loraDir = path.join(root, "models/loras");
    let ents: import("node:fs").Dirent[] = [];
    try {
      ents = fs.readdirSync(ckptDir, { withFileTypes: true });
    } catch {
      continue;
    }
    try {
      fs.mkdirSync(loraDir, { recursive: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      if (!ent.isFile() || !ext.test(ent.name)) continue;
      const src = path.join(ckptDir, ent.name);
      let size = 0;
      try {
        size = fs.statSync(src).size;
      } catch {
        continue;
      }
      const stray = !isRealCheckpoint(ent.name) || size < minBytes;
      if (!stray) continue;
      const destDir = isNotALora(ent.name) ? path.join(os.homedir(), "comfy/not-models") : loraDir;
      try {
        fs.mkdirSync(destDir, { recursive: true });
      } catch {
        continue;
      }
      const dest = path.join(destDir, ent.name);
      try {
        if (fs.existsSync(dest)) {
          fs.unlinkSync(src);
        } else {
          fs.renameSync(src, dest);
        }
        moved.push(ent.name);
      } catch {
        /* leave it */
      }
    }
  }
  return moved;
}

export function scanDiskModels() {
  const rescued = rescueStrayLoras();
  const badLoras = quarantineBadLoras();
  if (rescued.length || badLoras.length) diskCache = null;
  const weights = /\.(safetensors|ckpt|pt|pth|sft|gguf)$/i;
  return {
    checkpoints: scanCheckpoints(),
    loras: scanRel("models/loras", weights).filter((n) => !isNotALora(n)),
    unets: [
      ...scanRel("models/unet", weights),
      ...scanRel("models/diffusion_models", weights),
    ],
    vaes: scanRel("models/vae", weights),
    clips: [
      ...scanRel("models/clip", weights),
      ...scanRel("models/text_encoders", weights),
    ],
    wildcards: scanRel("wildcards", /\.txt$/i).map((f) =>
      f.replace(/\.txt$/i, "").replace(/\\/g, "/"),
    ),
  };
}

export function readWildcardLines(name: string): string[] {
  const rel = name.endsWith(".txt") ? name : `${name}.txt`;
  for (const root of comfyRoots()) {
    const direct = path.join(root, "wildcards", rel);
    if (fs.existsSync(direct)) {
      return fs
        .readFileSync(direct, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    }
    const dir = path.join(root, "wildcards");
    const hits: string[] = [];
    walkFiles(dir, dir, /\.txt$/i, hits);
    const want = name.replace(/\.txt$/i, "").toLowerCase();
    const found = hits.find((h) => h.replace(/\.txt$/i, "").toLowerCase() === want);
    if (found) {
      return fs
        .readFileSync(path.join(dir, found), "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    }
  }
  return [];
}

export function expandWithDiskWildcards(
  prompt: string,
  seed: number,
  extra: { name: string; lines: string[] }[],
) {
  const needed = [...prompt.matchAll(/__([a-zA-Z0-9][a-zA-Z0-9 _./+-]{0,120}?)__/g)].map((m) => m[1] ?? "");
  const files = [...extra];
  const have = new Set(files.map((f) => f.name.toLowerCase()));
  for (const n of needed) {
    const key = n.toLowerCase();
    if (have.has(key)) continue;
    const lines = readWildcardLines(n);
    if (lines.length) {
      files.push({ name: n, lines });
      have.add(key);
    }
  }
  return files;
}

function wd14OnDisk() {
  for (const root of comfyRoots()) {
    try {
      for (const n of fs.readdirSync(path.join(root, "custom_nodes"))) {
        if (/wd14/i.test(n)) return true;
      }
    } catch {
      /* skip */
    }
  }
  return false;
}

export async function pingComfy(baseUrl: string): Promise<boolean> {
  try {
    let stats = await comfyFetch(baseUrl, "/system_stats", {}, 2500);
    if (!stats.ok) stats = await comfyFetch(baseUrl, "/api/system_stats", {}, 2500);
    return stats.ok;
  } catch {
    return false;
  }
}

let diskCache: { at: number; data: ReturnType<typeof scanDiskModels> } | null = null;
let infoCache: { at: number; info: Record<string, Record<string, unknown>> } | null = null;

function scanDiskModelsCached() {
  if (diskCache && Date.now() - diskCache.at < 60_000) return diskCache.data;
  const data = scanDiskModels();
  diskCache = { at: Date.now(), data };
  return data;
}

async function listComfyFolder(baseUrl: string, folder: string): Promise<string[]> {
  for (const p of [`/models/${folder}`, `/api/models/${folder}`]) {
    try {
      const res = await comfyFetch(baseUrl, p, {}, 8000);
      if (!res.ok) continue;
      const json: unknown = await res.json();
      if (!Array.isArray(json)) continue;
      return json.filter((x): x is string => typeof x === "string" && x.length > 0);
    } catch {
      /* next */
    }
  }
  return [];
}

export async function probeComfy(baseUrl: string): Promise<ComfyStatus> {
  const disk = scanDiskModelsCached();
  const diskCkpts = disk.checkpoints.filter(isRealCheckpoint);
  const empty = {
    checkpoints: diskCkpts,
    unets: disk.unets,
    loras: disk.loras,
    vaes: disk.vaes,
    clips: disk.clips,
    wildcards: disk.wildcards,
    taggerClass: wd14OnDisk() ? "WD14Tagger|pysssss" : "",
    taggerModels: [],
  };
  try {
    const alive = await pingComfy(baseUrl);
    if (!alive) {
      return {
        ok: false,
        message: `ComfyUI not answering. Disk still has ${diskCkpts.length} checkpoints.`,
        ...empty,
      };
    }
    const [ckptFolder, loraFolder, unetFolder] = await Promise.all([
      listComfyFolder(baseUrl, "checkpoints"),
      listComfyFolder(baseUrl, "loras"),
      listComfyFolder(baseUrl, "diffusion_models"),
    ]);
    let info: Record<string, Record<string, unknown>> = {};
    if (infoCache && Date.now() - infoCache.at < 120_000) {
      info = infoCache.info;
    } else {
      let infoRes = await comfyFetch(baseUrl, "/object_info", {}, 12000);
      if (!infoRes.ok) infoRes = await comfyFetch(baseUrl, "/api/object_info", {}, 12000);
      info = infoRes.ok ? ((await infoRes.json()) as Record<string, Record<string, unknown>>) : {};
      if (Object.keys(info).length) infoCache = { at: Date.now(), info };
    }
    const widgetCkpts = [
      ...widgetOptions(info.CheckpointLoaderSimple, "ckpt_name"),
      ...widgetOptions(info.CheckpointLoader, "ckpt_name"),
      ...collectNamed(info, /checkpointloader/i),
    ];
    const clips = [
      ...widgetOptions(info.DualCLIPLoader, "clip_name1"),
      ...widgetOptions(info.DualCLIPLoader, "clip_name2"),
      ...widgetOptions(info.CLIPLoader, "clip_name"),
      ...widgetOptions(info.CLIPLoaderGGUF, "clip_name"),
      ...disk.clips,
    ];
    const loras = [
      ...loraFolder,
      ...widgetOptions(info.LoraLoader, "lora_name"),
      ...widgetOptions(info.LoraLoaderModelOnly, "lora_name"),
      ...disk.loras,
    ].filter((n) => !isNotALora(n));
    const unets = [
      ...unetFolder,
      ...widgetOptions(info.UNETLoader, "unet_name"),
      ...widgetOptions(info.UnetLoaderGGUF, "unet_name"),
      ...disk.unets,
    ];
    const taggerClass =
      Object.keys(info).find((k) => k === "WD14Tagger|pysssss") ??
      Object.keys(info).find((k) => /wd14/i.test(k) && /tagger/i.test(k)) ??
      Object.keys(info).find((k) => /WD14Tagger/i.test(k)) ??
      (wd14OnDisk() ? "WD14Tagger|pysssss" : "");
    const taggerModels = taggerClass ? widgetOptions(info[taggerClass], "model") : [];
    const checkpoints = [...new Set([...ckptFolder, ...widgetCkpts, ...diskCkpts])].filter((n) =>
      isRealCheckpoint(n),
    );
    return {
      ok: true,
      message: `ComfyUI · ${checkpoints.length} checkpoints`,
      checkpoints,
      unets: [...new Set(unets)],
      loras: [...new Set(loras)].sort((a, b) => a.localeCompare(b)),
      vaes: [...new Set([...widgetOptions(info.VAELoader, "vae_name"), ...disk.vaes])],
      clips: [...new Set(clips)],
      wildcards: disk.wildcards,
      taggerClass,
      taggerModels,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unreachable";
    return {
      ok: false,
      message:
        msg.includes("abort") || msg.includes("fetch")
          ? `ComfyUI is not reachable. Disk still has ${diskCkpts.length} checkpoints.`
          : msg,
      ...empty,
    };
  }
}

function b64ToBlob(dataUrl: string): { blob: Blob; filenameExt: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Expected a data URL");
  const mime = m[1] ?? "image/png";
  const bin = Buffer.from(m[2] ?? "", "base64");
  const bytes = new Uint8Array(bin);
  const ext = mime.includes("video") ? "mp4" : mime.includes("jpeg") ? "jpg" : "png";
  return { blob: new Blob([bytes], { type: mime }), filenameExt: ext };
}

export async function uploadToComfy(
  baseUrl: string,
  dataUrl: string,
  filename: string,
): Promise<string> {
  const fromUrl = (() => {
    if (!dataUrl || dataUrl.startsWith("data:")) return null;
    try {
      const u = new URL(dataUrl, "http://127.0.0.1");
      const name = u.searchParams.get("name") || u.searchParams.get("filename") || filename;
      if (!name) return null;
      const folder: "input" | "output" =
        u.searchParams.get("folder") === "input" || u.searchParams.get("type") === "input" ? "input" : "output";
      const abs = resolveComfyMedia(folder, name);
      if (!abs) return null;
      const roots = comfyRoots();
      const root = roots.find((r) => fs.existsSync(path.join(r, "input"))) ?? roots[0];
      if (!root) return null;
      const destName = path.basename(filename || name).replace(/[^\w.\-]+/g, "_") || "forge_input.png";
      const destDir = path.join(root, "input");
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, destName);
      if (path.resolve(abs) !== path.resolve(dest)) fs.copyFileSync(abs, dest);
      return destName;
    } catch {
      return null;
    }
  })();
  if (fromUrl) return fromUrl;

  let payload = dataUrl;
  if (!payload.startsWith("data:")) {
    const fromDisk = readStillFromPath(payload);
    if (fromDisk) {
      payload = fromDisk;
    } else if (/forge-media/.test(payload)) {
      throw new Error("Could not read that still from the PC disk. Drop the file again.");
    } else {
      const pathOnly = payload.replace(/^\/comfy-proxy/, "");
      const abs = pathOnly.startsWith("http") ? pathOnly : `${baseUrl.replace(/\/$/, "")}${pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`}`;
      const res = await fetch(abs);
      if (!res.ok) throw new Error(`Could not fetch still (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || "image/png";
      payload = `data:${mime};base64,${buf.toString("base64")}`;
    }
  }
  const { blob } = b64ToBlob(payload);
  const form = new FormData();
  form.append("image", blob, filename);
  form.append("overwrite", "true");
  form.append("type", "input");
  let res = await comfyFetch(baseUrl, "/upload/image", { method: "POST", body: form }, 120000);
  if (!res.ok) {
    res = await comfyFetch(baseUrl, "/api/upload/image", { method: "POST", body: form }, 120000);
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = (await res.json()) as { name?: string };
  return json.name ?? filename;
}

export async function queuePrompt(
  baseUrl: string,
  prompt: Record<string, unknown>,
  clientId: string,
): Promise<{ promptId: string }> {
  const body = JSON.stringify({ prompt, client_id: clientId });
  let res = await comfyFetch(
    baseUrl,
    "/prompt",
    { method: "POST", headers: { "content-type": "application/json" }, body },
    15000,
  );
  if (!res.ok) {
    res = await comfyFetch(
      baseUrl,
      "/api/prompt",
      { method: "POST", headers: { "content-type": "application/json" }, body },
      15000,
    );
  }
  const json = (await res.json()) as { prompt_id?: string; node_errors?: Record<string, { errors?: { message?: string }[] }>; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Queue failed (${res.status})`);
  }
  const nodeErr = json.node_errors
    ? Object.values(json.node_errors)
        .flatMap((n) => n.errors ?? [])
        .map((e) => e.message)
        .filter(Boolean)
    : [];
  if (nodeErr.length) throw new Error(nodeErr.join(" · "));
  if (!json.prompt_id) throw new Error("ComfyUI did not return a prompt id");
  return { promptId: json.prompt_id };
}

function collectStrings(v: unknown, out: string[]) {
  if (typeof v === "string" && v.trim()) out.push(v.trim());
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
}

/** WD14 puts tags in ui.tags / STRING list, not in images. */
export function extractTagText(outputs: unknown): string {
  const pile: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      const t = v.trim().replace(/^"|"$/g, "");
      if (t.length >= 8 && !t.startsWith("data:") && !/^error/i.test(t) && (t.includes(",") || t.split(/[\s_]+/).length >= 3)) {
        pile.push(t);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      if ("filename" in rec && ("subfolder" in rec || "type" in rec)) return;
      for (const k of ["tags", "text", "string", "caption", "result", "ui"]) {
        if (k in rec) walk(rec[k]);
      }
      for (const val of Object.values(rec)) {
        if (typeof val === "string" || Array.isArray(val) || (val && typeof val === "object")) walk(val);
      }
    }
  };
  walk(outputs);
  pile.sort((a, b) => b.length - a.length);
  return pile[0] ?? "";
}

export async function readHistory(baseUrl: string, promptId: string) {
  let res = await comfyFetch(baseUrl, `/history/${promptId}`, {}, 8000);
  if (!res.ok) res = await comfyFetch(baseUrl, `/api/history/${promptId}`, {}, 8000);
  if (!res.ok) return { ready: false as const, progress: 8 };
  const json = (await res.json()) as Record<
    string,
    {
      outputs?: Record<
        string,
        { images?: { filename: string; subfolder: string; type: string }[]; gifs?: { filename: string; subfolder: string; type: string }[] }
      >;
      status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
    }
  >;
  const entry = json[promptId];
  if (!entry) return { ready: false as const, progress: 12 };

  const fail = executionError(entry.status);
  if (fail) return { ready: false as const, error: fail.error, log: fail.log, progress: 0 };

  const files: { filename: string; subfolder: string; type: string }[] = [];
  for (const node of Object.values(entry.outputs ?? {})) {
    const rec = node as Record<string, unknown>;
    for (const img of (rec.images as { filename: string; subfolder: string; type: string }[] | undefined) ?? []) files.push(img);
    for (const g of (rec.gifs as { filename: string; subfolder: string; type: string }[] | undefined) ?? []) files.push(g);
  }
  const tags = extractTagText(entry.outputs);
  const completed = entry.status?.completed === true || entry.status?.status_str === "success";
  const nodesDone = Object.keys(entry.outputs ?? {}).length;
  const progress = files.length || tags ? 100 : Math.min(88, 15 + nodesDone * 10);
  if (tags) return { ready: true as const, files, progress: 100, tags, completed: true };
  if (!files.length && !completed) return { ready: false as const, progress, log: `running · ${nodesDone} nodes done`, completed: false };
  return { ready: true as const, files, progress: 100, tags: "", completed };
}

function executionError(status: { status_str?: string; completed?: boolean; messages?: unknown[] } | undefined) {
  if (!status) return null;
  const msgs = status.messages ?? [];
  for (const row of msgs) {
    if (!Array.isArray(row) || row[0] !== "execution_error") continue;
    const d = (row[1] ?? {}) as {
      exception_message?: string;
      exception_type?: string;
      traceback?: string[] | string;
      node_type?: string;
    };
    const trace = Array.isArray(d.traceback) ? d.traceback.join("") : (d.traceback ?? "");
    return {
      error: d.exception_message ?? status.status_str ?? "ComfyUI failed",
      log: [d.node_type, d.exception_type, d.exception_message, trace].filter(Boolean).join("\n"),
    };
  }
  if (status.status_str === "error") {
    return { error: "ComfyUI failed", log: JSON.stringify(status.messages ?? []).slice(0, 4000) };
  }
  return null;
}

export async function viewFile(
  baseUrl: string,
  file: { filename: string; subfolder: string; type: string },
): Promise<{ mime: string; dataUrl: string }> {
  const q = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder,
    type: file.type,
  });
  let res = await comfyFetch(baseUrl, `/view?${q}`, {}, 20000);
  if (!res.ok) res = await comfyFetch(baseUrl, `/api/view?${q}`, {}, 20000);
  if (!res.ok) throw new Error("Could not fetch ComfyUI output");
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = sniffMediaMime(file.filename, buf);
  return { mime, dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
}

export async function saveUserWorkflow(baseUrl: string, filename: string, json: unknown) {
  const body = JSON.stringify(json);
  const encoded = encodeURIComponent(`workflows/${filename}`);
  const headers = { "content-type": "application/json" };
  let res = await comfyFetch(
    baseUrl,
    `/api/userdata/${encoded}`,
    { method: "POST", headers, body },
    8000,
  );
  if (!res.ok) {
    res = await comfyFetch(
      baseUrl,
      `/userdata/${encoded}`,
      { method: "POST", headers, body },
      8000,
    );
  }
  return res.ok;
}

export function listLanIpv4(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) out.push(a.address);
    }
  }
  return out;
}

function widgetDefaults(info: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const bag = info?.input as
    | { required?: Record<string, unknown>; optional?: Record<string, unknown> }
    | undefined;
  for (const group of [bag?.required, bag?.optional]) {
    if (!group) continue;
    for (const [key, spec] of Object.entries(group)) {
      if (key === "image") continue;
      const combo = comboList(spec);
      if (combo.length) {
        out[key] = combo[0];
        continue;
      }
      if (Array.isArray(spec) && spec[1] && typeof spec[1] === "object" && spec[1] !== null && "default" in spec[1]) {
        out[key] = (spec[1] as { default: unknown }).default;
      }
    }
  }
  return out;
}

async function wd14Http(
  baseUrl: string,
  filename: string,
  type: string,
): Promise<{ tags: string; className: string } | null> {
  const q = new URLSearchParams({ filename, type, subfolder: "" });
  for (const path of [`/pysssss/wd14tagger/tag?${q}`, `/api/pysssss/wd14tagger/tag?${q}`]) {
    try {
      const res = await comfyFetch(baseUrl, path, {}, 180000);
      if (!res.ok) continue;
      const body = await res.text();
      let tags = "";
      try {
        const json = JSON.parse(body) as unknown;
        if (typeof json === "string") tags = json;
        else if (json && typeof json === "object") {
          const rec = json as Record<string, unknown>;
          const pile: string[] = [];
          collectStrings(rec.tags ?? rec.result ?? rec.caption ?? rec.text ?? json, pile);
          tags = pile.join(", ");
        }
      } catch {
        tags = body;
      }
      tags = tags.trim().replace(/^"|"$/g, "");
      if (tags && !/^error/i.test(tags) && tags.length > 2) {
        return { tags, className: "WD14Tagger|pysssss" };
      }
    } catch {
      /* next */
    }
  }
  return null;
}

export async function tagImageWd14(
  baseUrl: string,
  dataUrl: string,
): Promise<{ tags: string; className: string } | { error: string }> {
  const fromView = dataUrl.match(/[?&]filename=([^&]+)/);
  const fromType = dataUrl.match(/[?&]type=([^&]+)/);
  if (fromView) {
    const filename = decodeURIComponent(fromView[1] ?? "");
    const type = decodeURIComponent(fromType?.[1] ?? "output");
    const tagged = await wd14Http(baseUrl, filename, type);
    if (tagged) return tagged;
  }

  let filename: string;
  try {
    filename = await uploadToComfy(baseUrl, dataUrl, "forge_scan.png");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload for scan failed" };
  }
  const tagged = await wd14Http(baseUrl, filename, "input");
  if (tagged) return tagged;

  const status = await probeComfy(baseUrl);
  const cls = status.taggerClass || "WD14Tagger|pysssss";
  if (!status.taggerClass && !infoCache?.info?.["WD14Tagger|pysssss"]) {
    return {
      error:
        "WD14 node not loaded. In Comfy: custom_nodes/ComfyUI-WD14-Tagger must be installed, then restart Comfy.",
    };
  }
  const spec = infoCache?.info?.[cls];
  const inputs: Record<string, unknown> = {
    ...widgetDefaults(spec),
    image: ["1", 0],
    threshold: 0.35,
    character_threshold: 0.8,
    replace_underscore: true,
    trailing_comma: false,
    exclude_tags: "",
  };
  const models = status.taggerModels;
  inputs.model =
    models.find((m) => /moat|convnextv2|swinv2/i.test(m)) ?? models[0] ?? "wd-v1-4-moat-tagger-v2";
  const graph = {
    "1": { class_type: "LoadImage", inputs: { image: filename }, _meta: { title: "Scan still" } },
    "2": { class_type: cls, inputs, _meta: { title: "WD14" } },
  };
  try {
    const { promptId } = await queuePrompt(baseUrl, graph, "forge-wd14");
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const hist = await readHistory(baseUrl, promptId);
      if (hist.error) return { error: hist.error };
      if (hist.tags) return { tags: hist.tags, className: cls };
      if (hist.completed) break;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "WD14 queue failed" };
  }
  return {
    error:
      "WD14 finished with no tags. First tap downloads the ONNX model — watch Comfy’s terminal, wait until it says done, tap Scan again. If it already downloaded: pip install onnxruntime-gpu in the Comfy venv, then restart Comfy.",
  };
}

export function listUserWorkflows(): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  for (const root of comfyRoots()) {
    for (const rel of ["user/default/workflows", "user/workflows", "workflows"]) {
      const dir = path.join(root, rel);
      let ents: string[] = [];
      try {
        ents = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const n of ents) {
        if (!n.endsWith(".json")) continue;
        out.push({ name: n.replace(/\.json$/i, ""), path: path.join(dir, n) });
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((w) => (seen.has(w.name) ? false : (seen.add(w.name), true)));
}

function fillApiWorkflow(
  graph: Record<string, { class_type?: string; inputs?: Record<string, unknown> }>,
  fill: { prompt: string; negative: string; seed: number },
) {
  let pos = true;
  for (const node of Object.values(graph)) {
    if (node.class_type === "CLIPTextEncode" && node.inputs && typeof node.inputs.text === "string") {
      node.inputs.text = pos ? fill.prompt : fill.negative;
      pos = false;
    }
    if (node.inputs && typeof node.inputs.seed === "number") node.inputs.seed = fill.seed;
    if (node.inputs && typeof node.inputs.noise_seed === "number") node.inputs.noise_seed = fill.seed;
  }
  return graph;
}

export async function queueSavedWorkflow(
  baseUrl: string,
  name: string,
  fill: { prompt: string; negative: string; seed: number; image?: { filename: string; dataUrl: string } },
): Promise<{ ok: true; promptId: string } | { ok: false; message: string }> {
  const hit = listUserWorkflows().find((w) => w.name === name);
  if (!hit) return { ok: false, message: `No workflow named ${name}` };
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(hit.path, "utf8"));
  } catch {
    return { ok: false, message: "Could not read that workflow json" };
  }
  const rec = raw as Record<string, unknown>;
  if (Array.isArray((raw as { nodes?: unknown }).nodes)) {
    return {
      ok: false,
      message: `${name} is a Comfy UI graph. Open it in Comfy (Workflows → ${name}). Forge can only auto-fill API json.`,
    };
  }
  const graph = (rec.prompt && typeof rec.prompt === "object" ? rec.prompt : raw) as Record<
    string,
    { class_type?: string; inputs?: Record<string, unknown> }
  >;
  fillApiWorkflow(graph, fill);
  if (fill.image) {
    const uploaded = await uploadToComfy(baseUrl, fill.image.dataUrl, fill.image.filename);
    for (const node of Object.values(graph)) {
      if (node.class_type === "LoadImage" && node.inputs) node.inputs.image = uploaded;
    }
  }
  const { promptId } = await queuePrompt(baseUrl, graph, "forge-saved");
  return { ok: true, promptId };
}

function whichBin(cmd: string) {
  const r = spawnSync("bash", ["-lc", `command -v ${cmd}`], { encoding: "utf8" });
  const p = (r.stdout || "").trim();
  return r.status === 0 && p ? p.split("\n")[0]! : "";
}

function latestForgeClip(preferName: string): string | null {
  const hit = preferName ? resolveComfyMedia("output", preferName) : null;
  if (hit) return hit;
  const found = { p: "", t: 0 };
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const root of comfyRoots()) {
    const dir = path.join(root, "output");
    const walk = (d: string, depth: number) => {
      if (depth > 3) return;
      let ents: import("node:fs").Dirent[] = [];
      try {
        ents = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of ents) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p, depth + 1);
        else if (/^Forge.*\.(mp4|webm|mov|m4v)$/i.test(ent.name) && !/_sound/i.test(ent.name)) {
          try {
            const t = fs.statSync(p).mtimeMs;
            if (t >= cutoff && t > found.t) {
              found.p = p;
              found.t = t;
            }
          } catch {
            /* skip */
          }
        }
      }
    };
    walk(dir, 0);
  }
  return found.p || null;
}

/** Mix scene SFX + girl/dude voices onto a silent WAN mp4. */
export function addSoundToClip(name: string, spoken: string): { name: string } | { error: string } {
  let src = latestForgeClip(name);
  if (!src) {
    for (let i = 0; i < 8 && !src; i++) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
      src = latestForgeClip(name);
    }
  }
  if (!src) return { error: `clip not on disk yet (${name || "Forge*.mp4"}). Wait a second, Generate again, or check Comfy output/.` };
  const ffmpeg = whichBin("ffmpeg");
  if (!ffmpeg) return { error: "No sound: ffmpeg missing on the PC. Run: sudo apt install -y ffmpeg espeak-ng" };
  const safe = path.basename(src).replace(/[^\w.-]+/g, "_");
  const outName = safe.replace(/(\.[a-z0-9]+)$/i, "_sound$1");
  const dest = path.join(path.dirname(src), outName);
  const plan = ensureVoice(designClipAudio(spoken), spoken);
  const voiceBin = whichBin("espeak-ng") || whichBin("espeak");
  const wavs: string[] = [];
  if (voiceBin) {
    plan.lines.forEach((line, i) => {
      const tmp = path.join(os.tmpdir(), `forge-voice-${Date.now()}-${i}.wav`);
      const v = espeakVoice(line.voice);
      spawnSync(voiceBin, ["-v", v.v, "-s", v.s, "-p", v.p, "-g", "4", "-w", tmp, line.text], { timeout: 15000 });
      try {
        if (fs.existsSync(tmp) && fs.statSync(tmp).size > 400) wavs.push(tmp);
      } catch {
        /* skip */
      }
    });
  }
  const bed = ffmpegBed([plan.sfx, ...(plan.extra || [])]);
  const inputs = ["-y", "-i", src];
  wavs.forEach((w) => inputs.push("-i", w));
  const delays = [400, 1800, 3200];
  const voiceMix = wavs
    .map((_, i) => `[${i + 1}:a]adelay=${delays[i] || 400}|${delays[i] || 400},volume=2.2[v${i}]`)
    .join(";");
  const voiceLabels = wavs.map((_, i) => `[v${i}]`).join("");
  const nMix = 1 + wavs.length;
  const filter = wavs.length
    ? `${bed};${voiceMix};[bed]${voiceLabels}amix=inputs=${nMix}:duration=first:normalize=0,volume=1.4[a]`
    : `${bed};[bed]afade=t=in:st=0:d=0.2,volume=1.5[a]`;
  const mux = (videoCodec: string[]) =>
    spawnSync(
      ffmpeg,
      [...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[a]", ...videoCodec, "-c:a", "aac", "-shortest", dest],
      { encoding: "utf8", timeout: 120000 },
    );
  let r = mux(["-c:v", "copy"]);
  if (r.status !== 0 || !fs.existsSync(dest)) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    r = mux(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast"]);
  }
  for (const w of wavs) {
    try {
      fs.unlinkSync(w);
    } catch {
      /* ignore */
    }
  }
  if (r.status !== 0 || !fs.existsSync(dest)) {
    const hint = voiceBin ? "" : " Voices skipped — also install espeak-ng.";
    return { error: ((r.stderr || r.stdout || "ffmpeg sound failed").slice(-360) + hint).trim() };
  }
  return { name: outName };
}

export function lastFrameOfClip(name: string): { name: string; dataUrl: string } | { error: string } {
  const src = latestForgeClip(name);
  if (!src) return { error: `clip not on disk (${name || "Forge*.mp4"})` };
  const ffmpeg = whichBin("ffmpeg");
  if (!ffmpeg) return { error: "Need ffmpeg to grab the last frame. sudo apt install -y ffmpeg" };
  const outName = path.basename(src).replace(/\.[a-z0-9]+$/i, "_last.png");
  const dest = path.join(path.dirname(src), outName);
  const r = spawnSync(ffmpeg, ["-y", "-sseof", "-0.08", "-i", src, "-frames:v", "1", dest], {
    encoding: "utf8",
    timeout: 20000,
  });
  if (r.status !== 0 || !fs.existsSync(dest)) {
    return { error: (r.stderr || "last frame failed").slice(-240) };
  }
  const buf = fs.readFileSync(dest);
  return { name: outName, dataUrl: `data:image/png;base64,${buf.toString("base64")}` };
}

export function concatClips(names: string[]): { name: string } | { error: string } {
  const files = names.map((n) => latestForgeClip(n)).filter((p): p is string => Boolean(p));
  if (files.length < 2) return { error: "Need two clips to stitch" };
  const ffmpeg = whichBin("ffmpeg");
  if (!ffmpeg) return { error: "Need ffmpeg to stitch clips. sudo apt install -y ffmpeg" };
  const dir = path.dirname(files[0]!);
  const listPath = path.join(os.tmpdir(), `forge-concat-${Date.now()}.txt`);
  const outName = `Forge_extend_${Date.now().toString(36)}.mp4`;
  const dest = path.join(dir, outName);
  fs.writeFileSync(listPath, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  let r = spawnSync(
    ffmpeg,
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", dest],
    { encoding: "utf8", timeout: 60000 },
  );
  if (r.status !== 0 || !fs.existsSync(dest)) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    r = spawnSync(
      ffmpeg,
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", dest],
      { encoding: "utf8", timeout: 120000 },
    );
  }
  try {
    fs.unlinkSync(listPath);
  } catch {
    /* ignore */
  }
  if (r.status !== 0 || !fs.existsSync(dest)) {
    return { error: (r.stderr || "concat failed").slice(-280) };
  }
  return { name: outName };
}
