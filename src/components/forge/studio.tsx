import {
  Clapperboard,
  Download,
  ImagePlus,
  Loader2,
  Radio,
  ScanSearch,
  Settings2,
  Shuffle,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/input";
import { QrMark } from "@/components/forge/qr-mark";
import { lanInfoFn, pollComfyFn, probeComfyFn, queueComfyFn } from "@/lib/forge/functions";
import { extractFrame, scanMedia } from "@/lib/forge/detector";
import { downloadBlob, embedWorkflowPng, dataUrlToBytes } from "@/lib/forge/png";
import { useForge } from "@/lib/forge/store";
import {
  ASPECTS,
  MODE_META,
  MODES,
  type Job,
  type LoraEntry,
  type MediaRef,
  type Mode,
  type ModelFamily,
} from "@/lib/forge/types";
import { expandPrompt } from "@/lib/forge/wildcards";
import {
  apiToUiWorkflow,
  buildApiWorkflow,
  compatibleLoras,
  jobBasename,
  triggerPrefix,
} from "@/lib/forge/workflows";
import { cn } from "@/lib/utils";

function uid() {
  return crypto.randomUUID();
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

async function filesToMedia(files: FileList | File[]): Promise<MediaRef[]> {
  const list = Array.from(files);
  const out: MediaRef[] = [];
  for (const file of list) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
    out.push({
      id: uid(),
      kind: file.type.startsWith("video") ? "video" : "image",
      name: file.name,
      dataUrl,
    });
  }
  return out;
}

export function Studio() {
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "settings" | "loras" | "wild" | "graph">(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const mode = useForge((s) => s.mode);
  const prompt = useForge((s) => s.prompt);
  const negative = useForge((s) => s.negative);
  const seed = useForge((s) => s.seed);
  const seedLocked = useForge((s) => s.seedLocked);
  const aspect = useForge((s) => s.aspect);
  const denoise = useForge((s) => s.denoise);
  const duration = useForge((s) => s.duration);
  const showBoxes = useForge((s) => s.showBoxes);
  const media = useForge((s) => s.media);
  const loras = useForge((s) => s.loras);
  const wildcards = useForge((s) => s.wildcards);
  const jobs = useForge((s) => s.jobs);
  const activeJobId = useForge((s) => s.activeJobId);
  const settings = useForge((s) => s.settings);
  const comfy = useForge((s) => s.comfy);
  const lanUrls = useForge((s) => s.lanUrls);
  const liveScan = useForge((s) => s.liveScan);
  const expandedPreview = useForge((s) => s.expandedPreview);

  const active = jobs.find((j) => j.id === activeJobId) ?? jobs[0] ?? null;
  const meta = MODE_META[mode];
  const familyMatch = compatibleLoras(loras, mode, settings.stillFamily);

  useEffect(() => {
    void useForge.persist.rehydrate();
  }, []);

  useEffect(() => {
    const { expanded } = expandPrompt(prompt, wildcards, seed);
    useForge.getState().setExpandedPreview(expanded);
  }, [prompt, wildcards, seed]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const status = await probeComfyFn({ data: { baseUrl: settings.baseUrl } });
        if (!stop) useForge.getState().setComfy(status);
      } catch {
        if (!stop) {
          useForge.getState().setComfy({
            ok: false,
            message: "ComfyUI is not reachable at this address",
            checkpoints: [],
            unets: [],
            loras: [],
            vaes: [],
          });
        }
      }
    }
    tick();
    const id = setInterval(tick, 8000);
    lanInfoFn()
      .then((info) => {
        useForge.getState().setLanUrls(info.addresses.map((a) => `http://${a}:${info.port}`));
      })
      .catch(() => {});
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [settings.baseUrl]);

  useEffect(() => {
    const running = jobs.filter((j) => j.status === "running" && j.promptId);
    if (!running.length) return;
    const id = setInterval(async () => {
      for (const job of running) {
        try {
          const r = await pollComfyFn({
            data: { baseUrl: settings.baseUrl, promptId: job.promptId! },
          });
          if (!r.ready) continue;
          useForge.getState().patchJob(job.id, {
            status: "done",
            resultDataUrl: r.dataUrl,
            resultKind: r.mime.startsWith("video") ? "video" : "image",
          });
          const scan = await scanMedia(r.dataUrl);
          useForge.getState().patchJob(job.id, { scan });
          useForge.getState().setLiveScan(scan);
          toast.success("ComfyUI finished");
        } catch (err) {
          useForge.getState().patchJob(job.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Poll failed",
          });
        }
      }
    }, 1400);
    return () => clearInterval(id);
  }, [jobs, settings.baseUrl]);

  const stageSrc = active?.resultDataUrl ?? media[0]?.dataUrl ?? null;
  const stageKind = active?.resultDataUrl
    ? active.resultKind
    : media[0]?.kind ?? "image";
  const scan = active?.scan ?? liveScan;

  async function onDropFiles(files: FileList | File[]) {
    const items = await filesToMedia(files);
    useForge.getState().addMedia(items);
    const first = items[0];
    if (first) {
      try {
        const result = await scanMedia(first.dataUrl);
        useForge.getState().setLiveScan(result);
      } catch {
        /* ignore */
      }
    }
  }

  async function runScan() {
    const src = stageSrc;
    if (!src) {
      toast.error("Drop a still or video first");
      return;
    }
    setBusy(true);
    try {
      const result = await scanMedia(src);
      useForge.getState().setLiveScan(result);
      if (active) useForge.getState().patchJob(active.id, { scan: result });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  function insertWildcard(name: string) {
    const el = promptRef.current;
    const token = `__${name}__`;
    if (!el) {
      useForge.getState().setPrompt(`${prompt} ${token}`.trim());
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = prompt.slice(0, start) + token + prompt.slice(end);
    useForge.getState().setPrompt(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function generate() {
    const state = useForge.getState();
    if (meta.needsImage && !state.media.some((m) => m.kind === "image")) {
      toast.error("This mode needs at least one still");
      return;
    }
    if (meta.needsVideo && !state.media.some((m) => m.kind === "video")) {
      toast.error("This mode needs a video");
      return;
    }
    if (!state.prompt.trim()) {
      toast.error("Write a prompt");
      return;
    }

    if (!state.seedLocked) state.rollSeed();
    const nextSeed = useForge.getState().seed;
    const parsed = expandPrompt(state.prompt, state.wildcards, nextSeed);
    const match = compatibleLoras(state.loras, state.mode, state.settings.stillFamily);
    if (match.blocked.length) {
      toast.error(
        `Off: ${match.blocked.map((l) => l.name).join(", ")} — wrong family for ${match.family}`,
      );
    }
    const inlineAsLoras: LoraEntry[] = parsed.loras.map((l) => ({
      id: `inline-${l.name}`,
      filename: l.name.endsWith(".safetensors") ? l.name : `${l.name}.safetensors`,
      name: l.name,
      family: match.family as ModelFamily,
      triggerWords: [],
      unetStrength: l.unet,
      clipStrength: l.clip,
      enabled: true,
    }));
    const stacked = [...match.ok, ...inlineAsLoras];
    const finalPrompt = triggerPrefix(stacked, parsed.expanded);
    const api = buildApiWorkflow({
      mode: state.mode,
      prompt: finalPrompt,
      negative: state.negative,
      seed: nextSeed,
      aspect: state.aspect,
      denoise: state.denoise,
      loras: stacked,
      settings: state.settings,
      imageCount: state.media.filter((m) => m.kind === "image").length,
      hasVideo: state.media.some((m) => m.kind === "video"),
    });
    const ui = apiToUiWorkflow(api, `Forge ${MODE_META[state.mode].label}`);
    const job: Job = {
      id: uid(),
      createdAt: Date.now(),
      mode: state.mode,
      prompt: state.prompt,
      expandedPrompt: finalPrompt,
      negative: state.negative,
      seed: nextSeed,
      status: state.comfy?.ok ? "queued" : "held",
      resultKind: meta.video ? "video" : "image",
      apiWorkflow: api,
      uiWorkflow: ui,
    };
    state.addJob(job);
    state.setExpandedPreview(finalPrompt);

    const scanTarget =
      state.media.find((m) => m.kind === "image")?.dataUrl ??
      (state.media.find((m) => m.kind === "video")
        ? await extractFrame(state.media.find((m) => m.kind === "video")!.dataUrl).catch(
            () => undefined,
          )
        : undefined);
    if (scanTarget) {
      try {
        const result = await scanMedia(scanTarget);
        useForge.getState().patchJob(job.id, { scan: result });
        useForge.getState().setLiveScan(result);
      } catch {
        /* ignore */
      }
    }

    if (!state.comfy?.ok) {
      toast.message("Job held — ComfyUI is not on this machine yet. Graph is ready to embed.");
      return;
    }

    setBusy(true);
    try {
      const images: { filename: string; dataUrl: string }[] = [];
      let idx = 0;
      for (const m of state.media) {
        if (m.kind === "image") {
          images.push({ filename: `forge_input_${idx}.png`, dataUrl: m.dataUrl });
          idx += 1;
        } else {
          const frame = await extractFrame(m.dataUrl);
          images.push({ filename: `forge_frame_${idx}.png`, dataUrl: frame });
          idx += 1;
        }
      }
      const queued = await queueComfyFn({
        data: {
          baseUrl: state.settings.baseUrl,
          workflow: api,
          images,
          clientId: "forge-studio",
          embedName: jobBasename(job),
          uiWorkflow: ui,
        },
      });
      if (!queued.ok) {
        useForge.getState().patchJob(job.id, { status: "held", error: queued.message });
        toast.error(queued.message);
        return;
      }
      useForge.getState().patchJob(job.id, { status: "running", promptId: queued.promptId });
      toast.success("Queued on ComfyUI and saved into workflows");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Queue failed";
      useForge.getState().patchJob(job.id, { status: "error", error: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadJob(job: Job, kind: "ui" | "api" | "png") {
    const base = jobBasename(job);
    if (kind === "ui") {
      downloadBlob(
        `${base}.json`,
        new Blob([JSON.stringify(job.uiWorkflow, null, 2)], { type: "application/json" }),
      );
      return;
    }
    if (kind === "api") {
      downloadBlob(
        `${base}-api.json`,
        new Blob([JSON.stringify(job.apiWorkflow, null, 2)], { type: "application/json" }),
      );
      return;
    }
    const src = job.resultDataUrl ?? (await makeCardPng());
    const bytes = await dataUrlToBytes(src);
    const out = embedWorkflowPng(
      bytes,
      JSON.stringify(job.uiWorkflow),
      JSON.stringify(job.apiWorkflow),
    );
    const buf = new ArrayBuffer(out.byteLength);
    new Uint8Array(buf).set(out);
    downloadBlob(`${base}.png`, new Blob([buf], { type: "image/png" }));
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="min-w-0">
          <p className="font-display text-2xl italic leading-none text-fg">Forge</p>
          <p className="mt-1 text-[11px] tracking-wide text-subtle">Local ComfyUI studio</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={comfy?.ok ? "signal" : "warn"}>{comfy?.ok ? "ComfyUI" : "Offline"}</Badge>
          <Button variant="ghost" size="icon" onClick={() => setSheet("settings")} aria-label="Settings">
            <Settings2 />
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-1 px-3 py-2 md:px-6">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => useForge.getState().setMode(m)}
              className={cn(
                "h-11 rounded-full px-3.5 text-sm",
                mode === m ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)]">
        <aside className="hidden space-y-4 xl:block">
          <MediaWell media={media} onFiles={onDropFiles} />
          <LoraCard loras={loras} family={familyMatch.family} blocked={familyMatch.blocked} />
          <WildcardCard
            files={wildcards}
            onInsert={insertWildcard}
            expanded={expandedPreview}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <Stage
            src={stageSrc}
            kind={stageKind}
            scan={scan}
            showBoxes={showBoxes}
            status={active?.status}
            error={active?.error}
            mode={mode}
            onFiles={onDropFiles}
          />

          <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)] md:p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted">{meta.blurb}</p>
              <div className="ml-auto flex flex-wrap gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => useForge.getState().setAspect(a)}
                    className={cn(
                      "h-9 rounded-full px-2.5 text-xs",
                      aspect === a ? "bg-raised text-fg" : "text-subtle hover:text-fg",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => useForge.getState().setPrompt(e.target.value)}
              placeholder="Describe the shot. Use __color__ or {red|blue}."
              className="min-h-28"
            />
            <p className="mt-2 line-clamp-2 text-xs text-subtle">
              Expanded: {expandedPreview || "—"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => useForge.getState().toggleSeedLock()}>
                Seed {seedLocked ? "locked" : "open"}
              </Button>
              <Input
                className="h-9 w-28"
                value={seed}
                onChange={(e) => useForge.getState().setSeed(Number(e.target.value) || 0)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-9 min-h-9 min-w-9"
                onClick={() => useForge.getState().rollSeed()}
                aria-label="Shuffle seed"
              >
                <Shuffle />
              </Button>
              {(mode === "i2i" || mode === "v2v") && (
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs text-muted">Denoise {denoise.toFixed(2)}</span>
                  <Slider
                    className="w-28"
                    min={0.15}
                    max={1}
                    step={0.01}
                    value={[denoise]}
                    onValueChange={(v) => useForge.getState().setDenoise(v[0] ?? denoise)}
                  />
                </div>
              )}
              {meta.video && (
                <div className="flex gap-1">
                  {([6, 10, 15] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={cn(
                        "h-9 rounded-full px-2.5 text-xs",
                        duration === d ? "bg-raised text-fg" : "text-subtle hover:text-fg",
                      )}
                      onClick={() => {
                        useForge.getState().setDuration(d);
                        useForge.getState().setSettings({
                          videoFrames: d === 6 ? 81 : d === 10 ? 129 : 161,
                        });
                      }}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              )}
              <Button className="ml-auto min-w-32" onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Generate
              </Button>
            </div>
          </div>

          <div className="flex gap-2 xl:hidden">
            <Button variant="secondary" className="flex-1" onClick={() => setSheet("loras")}>
              LoRAs
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setSheet("wild")}>
              Wildcards
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setSheet("graph")}>
              Graph
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <DetectorCard
            scan={scan}
            showBoxes={showBoxes}
            onToggleBoxes={(v) => useForge.getState().setShowBoxes(v)}
            onScan={runScan}
            busy={busy}
            onUseTags={() => {
              if (!scan) return;
              const tags = scan.tags
                .slice(0, 8)
                .map((t) => t.tag)
                .join(", ");
              useForge.getState().setPrompt(`${prompt}, ${tags}`.replace(/^, /, ""));
            }}
          />
          <NetworkCard urls={lanUrls} comfy={comfy?.ok ?? false} />
          <GraphCard
            job={active}
            onDownload={(k) => active && downloadJob(active, k)}
            className="hidden xl:block"
          />
        </aside>
      </div>

      {jobs.length > 0 && (
        <div className="border-t border-line px-4 py-3 md:px-6">
          <p className="mb-2 text-xs font-medium text-muted">History</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  useForge.getState().setActiveJob(job.id);
                  if (job.scan) useForge.getState().setLiveScan(job.scan);
                }}
                className={cn(
                  "h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-raised",
                  job.id === active?.id && "ring-2 ring-accent",
                )}
              >
                {job.resultDataUrl ? (
                  job.resultKind === "video" ? (
                    <video src={job.resultDataUrl} muted className="size-full object-cover" />
                  ) : (
                    <img src={job.resultDataUrl} alt="" className="size-full object-cover" />
                  )
                ) : (
                  <span className="flex size-full items-center justify-center text-[10px] text-subtle">
                    {job.status}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <Sheet open={sheet === "settings"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Settings" side="right">
          <SettingsForm />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "loras"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="LoRAs" side="bottom">
          <LoraCard loras={loras} family={familyMatch.family} blocked={familyMatch.blocked} />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "wild"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Wildcards" side="bottom">
          <WildcardCard files={wildcards} onInsert={insertWildcard} expanded={expandedPreview} />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "graph"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="ComfyUI graph" side="bottom">
          <GraphCard job={active} onDownload={(k) => active && downloadJob(active, k)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MediaWell({
  media,
  onFiles,
}: {
  media: MediaRef[];
  onFiles: (files: FileList | File[]) => void;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Input</p>
        {media.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted hover:text-fg"
            onClick={() => useForge.getState().clearMedia()}
          >
            Clear
          </button>
        )}
      </div>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl bg-raised px-3 text-center text-sm text-muted shadow-[var(--shadow-border)]">
        <ImagePlus className="mb-2 size-4" />
        Drop stills or video
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {media.map((m) => (
          <div key={m.id} className="relative size-16 overflow-hidden rounded-lg bg-raised">
            {m.kind === "video" ? (
              <video src={m.dataUrl} className="size-full object-cover" muted />
            ) : (
              <img src={m.dataUrl} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              className="absolute right-0.5 top-0.5 rounded-full bg-bg/80 p-1"
              onClick={() => useForge.getState().removeMedia(m.id)}
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage({
  src,
  kind,
  scan,
  showBoxes,
  status,
  error,
  mode,
  onFiles,
}: {
  src: string | null;
  kind: "image" | "video";
  scan: Job["scan"] | null;
  showBoxes: boolean;
  status?: Job["status"];
  error?: string;
  mode: Mode;
  onFiles: (files: FileList | File[]) => void;
}) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)] md:aspect-[4/3]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
    >
      {src ? (
        kind === "video" ? (
          <video src={src} controls className="size-full object-contain" />
        ) : (
          <img src={src} alt="" className="size-full object-contain" />
        )
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
          <Clapperboard className="size-6 text-subtle" />
          <p className="font-display text-2xl italic">Make a still or a clip</p>
          <p className="max-w-sm text-sm text-muted">{MODE_META[mode].blurb}. Offline. Your GPU.</p>
        </div>
      )}
      {showBoxes && scan && src && kind === "image" && (
        <div className="pointer-events-none absolute inset-0">
          {scan.boxes.map((b) => (
            <div
              key={b.id}
              className="absolute border border-signal"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: `${b.w * 100}%`,
                height: `${b.h * 100}%`,
              }}
            >
              <span className="absolute -top-5 left-0 bg-signal px-1 text-[10px] text-signal-fg">
                {b.label} {pct(b.confidence)}
              </span>
            </div>
          ))}
        </div>
      )}
      {status && status !== "done" && (
        <div className="absolute left-3 top-3">
          <Badge variant={status === "error" ? "danger" : status === "held" ? "warn" : "signal"}>
            {status}
          </Badge>
        </div>
      )}
      {error && (
        <p className="absolute inset-x-3 bottom-3 rounded-lg bg-bg/80 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function DetectorCard({
  scan,
  showBoxes,
  onToggleBoxes,
  onScan,
  busy,
  onUseTags,
}: {
  scan: Job["scan"] | null;
  showBoxes: boolean;
  onToggleBoxes: (v: boolean) => void;
  onScan: () => void;
  busy: boolean;
  onUseTags: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Detector</p>
        <Button variant="secondary" size="sm" onClick={onScan} disabled={busy}>
          <ScanSearch />
          Scan
        </Button>
      </div>
      {scan ? (
        <>
          <p className="text-sm leading-relaxed text-fg">{scan.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scan.tags.map((t) => (
              <Badge key={t.tag}>
                {t.tag}
                <span className="ml-1 text-subtle">{pct(t.confidence)}</span>
              </Badge>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {scan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Label htmlFor="boxes">Boxes</Label>
            <Switch id="boxes" checked={showBoxes} onCheckedChange={onToggleBoxes} />
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={onUseTags}>
            Send tags to prompt
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Generate or drop a frame. The local scanner names what it sees — tags first, boxes as a
          toggle.
        </p>
      )}
    </div>
  );
}

function LoraCard({
  loras,
  family,
  blocked,
}: {
  loras: LoraEntry[];
  family: string;
  blocked: LoraEntry[];
}) {
  const [name, setName] = useState("");
  const [filename, setFilename] = useState("");
  const [triggers, setTriggers] = useState("");

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">LoRA stack</p>
      <p className="mt-1 text-xs text-muted">
        Active family: {family}. Wrong-family LoRAs stay off the graph.
      </p>
      <div className="mt-3 space-y-3">
        {loras.map((l) => (
          <div key={l.id} className="rounded-xl bg-raised p-3 shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-2">
              <Switch
                checked={l.enabled}
                onCheckedChange={(v) => useForge.getState().upsertLora({ ...l, enabled: v })}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{l.name}</p>
                <p className="truncate text-[11px] text-subtle">
                  {l.filename} · {l.family}
                </p>
              </div>
              <button
                type="button"
                className="text-subtle hover:text-danger"
                onClick={() => useForge.getState().removeLora(l.id)}
                aria-label={`Remove ${l.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted">
                UNet {l.unetStrength.toFixed(2)}
                <Slider
                  className="mt-1"
                  min={0}
                  max={1.2}
                  step={0.05}
                  value={[l.unetStrength]}
                  onValueChange={(v) =>
                    useForge.getState().upsertLora({ ...l, unetStrength: v[0] ?? l.unetStrength })
                  }
                />
              </label>
              <label className="text-[11px] text-muted">
                CLIP {l.clipStrength.toFixed(2)}
                <Slider
                  className="mt-1"
                  min={0}
                  max={1.2}
                  step={0.05}
                  value={[l.clipStrength]}
                  onValueChange={(v) =>
                    useForge.getState().upsertLora({ ...l, clipStrength: v[0] ?? l.clipStrength })
                  }
                />
              </label>
            </div>
            {l.triggerWords.length > 0 && (
              <p className="mt-2 text-[11px] text-subtle">Triggers: {l.triggerWords.join(", ")}</p>
            )}
          </div>
        ))}
      </div>
      {blocked.length > 0 && (
        <p className="mt-2 text-xs text-warn">
          Held back: {blocked.map((b) => b.name).join(", ")}
        </p>
      )}
      <div className="mt-4 space-y-2">
        <Input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="filename.safetensors"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        />
        <Input
          placeholder="trigger words, comma separated"
          value={triggers}
          onChange={(e) => setTriggers(e.target.value)}
        />
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            if (!filename.trim()) return;
            useForge.getState().upsertLora({
              id: uid(),
              filename: filename.trim(),
              name: name.trim() || filename.trim(),
              family: family as ModelFamily,
              triggerWords: triggers
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              unetStrength: 0.8,
              clipStrength: 0.8,
              enabled: true,
            });
            setName("");
            setFilename("");
            setTriggers("");
          }}
        >
          Add LoRA
        </Button>
      </div>
    </div>
  );
}

function WildcardCard({
  files,
  onInsert,
  expanded,
}: {
  files: { name: string; lines: string[] }[];
  onInsert: (name: string) => void;
  expanded: string;
}) {
  const [editName, setEditName] = useState(files[0]?.name ?? "color");
  const current = files.find((f) => f.name === editName) ?? files[0];
  const [body, setBody] = useState(current?.lines.join("\n") ?? "");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const f = files.find((x) => x.name === editName);
    if (f) setBody(f.lines.join("\n"));
  }, [editName, files]);

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">Wildcards</p>
      <p className="mt-1 text-xs text-muted">
        __name__ from a file, or {"{red|blue}"}. Same seed, same roll.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {files.map((f) => (
          <button
            key={f.name}
            type="button"
            className={cn(
              "h-9 rounded-full px-3 text-xs",
              f.name === editName ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
            onClick={() => {
              setEditName(f.name);
              onInsert(f.name);
            }}
          >
            __{f.name}__
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3 min-h-24 font-mono text-xs"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() =>
          current &&
          useForge.getState().upsertWildcard({
            name: current.name,
            lines: body.split("\n"),
          })
        }
      />
      <div className="mt-2 flex gap-2">
        <Input
          placeholder="new file name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => {
            const n = newName.trim().replace(/\s+/g, "_");
            if (!n) return;
            useForge.getState().upsertWildcard({ name: n, lines: ["one", "two"] });
            setEditName(n);
            setNewName("");
          }}
        >
          Add
        </Button>
      </div>
      <p className="mt-3 line-clamp-3 text-[11px] text-subtle">Preview: {expanded || "—"}</p>
    </div>
  );
}

function GraphCard({
  job,
  onDownload,
  className,
}: {
  job: Job | null;
  onDownload: (kind: "ui" | "api" | "png") => void;
  className?: string;
}) {
  const nodes = job ? Object.keys(job.apiWorkflow).length : 0;
  return (
    <div className={cn("rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]", className)}>
      <div className="mb-2 flex items-center gap-2">
        <Workflow className="size-4 text-muted" />
        <p className="text-sm font-medium">ComfyUI graph</p>
      </div>
      {job ? (
        <>
          <p className="text-xs text-muted">
            {nodes} nodes · {MODE_META[job.mode].label} · seed {job.seed}
          </p>
          <ScrollArea className="mt-3 h-32 rounded-lg bg-raised p-2">
            <pre className="font-mono text-[10px] leading-relaxed text-subtle">
              {JSON.stringify(job.apiWorkflow, null, 2).slice(0, 1200)}
            </pre>
          </ScrollArea>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => onDownload("ui")}>
              UI JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onDownload("api")}>
              API
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onDownload("png")}>
              <Download />
              PNG
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Generate once and the graph lands here — and in ComfyUI when connected.</p>
      )}
    </div>
  );
}

function NetworkCard({ urls, comfy }: { urls: string[]; comfy: boolean }) {
  const primary = urls[0] ?? "http://YOUR-PC-IP:8080";
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="size-4 text-signal" />
        <p className="text-sm font-medium">LAN</p>
      </div>
      <p className="text-xs text-muted">
        Phone and laptop, same Wi-Fi. No cloud. {comfy ? "ComfyUI is answering." : "Start ComfyUI on this PC to queue."}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <QrMark value={primary} />
        <div className="min-w-0 space-y-1">
          {urls.length ? (
            urls.map((u) => (
              <p key={u} className="break-all font-mono text-xs text-fg">
                {u}
              </p>
            ))
          ) : (
            <p className="font-mono text-xs text-subtle">{primary}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsForm() {
  const settings = useForge((s) => s.settings);
  const comfy = useForge((s) => s.comfy);
  const patch = (p: Partial<typeof settings>) => useForge.getState().setSettings(p);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        ComfyUI path on this PC is ~/comfy/ComfyUI, port 8188, listening on all interfaces. Forge never
        calls the internet for generation.
      </p>
      <div>
        <Label>ComfyUI address</Label>
        <Input
          className="mt-1"
          value={settings.baseUrl}
          onChange={(e) => patch({ baseUrl: e.target.value })}
        />
      </div>
      <div>
        <Label>Still family</Label>
        <div className="mt-2 flex gap-2">
          {(["flux", "sdxl"] as const).map((f) => (
            <Button
              key={f}
              variant={settings.stillFamily === f ? "default" : "secondary"}
              size="sm"
              onClick={() => patch({ stillFamily: f })}
            >
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <Field label="Flux UNET" value={settings.fluxUnet} onChange={(v) => patch({ fluxUnet: v })} options={comfy?.unets} />
      <Field label="Flux CLIP-L" value={settings.fluxClipL} onChange={(v) => patch({ fluxClipL: v })} />
      <Field label="Flux T5" value={settings.fluxT5} onChange={(v) => patch({ fluxT5: v })} />
      <Field label="Flux VAE" value={settings.fluxVae} onChange={(v) => patch({ fluxVae: v })} options={comfy?.vaes} />
      <Field
        label="SDXL checkpoint"
        value={settings.sdxlCheckpoint}
        onChange={(v) => patch({ sdxlCheckpoint: v })}
        options={comfy?.checkpoints}
      />
      <Field label="WAN UNET" value={settings.wanUnet} onChange={(v) => patch({ wanUnet: v })} options={comfy?.unets} />
      <Field label="WAN CLIP" value={settings.wanClip} onChange={(v) => patch({ wanClip: v })} />
      <Field label="WAN VAE" value={settings.wanVae} onChange={(v) => patch({ wanVae: v })} options={comfy?.vaes} />
      <div>
        <Label>Steps {settings.steps}</Label>
        <Slider
          className="mt-2"
          min={4}
          max={40}
          step={1}
          value={[settings.steps]}
          onValueChange={(v) => patch({ steps: v[0] ?? settings.steps })}
        />
      </div>
      <div>
        <Label>Flux guidance {settings.fluxGuidance}</Label>
        <Slider
          className="mt-2"
          min={1}
          max={6}
          step={0.1}
          value={[settings.fluxGuidance]}
          onValueChange={(v) => patch({ fluxGuidance: v[0] ?? settings.fluxGuidance })}
        />
      </div>
      {comfy?.loras?.length ? (
        <p className="text-xs text-muted">{comfy.loras.length} LoRAs visible on ComfyUI</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      {options && options.length > 0 ? (
        <select
          className="mt-1 h-11 w-full rounded-lg bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          value={options.includes(value) ? value : options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {!options.includes(value) && <option value={value}>{value}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

async function makeCardPng(): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#f3f2ee";
  ctx.font = "italic 96px serif";
  ctx.fillText("Forge", 88, 200);
  ctx.fillStyle = "#9a9a94";
  ctx.font = "28px sans-serif";
  ctx.fillText("ComfyUI workflow embedded", 88, 260);
  return c.toDataURL("image/png");
}
