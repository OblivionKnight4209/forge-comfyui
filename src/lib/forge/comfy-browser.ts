import type { ComfyStatus } from "./types";
import { rewireLoadImages } from "./workflows";

export async function lanProbe(): Promise<ComfyStatus> {
  let last = "";
  for (const url of ["/api/status", "/forge-api/status"]) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      last = `${url} ${res.status} ${text.slice(0, 60)}`;
      if (!res.ok) continue;
      const json = JSON.parse(text) as ComfyStatus;
      if (json && typeof json === "object") return json;
    } catch (err) {
      last = `${url} ${err instanceof Error ? err.message : "fail"}`;
    }
  }
  throw new Error(last || "status failed");
}

export async function lanGenerate(body: Record<string, unknown>): Promise<
  | { ok: true; promptId: string; checkpoint?: string; prompt?: string; seed?: number }
  | { ok: false; message: string }
> {
  const payload = JSON.stringify(body);
  const errors: string[] = [];
  for (const url of ["/forge-api/generate", "/api/generate"]) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        signal: ctrl.signal,
        cache: "no-store",
      });
      const text = await res.text();
      let json: { ok?: boolean; promptId?: string; message?: string; checkpoint?: string; prompt?: string; seed?: number } = {};
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        errors.push(`${url} ${res.status} not JSON: ${text.slice(0, 80)}`);
        continue;
      }
      if (json.ok && json.promptId) {
        return { ok: true, promptId: json.promptId, checkpoint: json.checkpoint, prompt: json.prompt, seed: json.seed };
      }
      errors.push(json.message || `${url} ${res.status}`);
    } catch (err) {
      errors.push(`${url} ${err instanceof Error ? err.message : "fail"}`);
    } finally {
      clearTimeout(t);
    }
  }
  return { ok: false, message: errors.join(" · ") || "PC did not queue" };
}

export async function lanQueue(
  workflow: Record<string, unknown>,
  images: { filename: string; dataUrl: string }[],
  extra?: { clientId?: string; embedName?: string; uiWorkflow?: unknown },
): Promise<{ ok: true; promptId: string } | { ok: false; message: string }> {
  const payload = JSON.stringify({
    workflow,
    images,
    clientId: extra?.clientId || "forge-lan",
    embedName: extra?.embedName,
    uiWorkflow: extra?.uiWorkflow,
  });
  const errors: string[] = [];
  for (const url of ["/api/queue", "/forge-api/queue"]) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      const text = await res.text();
      let json: { ok?: boolean; promptId?: string; message?: string } = {};
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        errors.push(`${url} ${res.status} not JSON: ${text.slice(0, 80)}`);
        continue;
      }
      if (json.ok !== false && json.promptId) return { ok: true, promptId: json.promptId };
      errors.push(json.message || `${url} ${res.status}`);
    } catch (err) {
      errors.push(`${url} ${err instanceof Error ? err.message : "fail"}`);
    }
  }
  return { ok: false, message: errors.join(" · ") || "LAN queue failed" };
}

export async function lanBrain(body: {
  prompt: string;
  flavor?: string;
  wrap?: string;
  checkpoint?: string;
  fresh?: boolean;
  seed?: number;
}): Promise<{ ok: true; text: string; model: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/brain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok?: boolean; text?: string; model?: string; message?: string };
    if (json.ok && json.text) return { ok: true, text: json.text, model: json.model || "" };
    return { ok: false, message: json.message || "Brain failed" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Brain failed" };
  }
}

export async function lanBrainStatus(): Promise<{ ok: boolean; model: string }> {
  try {
    const res = await fetch("/api/brain");
    const json = (await res.json()) as { ok?: boolean; model?: string };
    return { ok: Boolean(json.ok), model: json.model || "" };
  } catch {
    return { ok: false, model: "" };
  }
}

const P = "/comfy-proxy";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

