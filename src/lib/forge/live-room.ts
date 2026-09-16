import type { Job, Mode } from "./types";

export type LiveJob = {
  id: string;
  createdAt: number;
  mode: Mode;
  prompt: string;
  seed: number;
  status: Job["status"];
  error?: string;
  resultName?: string;
  resultFolder?: "input" | "output";
  resultKind: "image" | "video";
  promptId?: string;
  checkpoint?: string;
  progress?: number;
  log?: string;
  batchNames?: string[];
};

export function isLanRemote() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]";
}

export function forgetForgeOnThisDevice() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith("forge-studio")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
  try {
    sessionStorage.removeItem("forge-studio-v48");
  } catch {
    /* ignore */
  }
}

export function slimJob(job: Job): LiveJob {
  return {
    id: job.id,
    createdAt: job.createdAt,
    mode: job.mode,
    prompt: job.prompt,
    seed: job.seed,
    status: job.status,
    error: job.error,
    resultName: job.resultName,
    resultFolder: job.resultFolder,
    resultKind: job.resultKind,
    promptId: job.promptId,
    checkpoint: job.checkpoint,
    progress: job.progress,
    log: job.log,
    batchNames: job.batch?.map((b) => b.name).filter(Boolean),
  };
}

export function mediaSrc(job: Pick<LiveJob, "resultName" | "resultFolder">) {
  if (!job.resultName) return undefined;
  return `/forge-media?folder=${job.resultFolder === "input" ? "input" : "output"}&name=${encodeURIComponent(job.resultName)}`;
}

export function mergeLiveJobs(local: Job[], remote: LiveJob[]): Job[] {
  const rank: Record<string, number> = { held: 0, queued: 1, running: 2, done: 3, error: 3 };
  const map = new Map<string, Job>();
  for (const j of local) map.set(j.id, j);
  for (const r of remote) {
    const prev = map.get(r.id);
    const fromDisk = mediaSrc(r);
    const keepData = prev?.resultDataUrl?.startsWith("data:");
    const prevRank = rank[prev?.status || ""] ?? 0;
    const nextRank = rank[r.status] ?? 0;
    const status = prev && prevRank > nextRank ? prev.status : r.status;
    const error = status === "error" ? r.error || prev?.error : prev?.error;
    map.set(r.id, {
      id: r.id,
      createdAt: r.createdAt,
      mode: r.mode,
      prompt: r.prompt,
      expandedPrompt: prev?.expandedPrompt || r.prompt,
      negative: prev?.negative || "",
      seed: r.seed,
      status,
      error,
      resultDataUrl: keepData ? prev!.resultDataUrl : fromDisk || prev?.resultDataUrl,
      resultName: r.resultName || prev?.resultName,
      resultFolder: r.resultFolder || prev?.resultFolder,
      resultKind: r.resultKind,
      promptId: r.promptId || prev?.promptId,
      checkpoint: r.checkpoint || prev?.checkpoint,
      progress: Math.max(r.progress ?? 0, prev?.progress ?? 0) || r.progress || prev?.progress,
      log: r.log || prev?.log,
      apiWorkflow: prev?.apiWorkflow || {},
      uiWorkflow: prev?.uiWorkflow || {},
      scan: prev?.scan,
      batch:
        r.batchNames && r.batchNames.length
          ? r.batchNames.map((name) => ({
              src: `/forge-media?folder=${r.resultFolder === "input" ? "input" : "output"}&name=${encodeURIComponent(name)}`,
              name,
              kind: r.resultKind,
            }))
          : prev?.batch,
    });
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
}

function isAbort(err: unknown) {
  return (
    (err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message))) ||
    String(err).includes("This operation was aborted")
  );
}

export async function fetchLive(): Promise<{ jobs: LiveJob[] }> {
  try {
    const res = await fetch("/forge-api/live");
    if (!res.ok) return { jobs: [] };
    const json = (await res.json()) as { jobs?: LiveJob[] };
    return { jobs: json.jobs ?? [] };
  } catch (err) {
    if (isAbort(err)) return { jobs: [] };
    return { jobs: [] };
  }
}

export async function pushLive(job: Job): Promise<void> {
  try {
    await fetch("/forge-api/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job: slimJob(job) }),
    });
  } catch {
    /* other devices keep their last snapshot */
  }
}

export async function fetchRecent(): Promise<{ folder: "input" | "output"; name: string; mtime: number }[]> {
  try {
    const res = await fetch("/forge-api/recent");
    if (!res.ok) return [];
    const json = (await res.json()) as { files?: { folder: "input" | "output"; name: string; mtime: number }[] };
    return json.files ?? [];
  } catch {
    return [];
  }
}

export async function addClipSound(name: string, text: string): Promise<{ name?: string; error?: string }> {
  try {
    const res = await fetch("/forge-api/sound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, text }),
    });
    return (await res.json()) as { name?: string; error?: string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "sound failed" };
  }
}

export async function lastFrameOf(name: string): Promise<{ name?: string; dataUrl?: string; error?: string }> {
  try {
    const res = await fetch("/forge-api/last-frame", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return (await res.json()) as { name?: string; dataUrl?: string; error?: string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "last frame failed" };
  }
}

export async function concatClips(names: string[]): Promise<{ name?: string; error?: string }> {
  try {
    const res = await fetch("/forge-api/concat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ names }),
    });
    return (await res.json()) as { name?: string; error?: string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "concat failed" };
  }
}
