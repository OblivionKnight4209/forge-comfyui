import os from "node:os";
import type { ComfyStatus } from "./types";

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
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

function widgetOptions(info: Record<string, unknown> | undefined, widget: string): string[] {
  if (!info || typeof info !== "object") return [];
  const input = (info.input as { required?: Record<string, unknown> } | undefined)?.required?.[
    widget
  ];
  if (Array.isArray(input) && Array.isArray(input[0])) {
    return (input[0] as unknown[]).filter((x): x is string => typeof x === "string");
  }
  return [];
}

export async function probeComfy(baseUrl: string): Promise<ComfyStatus> {
  try {
    let stats = await comfyFetch(baseUrl, "/system_stats");
    if (!stats.ok) stats = await comfyFetch(baseUrl, "/api/system_stats");
    if (!stats.ok) {
      return { ok: false, message: `ComfyUI answered ${stats.status}`, checkpoints: [], unets: [], loras: [], vaes: [] };
    }
    let infoRes = await comfyFetch(baseUrl, "/object_info", {}, 8000);
    if (!infoRes.ok) infoRes = await comfyFetch(baseUrl, "/api/object_info", {}, 8000);
    const info = infoRes.ok ? ((await infoRes.json()) as Record<string, Record<string, unknown>>) : {};
    return {
      ok: true,
      message: "ComfyUI is on this machine",
      checkpoints: widgetOptions(info.CheckpointLoaderSimple, "ckpt_name"),
      unets: widgetOptions(info.UNETLoader, "unet_name"),
      loras: widgetOptions(info.LoraLoader, "lora_name"),
      vaes: widgetOptions(info.VAELoader, "vae_name"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unreachable";
    return {
      ok: false,
      message:
        msg.includes("abort") || msg.includes("fetch")
          ? "ComfyUI is not reachable at this address"
          : msg,
      checkpoints: [],
      unets: [],
      loras: [],
      vaes: [],
    };
  }
}

function b64ToBlob(dataUrl: string): { blob: Blob; nameHint: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Expected a data URL");
  const mime = m[1] ?? "image/png";
  const bin = Buffer.from(m[2] ?? "", "base64");
  const ext = mime.includes("video") ? "mp4" : mime.includes("jpeg") ? "jpg" : "png";
  return { blob: new Blob([bin], { type: mime }), nameHint: ext };
}

export async function uploadToComfy(
  baseUrl: string,
  dataUrl: string,
  filename: string,
): Promise<string> {
  const { blob } = b64ToBlob(dataUrl);
  const form = new FormData();
  form.append("image", blob, filename);
  form.append("overwrite", "true");
  let res = await comfyFetch(baseUrl, "/upload/image", { method: "POST", body: form }, 20000);
  if (!res.ok) {
    res = await comfyFetch(baseUrl, "/api/upload/image", { method: "POST", body: form }, 20000);
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
  const json = (await res.json()) as { prompt_id?: string; node_errors?: unknown; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Queue failed (${res.status})`);
  }
  if (!json.prompt_id) throw new Error("ComfyUI did not return a prompt id");
  return { promptId: json.prompt_id };
}

export async function readHistory(baseUrl: string, promptId: string) {
  let res = await comfyFetch(baseUrl, `/history/${promptId}`, {}, 8000);
  if (!res.ok) res = await comfyFetch(baseUrl, `/api/history/${promptId}`, {}, 8000);
  if (!res.ok) return { ready: false as const };
  const json = (await res.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[]; gifs?: { filename: string; subfolder: string; type: string }[] }> }>;
  const entry = json[promptId];
  if (!entry?.outputs) return { ready: false as const };
  const files: { filename: string; subfolder: string; type: string }[] = [];
  for (const node of Object.values(entry.outputs)) {
    for (const img of node.images ?? []) files.push(img);
    for (const g of node.gifs ?? []) files.push(g);
  }
  if (!files.length) return { ready: false as const };
  return { ready: true as const, files };
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
  const mime = file.filename.endsWith(".mp4")
    ? "video/mp4"
    : file.filename.endsWith(".webp")
      ? "image/webp"
      : "image/png";
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