export async function browserTag(dataUrl: string): Promise<{ tags: string } | { error: string }> {
  try {
    let filename = "forge_scan.png";
    if (dataUrl.startsWith("data:")) {
      const blob = await dataUrlToBlob(dataUrl);
      const form = new FormData();
      form.append("image", blob, filename);
      form.append("overwrite", "true");
      form.append("type", "input");
      let up = await fetch(`${P}/upload/image`, { method: "POST", body: form });
      if (!up.ok) up = await fetch(`${P}/api/upload/image`, { method: "POST", body: form });
      if (!up.ok) return { error: `Scan upload failed (${up.status})` };
      const json = (await up.json()) as { name?: string };
      filename = json.name ?? filename;
    } else {
      const fromName = dataUrl.match(/[?&](?:filename|name)=([^&]+)/);
      if (fromName) filename = decodeURIComponent(fromName[1] ?? filename);
    }
    const q = new URLSearchParams({ filename, type: dataUrl.includes("type=output") ? "output" : "input", subfolder: "" });
    for (const path of [`${P}/pysssss/wd14tagger/tag?${q}`, `${P}/api/pysssss/wd14tagger/tag?${q}`]) {
      const res = await fetch(path);
      if (!res.ok) continue;
      const body = await res.text();
      let tags = "";
      try {
        const json = JSON.parse(body) as unknown;
        if (typeof json === "string") tags = json;
        else if (json && typeof json === "object") {
          const rec = json as Record<string, unknown>;
          const pile = rec.tags ?? rec.result ?? rec.caption ?? rec.text ?? json;
          tags = typeof pile === "string" ? pile : JSON.stringify(pile);
        }
      } catch {
        tags = body;
      }
      tags = tags.trim().replace(/^"|"$/g, "");
      if (tags && tags.length > 2 && !/^error/i.test(tags)) return { tags };
    }
    return { error: "WD14 HTTP did not answer — trying Comfy graph next" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Scan failed" };
  }
}

export async function asDataUrl(src: string): Promise<string> {
  if (!src) return src;
  if (src.startsWith("data:")) return src;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(src, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Could not load still (${res.status})`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("Empty still");
    return blobToDataUrl(blob);
  } finally {
    clearTimeout(t);
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function browserQueue(
  workflow: Record<string, unknown>,
  images: { filename: string; dataUrl: string }[],
  clientId: string,
): Promise<{ ok: true; promptId: string } | { ok: false; message: string }> {
  try {
    for (const img of images) {
      const blob = await dataUrlToBlob(img.dataUrl);
      const form = new FormData();
      form.append("image", blob, img.filename);
      form.append("overwrite", "true");
      form.append("type", "input");
      let up = await fetch(`${P}/upload/image`, { method: "POST", body: form });
      if (!up.ok) up = await fetch(`${P}/api/upload/image`, { method: "POST", body: form });
      if (!up.ok) return { ok: false, message: `Upload failed (${up.status})` };
      const json = (await up.json()) as { name?: string };
      const name = json.name ?? img.filename;
      rewireLoadImages(
        workflow as Record<string, { class_type?: string; inputs?: Record<string, unknown> }>,
        { [img.filename]: name },
      );
    }
    const res = await fetch(`${P}/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    const json = (await res.json()) as {
      prompt_id?: string;
      error?: { message?: string };
      node_errors?: Record<string, { errors?: { message?: string }[] }>;
    };
    if (!res.ok || json.error) {
      return { ok: false, message: json.error?.message ?? `Queue failed (${res.status})` };
    }
    const nodeErr = json.node_errors
      ? Object.values(json.node_errors)
          .flatMap((n) => n.errors ?? [])
          .map((e) => e.message)
          .filter(Boolean)
      : [];
    if (nodeErr.length) return { ok: false, message: nodeErr.join(" · ") };
    if (!json.prompt_id) return { ok: false, message: "ComfyUI did not return a prompt id" };
    return { ok: true, promptId: json.prompt_id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Proxy queue failed" };
  }
}

export async function browserPoll(promptId: string): Promise<{
  ready: boolean;
  progress: number;
  dataUrl?: string;
  filename?: string;
  folder?: "input" | "output";
  kind?: "image" | "video";
  extras?: { dataUrl: string; kind: "image" | "video"; filename?: string }[];
  tags?: string;
  error?: string;
  log?: string;
}> {
  const res = await fetch(`${P}/history/${encodeURIComponent(promptId)}`);
  if (!res.ok) return { ready: false, progress: 8 };
  const json = (await res.json()) as Record<
    string,
    {
      outputs?: Record<
        string,
        {
          images?: { filename: string; subfolder: string; type: string }[];
          gifs?: { filename: string; subfolder: string; type: string }[];
        }
      >;
      status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
    }
  >;
  const entry = json[promptId];
  if (!entry) return { ready: false, progress: 12 };
  const msgs = entry.status?.messages ?? [];
  for (const row of msgs) {
    if (!Array.isArray(row) || row[0] !== "execution_error") continue;
    const d = (row[1] ?? {}) as { exception_message?: string; traceback?: string[] | string };
    const trace = Array.isArray(d.traceback) ? d.traceback.join("") : (d.traceback ?? "");
    return { ready: false, progress: 0, error: d.exception_message ?? "ComfyUI failed", log: trace };
  }
  const files: { filename: string; subfolder: string; type: string }[] = [];
  for (const node of Object.values(entry.outputs ?? {})) {
    for (const img of node.images ?? []) files.push(img);
    for (const g of node.gifs ?? []) files.push(g);
  }
  if (!files.length) {
    const nodesDone = Object.keys(entry.outputs ?? {}).length;
    return { ready: false, progress: Math.min(88, 15 + nodesDone * 10), log: `running · ${nodesDone} nodes` };
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const toSrc = async (f: { filename: string; subfolder: string; type: string }) => {
    const q = new URLSearchParams({
      filename: f.filename,
      subfolder: f.subfolder ?? "",
      type: f.type || "output",
    });
    const video = /\.(mp4|webm|gif)$/i.test(f.filename);
    const kind = (video ? "video" : "image") as "image" | "video";
    const media = `/forge-media?folder=${f.type === "input" ? "input" : "output"}&name=${encodeURIComponent(f.filename)}`;
    const view = `${P}/view?${q.toString()}`;
    for (const src of [media, view]) {
      try {
        const res = await fetch(origin ? `${origin}${src}` : src);
        if (res.ok) return { dataUrl: await blobToDataUrl(await res.blob()), kind, filename: f.filename, folder: (f.type === "input" ? "input" : "output") as "input" | "output" };
      } catch {
        /* next */
      }
    }
    return { dataUrl: media, kind, filename: f.filename, folder: (f.type === "input" ? "input" : "output") as "input" | "output" };
  };
  const views = await Promise.all(files.slice(0, 8).map(toSrc));
  const first = views[0]!;
  return {
    ready: true,
    progress: 100,
    dataUrl: first.dataUrl,
    filename: first.filename,
    folder: first.folder,
    kind: first.kind,
    extras: views.slice(1),
    tags: "",
  };
}
