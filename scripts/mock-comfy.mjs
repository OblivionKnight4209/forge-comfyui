#!/usr/bin/env node
import http from "node:http";
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const PORT = Number(process.env.MOCK_COMFY_PORT || 8188);
const jobs = [];
const files = new Map();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const crc = crc32(Buffer.concat([t, data]));
  return Buffer.concat([u32(data.length), t, data, u32(crc)]);
}

function rgbPng(w, h, paint) {
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y, w, h);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const t2iPng = rgbPng(256, 256, (x, y) => [180, 40, 70]);
const i2iPng = rgbPng(256, 256, (x, y, w, h) => {
  if (x > w * 0.35 && x < w * 0.65 && y > h * 0.2 && y < h * 0.8) return [240, 220, 200];
  return [40, 140, 90];
});

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const objectInfo = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [["DasiwaIllustriousAnime.safetensors", "mix.safetensors"]] } },
  },
  LoraLoader: { input: { required: { lora_name: [["alice.safetensors"]] } } },
  UNETLoader: {
    input: {
      required: {
        unet_name: [
          [
            "DasiwaWAN22I2V14BLightspeed.safetensors",
            "wan2.2_ti2v_5B_fp16.safetensors",
            "wan2.1_t2v_14B_fp8_e4m3fn.safetensors",
          ],
        ],
      },
    },
  },
  VAELoader: {
    input: { required: { vae_name: [["sdxl_vae.safetensors", "wan_2.1_vae.safetensors", "wan2.2_vae.safetensors"]] } },
  },
  CLIPLoader: { input: { required: { clip_name: [["umt5_xxl_fp8.safetensors"]] } } },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  res.setHeader("access-control-allow-origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*",
    });
    res.end();
    return;
  }

  if (p === "/system_stats" || p === "/api/system_stats") {
    json(res, 200, { system: { os: "linux" }, devices: [] });
    return;
  }
  if (p === "/object_info" || p === "/api/object_info") {
    json(res, 200, objectInfo);
    return;
  }
  if (p === "/models/checkpoints" || p === "/api/models/checkpoints") {
    json(res, 200, ["DasiwaIllustriousAnime.safetensors"]);
    return;
  }
  if (p === "/models/diffusion_models" || p === "/api/models/diffusion_models") {
    json(res, 200, [
      "DasiwaWAN22I2V14BLightspeed.safetensors",
      "wan2.2_ti2v_5B_fp16.safetensors",
    ]);
    return;
  }
  if (p === "/models/vae" || p === "/api/models/vae") {
    json(res, 200, ["sdxl_vae.safetensors", "wan_2.1_vae.safetensors", "wan2.2_vae.safetensors"]);
    return;
  }
  if (p === "/models/text_encoders" || p === "/api/models/text_encoders") {
    json(res, 200, ["umt5_xxl_fp8.safetensors"]);
    return;
  }
  if (p === "/models/loras" || p === "/api/models/loras") {
    json(res, 200, ["alice.safetensors"]);
    return;
  }
  if (p.startsWith("/models/") || p.startsWith("/api/models/")) {
    json(res, 200, []);
    return;
  }
  if ((p === "/upload/image" || p === "/api/upload/image") && req.method === "POST") {
    const buf = await readBody(req);
    const name = "forge_input_0.png";
    files.set(name, buf);
    json(res, 200, { name, subfolder: "", type: "input" });
    return;
  }
  if ((p === "/prompt" || p === "/api/prompt") && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const id = `mock-${jobs.length + 1}`;
    const graph = body.prompt || {};
    const load = Object.values(graph).some((n) => n && n.class_type === "LoadImage");
    const sampler = Object.values(graph).find((n) => n && n.class_type === "KSampler");
    const denoise = sampler?.inputs?.denoise;
    const pos = Object.values(graph).find((n) => n && n.class_type === "CLIPTextEncode" && n._meta?.title === "Positive")
      || Object.values(graph).find((n) => n && n.class_type === "CLIPTextEncode");
    const vaeEnc = Object.values(graph).find((n) => n && n.class_type === "VAEEncode");
    const video = Object.values(graph).some((n) => n && (n.class_type === "CreateVideo" || n.class_type === "SaveVideo" || n.class_type === "WanImageToVideo"));
    const frames = Object.values(graph).find((n) => n && n.class_type === "EmptyHunyuanLatentVideo")?.inputs?.length
      || Object.values(graph).find((n) => n && n.class_type === "WanImageToVideo")?.inputs?.length;
    jobs.push({ id, graph, load, denoise, at: Date.now(), text: pos?.inputs?.text || "", vae: vaeEnc?.inputs?.vae || null, video, frames });
    mkdirSync("/tmp/forge-mock", { recursive: true });
    writeFileSync("/tmp/forge-mock/jobs.json", JSON.stringify(jobs, null, 2));
    json(res, 200, { prompt_id: id, number: jobs.length, node_errors: {} });
    return;
  }
  if (p.startsWith("/history/") || p.startsWith("/api/history/")) {
    const id = p.split("/").pop();
    const job = jobs.find((j) => j.id === id);
    if (!job) {
      json(res, 200, {});
      return;
    }
    const filename = job.video ? "Forge_clip.mp4" : job.load ? "Forge_edit.png" : "Forge_t2i.png";
    json(res, 200, {
      [id]: {
        prompt: [0, id, job.graph],
        outputs: job.video
          ? { "33": { gifs: [{ filename, subfolder: "", type: "output" }] } }
          : { "32": { images: [{ filename, subfolder: "", type: "output" }] } },
        status: { status_str: "success", completed: true, messages: [] },
      },
    });
    return;
  }
  if (p === "/view" || p === "/api/view") {
    const name = url.searchParams.get("filename") || "";
    const png = name.includes("edit") ? i2iPng : t2iPng;
    res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
    res.end(png);
    return;
  }
  if (p === "/queue" || p === "/api/queue") {
    json(res, 200, { queue_running: [], queue_pending: [] });
    return;
  }
  if (p === "/reset") {
    jobs.length = 0;
    files.clear();
    json(res, 200, { ok: true });
    return;
  }
  if (p === "/jobs") {
    json(res, 200, jobs);
    return;
  }
  json(res, 200, { mock: true });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`mock Comfy on :${PORT}`);
});
