import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lanGenerate, lanProbe, browserPoll } from "@/lib/forge/comfy-browser";
import { fetchRecent } from "@/lib/forge/live-room";
import { useForge } from "@/lib/forge/store";
import {
  characterLabel,
  generateNegative,
  isCharacterLora,
  isRealCheckpoint,
  type Job,
  type Mode,
} from "@/lib/forge/types";
import { grokExpand } from "@/lib/forge/wildcards";

type Tab = "still" | "edit" | "video" | "library";

function rid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function mediaUrl(folder: "input" | "output", name: string) {
  return `/forge-media?folder=${folder}&name=${encodeURIComponent(name)}`;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function Studio() {
  const prompt = useForge((s) => s.prompt);
  const negative = useForge((s) => s.negative);
  const negLocked = useForge((s) => s.negLocked);
  const seed = useForge((s) => s.seed);
  const seedLocked = useForge((s) => s.seedLocked);
  const nsfwMode = useForge((s) => s.nsfwMode);
  const settings = useForge((s) => s.settings);
  const comfy = useForge((s) => s.comfy);
  const loras = useForge((s) => s.loras);
  const jobs = useForge((s) => s.jobs);
  const activeJobId = useForge((s) => s.activeJobId);

  const [tab, setTab] = useState<Tab>("still");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [drop, setDrop] = useState<{ name: string; dataUrl: string } | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const ckpts = useMemo(
    () => (comfy?.checkpoints || []).filter(isRealCheckpoint),
    [comfy?.checkpoints],
  );
  const people = useMemo(
    () => loras.filter((l) => isCharacterLora(l.filename)),
    [loras],
  );
  const pickedPeople = people.filter((p) => p.enabled);
  const active = jobs.find((j) => j.id === activeJobId) || jobs[0];

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const status = await lanProbe();
        if (!stop) useForge.getState().applyComfy(status);
      } catch {
        if (!stop) useForge.getState().setComfy(null);
      }
    };
    void tick();
    const id = window.setInterval(tick, 12000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function modeForTab(): Mode {
    if (tab === "video") return drop ? "i2v" : "t2v";
    if (tab === "edit") return "i2i";
    return "t2i";
  }

  function writeScene() {
    const st = useForge.getState();
    const typed = st.prompt.trim();
    if (!typed) {
      setErr("Type something first.");
      return;
    }
    const next = grokExpand({
      typed,
      files: st.wildcards,
      seed: st.seed + 17,
      family: st.settings.stillFamily === "sd15" ? "sd15" : st.settings.stillFamily === "flux" ? "flux" : "sdxl",
      checkpoint: st.settings.checkpoint,
      nsfwMode: st.nsfwMode,
      cast: pickedPeople.map((p) => p.name || characterLabel(p.filename)),
    });
    st.setPrompt(next);
    if (!st.negLocked) {
      st.setNegative(generateNegative(st.negative, st.settings.checkpoint, next, false));
    }
    setErr("");
  }

  const startPoll = useCallback((jobId: string, promptId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let n = 0;
    const tick = async () => {
      n += 1;
      const hist = await browserPoll(promptId);
      const st = useForge.getState();
      if (hist.error) {
        st.patchJob(jobId, { status: "error", error: hist.error, progress: 0 });
        if (pollRef.current) window.clearInterval(pollRef.current);
        setBusy("");
        setErr(hist.error);
        return;
      }
      if (hist.ready && hist.dataUrl) {
        st.patchJob(jobId, {
          status: "done",
          progress: 100,
          resultDataUrl: hist.dataUrl,
          resultName: hist.filename,
          resultFolder: hist.folder,
          resultKind: hist.kind || "image",
          batch: (hist.extras || []).map((x) => ({
            src: x.dataUrl,
            name: x.filename || "",
            kind: x.kind,
          })),
        });
        if (pollRef.current) window.clearInterval(pollRef.current);
        setBusy("");
        return;
      }
      st.patchJob(jobId, { status: "running", progress: hist.progress || Math.min(90, 8 + n * 3) });
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2500);
  }, []);

  async function generate() {
    const st = useForge.getState();
    const typed = st.prompt.trim();
    if (!typed) {
      setErr("Type something first.");
      return;
    }
    const mode = modeForTab();
    if ((mode === "i2i" || mode === "i2v") && !drop) {
      setErr("Drop a photo first.");
      return;
    }
    setErr("");
    setBusy("queued");
    const jobId = rid();
    const useSeed = st.seedLocked ? st.seed : Math.floor(Math.random() * 1_000_000_000);
    if (!st.seedLocked) st.setSeed(useSeed);
    if (!st.negLocked) {
      st.setNegative(generateNegative(st.negative, st.settings.checkpoint, typed, false));
    }
    const job: Job = {
      id: jobId,
      createdAt: Date.now(),
      mode,
      prompt: typed,
      expandedPrompt: typed,
      negative: st.negative,
      seed: useSeed,
      status: "queued",
      resultKind: mode === "t2v" || mode === "i2v" ? "video" : "image",
      apiWorkflow: {},
      uiWorkflow: {},
      progress: 4,
    };
    st.addJob(job);
    st.setActiveJob(jobId);
    const images = drop ? [{ filename: drop.name || "edit.png", dataUrl: drop.dataUrl }] : [];
    const res = await lanGenerate({
      prompt: typed,
      negative: st.negative,
      negLocked: st.negLocked,
      seed: useSeed,
      mode,
      aspect: st.aspect,
      denoise: st.denoise,
      nsfwMode: st.nsfwMode,
      checkpoint: st.settings.checkpoint,
      settings: st.settings,
      images,
      loras: st.loras.filter((l) => l.enabled),
    });
    if (!res.ok) {
      st.patchJob(jobId, { status: "error", error: res.message });
      setBusy("");
      setErr(res.message);
      return;
    }
    st.patchJob(jobId, { status: "running", promptId: res.promptId, progress: 12 });
    setBusy("running");
    startPoll(jobId, res.promptId);
  }

  async function onFiles(files: FileList | File[]) {
    const f = Array.from(files)[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setDrop({ name: f.name, dataUrl });
    if (tab === "still") setTab("edit");
  }

  function togglePerson(id: string) {
    const st = useForge.getState();
    const hit = st.loras.find((l) => l.id === id);
    if (!hit) return;
    st.upsertLora({ ...hit, enabled: !hit.enabled });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="text-sm font-semibold tracking-tight">Lantern</div>
        <span className="text-[11px] tabular-nums text-subtle">282</span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          <span className={comfy?.ok ? "text-signal" : "text-danger"}>{comfy?.ok ? "Comfy" : "Comfy off"}</span>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-line px-3 py-2">
        {(["still", "edit", "video", "library"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-sm capitalize ${
              tab === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}
          >
            {id}
          </button>
        ))}
      </nav>

      {tab !== "library" ? (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            {active?.resultDataUrl ? (
              active.resultKind === "video" ? (
                <video src={active.resultDataUrl} controls className="mx-auto max-h-[52dvh] w-full bg-black" />
              ) : (
                <img src={active.resultDataUrl} alt="" className="mx-auto max-h-[52dvh] object-contain" />
              )
            ) : (
              <div className="flex h-[36dvh] items-center justify-center px-6 text-center text-sm text-muted">
                {busy ? busy : "Type below. Creator fills the scene. Generate sends it."}
              </div>
            )}
            {active?.status === "running" || active?.status === "queued" ? (
              <div className="h-1 bg-raised">
                <div className="h-1 bg-accent" style={{ width: `${active.progress || 8}%` }} />
              </div>
            ) : null}
          </section>

          {(tab === "edit" || tab === "video") && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm">
              <input
                type="file"
                accept={tab === "video" ? "image/*,video/*" : "image/*"}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void onFiles(e.target.files);
                }}
              />
              {drop ? (
                <img src={drop.dataUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
              ) : (
                <span className="text-muted">{tab === "edit" ? "Drop the photo to edit" : "Optional still for video"}</span>
              )}
              {drop ? <span className="truncate text-muted">{drop.name}</span> : null}
              {drop ? (
                <button
                  type="button"
                  className="ml-auto text-xs text-danger"
                  onClick={(e) => {
                    e.preventDefault();
                    setDrop(null);
                  }}
                >
                  clear
                </button>
              ) : null}
            </label>
          )}

          <textarea
            value={prompt}
            onChange={(e) => useForge.getState().setPrompt(e.target.value)}
            placeholder={
              tab === "edit"
                ? "remove the jacket, keep her face"
                : tab === "video"
                  ? "she turns and walks through the rain"
                  : "girl kick a dog"
            }
            className="min-h-28 w-full resize-y rounded-xl border border-line bg-raised px-3 py-3 text-[15px] leading-6 outline-none focus:border-line-strong"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={writeScene} className="rounded-full border border-line px-4 py-2 text-sm">
              Creator
            </button>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={Boolean(busy)}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {busy ? busy : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => useForge.getState().setNsfwMode(!nsfwMode)}
              className={`rounded-full px-3 py-2 text-xs ${nsfwMode ? "bg-danger/20 text-danger" : "text-muted"}`}
            >
              {nsfwMode ? "NSFW on" : "SFW"}
            </button>
            <button type="button" onClick={() => setPeopleOpen((v) => !v)} className="rounded-full px-3 py-2 text-xs text-muted">
              People {pickedPeople.length ? `(${pickedPeople.length})` : ""}
            </button>
          </div>

          {peopleOpen ? (
            <div className="flex max-h-40 flex-wrap gap-1 overflow-auto rounded-xl border border-line p-2">
              {people.length ? (
                people.slice(0, 80).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p.id)}
                    className={`rounded-full px-2 py-1 text-[11px] ${p.enabled ? "bg-accent text-accent-fg" : "text-muted"}`}
                  >
                    {p.name || characterLabel(p.filename)}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted">No character LoRAs seen yet. Wait for Comfy.</span>
              )}
            </div>
          ) : null}

          <label className="text-[11px] text-subtle">
            Negative {negLocked ? "(locked)" : "(auto)"}
            <textarea
              value={negative}
              readOnly={negLocked}
              onChange={(e) => useForge.getState().setNegative(e.target.value)}
              className="mt-1 min-h-14 w-full resize-y rounded-lg border border-line bg-transparent px-2 py-2 text-xs text-muted"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className="text-xs text-muted" onClick={() => useForge.getState().setNegLocked(!negLocked)}>
              {negLocked ? "Unlock negative" : "Lock negative"}
            </button>
            <button type="button" className="text-xs text-muted" onClick={() => useForge.getState().toggleSeedLock()}>
              Seed {seed} {seedLocked ? "locked" : "rolls"}
            </button>
          </div>

          <label className="text-[11px] text-subtle">
            Checkpoint
            <select
              value={settings.checkpoint}
              onChange={(e) => useForge.getState().setSettings({ checkpoint: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-raised px-2 py-2 text-sm"
            >
              {ckpts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {err ? <p className="text-sm text-danger">{err}</p> : null}
        </main>
      ) : (
        <Library />
      )}
    </div>
  );
}

function Library() {
  const jobs = useForge((s) => s.jobs);
  const [files, setFiles] = useState<{ folder: "input" | "output"; name: string; mtime: number }[]>([]);

  useEffect(() => {
    void fetchRecent().then(setFiles);
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Library</h2>
        <button type="button" className="text-xs text-danger" onClick={() => useForge.getState().clearJobs()}>
          Clear session
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {jobs
          .filter((j) => j.resultDataUrl)
          .map((j) => (
            <button
              key={j.id}
              type="button"
              className="overflow-hidden rounded-lg border border-line bg-surface"
              onClick={() => useForge.getState().setActiveJob(j.id)}
            >
              {j.resultKind === "video" ? (
                <video src={j.resultDataUrl} className="h-36 w-full object-cover" />
              ) : (
                <img src={j.resultDataUrl} alt="" className="h-36 w-full object-cover" />
              )}
            </button>
          ))}
        {files.slice(0, 48).map((f) => (
          <a
            key={`${f.folder}-${f.name}`}
            href={mediaUrl(f.folder, f.name)}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-lg border border-line bg-surface"
          >
            {/\.(mp4|webm|mov)$/i.test(f.name) ? (
              <video src={mediaUrl(f.folder, f.name)} className="h-36 w-full object-cover" />
            ) : (
              <img src={mediaUrl(f.folder, f.name)} alt={f.name} className="h-36 w-full object-cover" />
            )}
          </a>
        ))}
      </div>
    </main>
  );
}
