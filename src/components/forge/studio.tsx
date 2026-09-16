import {
  Download,
  ImagePlus,
  Loader2,
  ScanSearch,
  Settings2,
  Shuffle,
  Sparkles,
  Trash2,
  Lock,
  Unlock,
  Volume2,
  Heart,
  Images,
  X,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent as ForgeDragEvent } from "react";
import { SpeechMic, appendSpoken } from "@/components/forge/speech-mic";
import { applyArtWrap, applyQualityOffers, ART_WRAPS, QUALITY_OFFERS, qualityWantsHires, randomSceneLine, LOOK_APPENDS } from "@/lib/forge/looks";
import { toast as sonnerToast } from "sonner";
const toast = {
  error: sonnerToast.error.bind(sonnerToast),
  success: (_msg?: string) => {},
  message: (_msg?: string) => {},
};
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
import { browserPoll, browserQueue, browserTag, lanProbe, lanQueue, lanGenerate, lanBrain, lanBrainStatus, asDataUrl } from "@/lib/forge/comfy-browser";
import { addClipSound, fetchLive, fetchRecent, forgetForgeOnThisDevice, isLanRemote, mergeLiveJobs, pushLive } from "@/lib/forge/live-room";
import { lanInfoFn, pollComfyFn, probeComfyFn, queueComfyFn, expandDiskWildcardsFn, peekWildcardFn, tagWithWd14Fn, listWorkflowsFn, queueSavedWorkflowFn, probeOllamaFn, writeLlmIdeasFn, listComfyRecentFn, shredComfyFn, comfyMediaFn, writeStoryFn, appendPromptFn, listPromptsFn } from "@/lib/forge/functions";
import { extractFrame, scanFromTags, scanMedia, mergeScan } from "@/lib/forge/detector";
import { downloadBlob, embedWorkflowPng, dataUrlToBytes, readPngText, seedFromPngText, seedFromBytes } from "@/lib/forge/png";
import { useForge } from "@/lib/forge/store";
import {
  ASPECTS,
  MODE_META,
  MODES,
  generateNegative,
  familyOfSelection,
  guessArch,
  loraTriggerFromFilename,
  loraFitsCheckpoint,
  guessLoraLane,
  resolveLoraName,
  CKPT_STYLES,
  checkpointMatchesStyle,
  guessStyles,
  isWanUnet,
  wanPairOk,
  wanStackVersion,
  pickWanVae,
  pickWanClip,
  pickPlayUnet,
  pickT2vUnet,
  pairWanUnets,
  wanFrameCount,
  wanFpsForDuration,
  isRealCheckpoint,
  isImageCheckpoint,
  canEditPhoto,
  pickVaeName,
  resolveCkpt,
  sameStill,
  stillKey,
  settingsForCheckpoint,
  settingsForFamily,
  negativeForCheckpoint,
  negativeForPrompt,
  shouldReplaceNegative,
  type Job,
  type LoraEntry,
  type MediaRef,
  type Mode,
  type ModelFamily,
} from "@/lib/forge/types";
import { PROMPT_FLAVORS, expandPrompt, grokExpand, writeIdeas, writePrompt, isAdult, flattenPrompt, userLead, recoverScene, composeNewScene, isPurpleProse, sceneCore, tokenOverlap, nsfwWanted, isShortSubject, type PromptFlavor } from "@/lib/forge/wildcards";
import { composeI2iPrompt, expandEditFields } from "@/lib/forge/edit-prompt";
import { isVideoName, mediaMime, withVideoDataUrl } from "@/lib/forge/media-mime";
import { writeExtreme, writeDarkSet, writeTabooSet, writeHorrorSet, isWashed, NSFW_TYPES, nsfwGroup, writeMenus, WHO_BITS, WHERE_BITS, MORE_BITS, COMIC_BITS, EVIL_BITS, FACE_BITS, BODY_BITS, CLOTHES_BITS, PLACE_BITS, CAM_BITS, LIGHT_BITS } from "@/lib/forge/extreme";
import { COMIC_LAYOUTS, COMIC_INK, buildComicPrompt } from "@/lib/forge/comic";
import {
  apiToUiWorkflow,
  buildApiWorkflow,
  compatibleLoras,
  i2iDenoise,
  jobBasename,
  matchNamedLoras,
  pickLorasForPrompt,
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
    const looksVideo = file.type.startsWith("video") || isVideoName(file.name);
    const looksImage =
      file.type.startsWith("image") ||
      !file.type ||
      /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
    if (!looksImage && !looksVideo) continue;
    let dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
    if (looksVideo) dataUrl = withVideoDataUrl(dataUrl, file.name, file.type);
    out.push({
      id: uid(),
      kind: looksVideo ? "video" : "image",
      name: file.name || (looksVideo ? "drop.mp4" : "drop.png"),
      dataUrl,
    });
  }
  return out;
}

function ForgeClip({
  src,
  className,
  muted,
  controls,
  autoPlay,
}: {
  src: string;
  className?: string;
  muted?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
}) {
  const type = mediaMime(src, src.startsWith("data:") ? src.slice(5).split(";")[0] : "");
  return (
    <video className={className} muted={muted} controls={controls} autoPlay={autoPlay} playsInline loop preload="metadata">
      <source src={src} type={type.startsWith("video/") ? type : "video/mp4"} />
    </video>
  );
}

function logForge(level: "info" | "warn" | "error", source: string, message: string) {
  useForge.getState().pushLog({ level, source, message });
}

export function Studio() {
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<
    null | "settings" | "loras" | "wild" | "graph" | "scan" | "library" | "story" | "history"
  >(null);
  const [library, setLibrary] = useState<{ folder: "input" | "output"; name: string; mtime: number }[]>([]);
  const [libraryAll, setLibraryAll] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [liveFiles, setLiveFiles] = useState<{ folder: "input" | "output"; name: string; mtime: number }[]>([]);
  const [showShow, setShowShow] = useState(false);
  const [slides, setSlides] = useState<{ folder: "input" | "output"; name: string; mtime: number }[]>([]);
  const [likes, setLikes] = useState<{ id: string; src: string; prompt: string; seed: number }[]>([]);
  const [zoom, setZoom] = useState<{ src: string; kind: "image" | "video"; name?: string } | null>(null);
  const [nsfwPick, setNsfwPick] = useState<Set<string>>(new Set());
  const [ideas, setIdeas] = useState<string[]>([]);
  const [graphs, setGraphs] = useState<string[]>([]);
  const [llm, setLlm] = useState<{ ok: boolean; models: string[]; message: string }>({
    ok: false,
    models: [],
    message: "Ollama off",
  });
  const [tab, setTab] = useState<"image" | "combine" | "comic" | "video" | "errors" | "mixes">("image");
  const [comicLayout, setComicLayout] = useState("2x2");
  const [comicInk, setComicInk] = useState("manga-ink");
  const [mixPick, setMixPick] = useState<string[]>([]);
  const [mixJobIds, setMixJobIds] = useState<string[]>([]);
  const [mixQ, setMixQ] = useState("");
  const skipIdeaRefresh = useRef(false);
  const genLock = useRef(0);
  const lastComfyOk = useRef<boolean | null>(null);
  const [chipTab, setChipTab] = useState<"write" | "types" | "wild">("write");
  const [writeCat, setWriteCat] = useState("face");
  const [writeQ, setWriteQ] = useState("");
  const [brainOn, setBrainOn] = useState(false);
  const [brainModel, setBrainModel] = useState("");
  const [brainBusy, setBrainBusy] = useState(false);
  const [queueBanner, setQueueBanner] = useState("");
  const [typeQ, setTypeQ] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [dock, setDock] = useState<"off" | "write" | "look">("off");
  const [wildOpen, setWildOpen] = useState<{
    name: string;
    total: number;
    preview: string[];
    rolled: string;
  } | null>(null);
  const filePickRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const negRef = useRef<HTMLTextAreaElement>(null);

  const mode = useForge((s) => s.mode);
  const prompt = useForge((s) => s.prompt);
  const editRemove = useForge((s) => s.editRemove);
  const editAdd = useForge((s) => s.editAdd);
  const editChange = useForge((s) => s.editChange);
  const refPrompt = useForge((s) => s.refPrompt);
  const negative = useForge((s) => s.negative);
  const negLocked = useForge((s) => s.negLocked);
  const seed = useForge((s) => s.seed);
  const seedLocked = useForge((s) => s.seedLocked);
  const aspect = useForge((s) => s.aspect);
  const denoise = useForge((s) => s.denoise);
  const duration = useForge((s) => s.duration);
  const soundOn = useForge((s) => s.soundOn);
  const showBoxes = useForge((s) => s.showBoxes);
  const media = useForge((s) => s.media);
  const loras = useForge((s) => s.loras);
  const wildcards = useForge((s) => s.wildcards);
  const jobs = useForge((s) => s.jobs);
  const activeJobId = useForge((s) => s.activeJobId);
  const blankStage = useForge((s) => s.blankStage);
  const settings = useForge((s) => s.settings);
  const comfy = useForge((s) => s.comfy);
  const lanUrls = useForge((s) => s.lanUrls);
  const liveScan = useForge((s) => s.liveScan);
  const ckptStyle = useForge((s) => s.ckptStyle);
  const artWrap = useForge((s) => s.artWrap);
  const qualityPick = useForge((s) => s.qualityPick);
  const nsfwMode = useForge((s) => s.nsfwMode);
  const promptRoll = useForge((s) => s.promptRoll);
  const expandedPreview = useForge((s) => s.expandedPreview);
  const logs = useForge((s) => s.logs);

  const active = blankStage ? null : (jobs.find((j) => j.id === activeJobId) ?? jobs[0] ?? null);
  const meta = MODE_META[mode];
  const activeName =
    meta.video
      ? settings.wanUnet || settings.checkpoint || "no WAN model"
      : settings.stillLoader === "flux-unet"
        ? settings.fluxUnet
        : settings.checkpoint || "pick a checkpoint";
  const family = guessArch(
    meta.video ? settings.wanUnet || settings.checkpoint : settings.checkpoint || settings.fluxUnet,
  );
  const familyMatch = compatibleLoras(loras, mode, family);

  useEffect(() => {
    document.documentElement.dataset.theme = "void";
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
    }
    if (isLanRemote()) {
      forgetForgeOnThisDevice();
      void fetch("/forge-api/ping", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { ok?: boolean }) => {
          setQueueBanner(j.ok ? "" : "PC queue is down — restart Forge on the PC.");
        })
        .catch(() => setQueueBanner("Cannot reach the PC queue. Same Wi-Fi? Forge running?"));
    } else {
      void useForge.persist.rehydrate();
    }
    void listWorkflowsFn()
      .then(setGraphs)
      .catch(() => {});
    let stop = false;
    async function tick() {
      try {
        const list = await fetchRecent().catch(() => listComfyRecentFn({ data: { all: true } }));
        if (!stop) setLiveFiles(list);
      } catch {
        /* laptop still works if Comfy list fails */
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const live = await fetchLive();
        if (stop || !live.jobs.length) return;
        const next = mergeLiveJobs(useForge.getState().jobs, live.jobs);
        useForge.getState().ingestJobs(next);
      } catch {
        /* keep local jobs */
      }
    }
    void pull();
    const id = setInterval(() => void pull(), 1200);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!prompt.includes("__") && !prompt.includes("{")) {
      useForge.getState().setExpandedPreview(prompt);
      return;
    }
    const t = window.setTimeout(() => {
      void expandDiskWildcardsFn({
        data: { prompt, seed, extra: wildcards },
      }).then((r) => useForge.getState().setExpandedPreview(r.expanded));
    }, 200);
    return () => window.clearTimeout(t);
  }, [prompt, wildcards, seed]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        await useForge.persist.rehydrate();
        const status = await lanProbe().catch(() =>
          probeComfyFn({ data: { baseUrl: settings.baseUrl } }),
        );
        if (!stop) {
          useForge.getState().applyComfy(status);
          if (!status.ok) {
            if (lastComfyOk.current !== false) {
              logForge(
                "error",
                "Comfy",
                "Comfy is off. On T1000: cd ~/comfy/ComfyUI && source .venv/bin/activate && python main.py --listen 0.0.0.0 --port 8188",
              );
            }
            lastComfyOk.current = false;
          } else {
            if (lastComfyOk.current === false) {
              logForge("info", "Comfy", `Back · ${status.checkpoints.length} checkpoints`);
            }
            lastComfyOk.current = true;
          }
        }
      } catch {
        if (!stop) {
          useForge.getState().applyComfy({
            ok: false,
            message: "ComfyUI is not reachable at this address",
            checkpoints: [],
            unets: [],
            loras: [],
            vaes: [],
            clips: [],
            wildcards: [],
            taggerClass: "",
            taggerModels: [],
          });
          if (lastComfyOk.current !== false) {
            logForge(
              "error",
              "Comfy",
              "Comfy is off. On T1000: cd ~/comfy/ComfyUI && source .venv/bin/activate && python main.py --listen 0.0.0.0 --port 8188",
            );
          }
          lastComfyOk.current = false;
        }
      }
    }
    tick();
    const id = setInterval(() => {
      const busy = useForge.getState().jobs.some((j) => j.status === "running");
      if (!busy) void tick();
    }, 45000);
    lanInfoFn()
      .then((info) => {
        useForge.getState().setLanUrls(info.addresses.map((a) => `http://${a}:${info.port}`));
      })
      .catch(() => {});
    lanBrainStatus()
      .then((b) => {
        setBrainOn(b.ok);
        setBrainModel(b.model);
      })
      .catch(() => {});
    const onPaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      const cd = e.clipboardData;
      if (!cd) return;
      for (const f of Array.from(cd.files || [])) files.push(f);
      if (!files.length) {
        for (const it of Array.from(cd.items || [])) {
          if (it.kind === "file") {
            const f = it.getAsFile();
            if (f) files.push(f);
          }
        }
      }
      if (!files.length) return;
      e.preventDefault();
      void onDropFiles(files);
    };
    const onDragOver = (e: DragEvent) => {
      const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
      if (types.includes("Files") || types.includes("text/plain") || types.includes("application/x-forge-still")) {
        e.preventDefault();
      }
    };
    const onWinDrop = (e: DragEvent) => {
      const still = e.dataTransfer ? readForgeStill(e.dataTransfer) : null;
      if (still) {
        e.preventDefault();
        void placeLibraryStill(still, useForge.getState().mode === "ref2i" ? "add" : "edit");
        return;
      }
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      void onDropFiles(e.dataTransfer.files);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onWinDrop);
    return () => {
      stop = true;
      clearInterval(id);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onWinDrop);
    };
  }, [settings.baseUrl]);

  useEffect(() => {
    let stop = false;
    const url = settings.llmUrl || "http://127.0.0.1:11434";
    void probeOllamaFn({ data: { baseUrl: url } })
      .then((s) => {
        if (!stop) setLlm(s);
      })
      .catch(() => {
        if (!stop) setLlm({ ok: false, models: [], message: "Ollama not reachable" });
      });
    return () => {
      stop = true;
    };
  }, [settings.llmUrl]);

  useEffect(() => {
    const id = setInterval(async () => {
      const running = useForge.getState().jobs.filter(
        (j) => (j.status === "running" || j.status === "queued") && j.promptId,
      );
      if (!running.length) return;
      for (const job of running) {
        try {
          const r = await browserPoll(job.promptId!).catch(async () =>
            pollComfyFn({
              data: { baseUrl: settings.baseUrl, promptId: job.promptId! },
            }),
          );
          if ("error" in r && r.error) {
            if (job.status !== "error") {
              useForge.getState().patchJob(job.id, {
                status: "error",
                error: r.error,
                log: r.log,
                progress: 0,
              });
              toast.error(r.error);
              logForge("error", "Generate", `${r.error}${r.log ? `\n${r.log}` : ""}`);
            }
            continue;
          }
          if (!r.ready) {
            useForge.getState().patchJob(job.id, {
              progress: r.progress,
              log: r.log,
            });
            continue;
          }
          const shown = r.dataUrl?.startsWith("data:")
            ? r.dataUrl
            : r.dataUrl
              ? await asDataUrl(r.dataUrl).catch(() => r.dataUrl)
              : r.dataUrl;
          let resultName = "filename" in r ? r.filename : undefined;
          let resultDataUrl = shown;
          const isVid =
            r.kind === "video" || /\.(mp4|webm|mov|m4v)$/i.test(resultName || "");
          const wantSound = useForge.getState().soundOn && isVid;
          if (wantSound) {
            let sounded = await addClipSound(resultName || "", job.expandedPrompt || job.prompt);
            if (sounded.error && /not on disk/i.test(sounded.error || "")) {
              await new Promise((r) => setTimeout(r, 1600));
              sounded = await addClipSound(resultName || "", job.expandedPrompt || job.prompt);
            }
            if (sounded.name) {
              resultName = sounded.name;
              resultDataUrl = `/forge-media?folder=output&name=${encodeURIComponent(sounded.name)}`;
            } else if (sounded.error) {
              logForge("warn", "Sound", sounded.error);
              setQueueBanner(sounded.error);
            }
          }
          useForge.getState().patchJob(job.id, {
            status: "done",
            resultDataUrl,
            resultKind: r.kind,
            resultName,
            resultFolder: "folder" in r ? r.folder : "output",
          });
          const done = useForge.getState().jobs.find((j) => j.id === job.id);
          if (done) void pushLive(done);
          setShowSource(false);
          if (r.extras?.length) {
            for (const extra of r.extras) {
              useForge.getState().addJob({
                ...job,
                id: uid(),
                status: "done",
                resultDataUrl: extra.dataUrl,
                resultKind: extra.kind,
                resultName: "filename" in extra ? extra.filename : undefined,
                progress: 100,
              });
            }
            toast.success(`Batch ${1 + r.extras.length} stills`);
          }
          const tagged =
            "tags" in r && r.tags
              ? scanFromTags(r.tags)
              : r.dataUrl
                ? await runWd14Scan(r.dataUrl)
                : null;
          if (tagged) {
            useForge.getState().patchJob(job.id, { scan: tagged });
            useForge.getState().setLiveScan(tagged);
          }
          toast.success("Done");
        } catch (err) {
          useForge.getState().patchJob(job.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Poll failed",
          });
        }
      }
    }, 1400);
    return () => clearInterval(id);
  }, [settings.baseUrl]);

  const lastResult = active?.resultDataUrl || null;
  const sourceSrc = media[0]?.dataUrl || null;
  const stageSrc = tab === "combine" ? null : showSource && sourceSrc ? sourceSrc : lastResult;
  const stageKind = showSource && media[0]
    ? media[0].kind
    : (active?.resultKind ?? "image");
  const scan = active?.scan ?? liveScan;

  useEffect(() => {
    if (mode !== "i2i" && mode !== "ref2i") return;
    if (!sourceSrc) return;
    const t = window.setTimeout(() => {
      void runWd14Scan(sourceSrc).then((result) => {
        useForge.getState().setLiveScan(result);
        useForge.getState().setShowBoxes(true);
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [mode, sourceSrc]);

  const gallery = useMemo(() => {
    const out: { src: string; kind: "image" | "video"; name: string }[] = [];
    const seen = new Set<string>();
    const add = (src: string | null | undefined, kind: "image" | "video", name: string) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      out.push({ src, kind, name });
    };
    add(stageSrc, stageKind === "video" ? "video" : "image", "stage");
    for (const l of likes) add(l.src, "image", "liked");
    for (const f of liveFiles) {
      add(`/forge-media?folder=output&name=${encodeURIComponent(f.name)}`, "image", f.name);
    }
    for (const j of jobs) {
      if (j.resultDataUrl) add(j.resultDataUrl, j.resultKind, `seed ${j.seed}`);
    }
    return out;
  }, [stageSrc, stageKind, likes, liveFiles, jobs]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoom(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void deleteThisStill(zoom.src);
        return;
      }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      if (!gallery.length) return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const i = gallery.findIndex((g) => g.src === zoom.src);
      const next = gallery[(Math.max(i, 0) + dir + gallery.length) % gallery.length];
      if (next) setZoom(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, gallery]);

  async function onDropFiles(files: FileList | File[]) {
    const items = await filesToMedia(files);
    if (!items.length) {
      toast.error("That file is not an image or video");
      return;
    }
    const imgs = items.filter((m) => m.kind === "image");
    const vids = items.filter((m) => m.kind === "video");
    const st = useForge.getState();
    const combining = st.mode === "ref2i" || tab === "combine";
    if (combining && imgs.length) {
      st.addMedia(imgs);
      const n = useForge.getState().media.filter((m) => m.kind === "image").length;
      setShowSource(true);
      toast.success(
        n < 2
          ? `Combine: ${n} photo — paste or drop ${2 - n} more`
          : `Combine: ${n} photos. Type the new scene, Generate.`,
      );
      return;
    }
    if (imgs.length === 1 && vids.length === 0) {
      useForge.getState().setMedia(imgs);
      if (tab === "video") {
        useForge.getState().setMode("i2v");
        setShowSource(true);
        logForge("info", "Video", "Still is frame 1 — type the motion, Generate");
        void adoptDroppedStill(imgs[0]!.dataUrl);
        return;
      }
      useForge.getState().setMode("i2i");
      useForge.getState().setLiveScan(null);
      const d = useForge.getState().denoise;
      if (d < 0.55 || d === 1) useForge.getState().setDenoise(0.78);
      setShowSource(true);
      toast.success("This picture is the one being edited.");
      void adoptDroppedStill(imgs[0]!.dataUrl);
      return;
    }
    useForge.getState().setMedia(items);
    useForge.getState().setMode(items.some((m) => m.kind === "video") ? "v2v" : imgs.length >= 2 ? "ref2i" : "i2i");
    setShowSource(true);
    if (imgs.length >= 2) toast.success(`Combine: ${imgs.length} photos`);
  }

  function readForgeStill(dt: DataTransfer): { src: string; name: string; folder?: "input" | "output" } | null {
    const raw = dt.getData("application/x-forge-still") || dt.getData("text/plain");
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as { src?: string; name?: string; folder?: "input" | "output" };
      if (j.src) return { src: j.src, name: j.name || "still.png", folder: j.folder };
    } catch {
      if (raw.startsWith("/") || raw.startsWith("http") || raw.startsWith("data:")) {
        return { src: raw, name: "still.png" };
      }
    }
    return null;
  }

  function dragForgeStill(
    e: ForgeDragEvent,
    still: { src: string; name: string; folder?: "input" | "output" },
  ) {
    const payload = JSON.stringify(still);
    e.dataTransfer.setData("application/x-forge-still", payload);
    e.dataTransfer.setData("text/plain", payload);
    e.dataTransfer.effectAllowed = "copy";
  }

  async function placeLibraryStill(
    still: { src: string; name: string; folder?: "input" | "output" },
    how: "edit" | "add",
  ) {
    const dataUrl = await asDataUrl(still.src).catch(() => still.src);
    const item = {
      id: uid(),
      kind: "image" as const,
      name: still.name,
      dataUrl,
      folder: still.folder || "output",
    };
    const st = useForge.getState();
    if (tab === "video") {
      loadForVideo(dataUrl, still.name, still.folder);
      return;
    }
    const combining = how === "add" || st.mode === "ref2i" || tab === "combine";
    if (combining && how === "add") {
      const n = pushCombinePhoto(item);
      setShowSource(true);
      logForge("info", "Combine", n < 2 ? `${n} photo — tap a different one` : `${n} different photos`);
      return;
    }
    loadForEdit(dataUrl, still.name, still.folder);
  }

  function openLibrary() {
    setSheet("library");
    void listComfyRecentFn({ data: { all: true } })
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }

  function combineCount() {
    return useForge.getState().media.filter((m) => m.kind === "image").length;
  }

  function alreadyInCombine(item: { dataUrl?: string; name?: string }) {
    const imgs = useForge.getState().media.filter((m) => m.kind === "image");
    return imgs.some((m) => sameStill(m, item));
  }

  function pushCombinePhoto(item: MediaRef) {
    const st = useForge.getState();
    st.setMode("ref2i");
    const n = st.media.filter((m) => m.kind === "image").length;
    if (alreadyInCombine(item)) return n;
    if (n >= 5) {
      toast.error("Combine holds 5 photos. Tap one in the slots to remove it.");
      return n;
    }
    st.addMedia([item]);
    return useForge.getState().media.filter((m) => m.kind === "image").length;
  }

  function beginCombine() {
    const st = useForge.getState();
    const d = st.denoise;
    if (d < 0.62 || d === 1) st.setDenoise(0.76);
    st.setMode("ref2i");
    setTab("combine");
    setShowSource(true);
    setZoom(null);
    let n = combineCount();
    if (n === 0) {
      const fromJob = jobs.find((j) => j.resultDataUrl && j.resultKind !== "video");
      const src =
        lastResult && (active?.resultKind ?? stageKind) !== "video"
          ? lastResult
          : fromJob?.resultDataUrl || null;
      if (src) {
        n = pushCombinePhoto({
          id: uid(),
          kind: "image",
          name: fromJob?.resultName || active?.resultName || "still.png",
          dataUrl: src,
          folder: fromJob?.resultFolder || active?.resultFolder,
        });
      }
    }
    if (n < 2) {
      void listComfyRecentFn({ data: { all: true } })
        .then((list) => {
          setLibrary(list);
          if (list.length) setSheet("library");
        })
        .catch(() => setLibrary([]));
    }
  }

  function onStageDrop(e: ForgeDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const still = readForgeStill(e.dataTransfer);
    if (still) {
      void placeLibraryStill(still, tab === "combine" || mode === "ref2i" ? "add" : tab === "video" ? "edit" : "edit");
      return;
    }
    if (e.dataTransfer.files.length) void onDropFiles(e.dataTransfer.files);
  }

  function loadForEdit(src: string, name: string, folder?: "input" | "output") {
    let f = folder;
    let n = name;
    try {
      const u = new URL(src, "http://127.0.0.1");
      n = n || u.searchParams.get("name") || u.searchParams.get("filename") || name;
      if (u.searchParams.get("folder") === "input" || u.searchParams.get("type") === "input") f = "input";
      if (u.searchParams.get("folder") === "output" || u.searchParams.get("type") === "output") f = "output";
    } catch {
      /* keep */
    }
    useForge.getState().setMedia([
      { id: uid(), kind: "image", name: n, dataUrl: src, folder: f || "output" },
    ]);
    useForge.getState().setMode("i2i");
    useForge.getState().setLiveScan(null);
    const d = useForge.getState().denoise;
    if (d < 0.55 || d === 1) useForge.getState().setDenoise(0.78);
    setShowSource(true);
    setTab("image");
    setZoom(null);
    toast.success("Edit photo — Take out / Put in / Change, then Generate");
  }

  function loadForVideo(src: string, name: string, folder?: "input" | "output") {
    let f = folder;
    let n = name;
    try {
      const u = new URL(src, "http://127.0.0.1");
      n = n || u.searchParams.get("name") || u.searchParams.get("filename") || name;
      if (u.searchParams.get("folder") === "input" || u.searchParams.get("type") === "input") f = "input";
      if (u.searchParams.get("folder") === "output" || u.searchParams.get("type") === "output") f = "output";
    } catch {
      /* keep */
    }
    useForge.getState().setMedia([
      { id: uid(), kind: "image", name: n, dataUrl: src, folder: f || "output" },
    ]);
    useForge.getState().setMode("i2v");
    useForge.getState().setSoundOn(true);
    setShowSource(true);
    setTab("video");
    setZoom(null);
    logForge("info", "Video", `${n} is frame 1. Type the motion, then Generate.`);
  }

  function playStill(src: string, name: string, folder?: "input" | "output") {
    loadForVideo(src, name, folder);
    void generate();
  }

  function clearEdit(kind: "photo" | "words" | "all") {
    const st = useForge.getState();
    if (kind === "photo" || kind === "all") {
      st.clearMedia();
      st.setLiveScan(null);
      setShowSource(false);
    }
    if (kind === "words" || kind === "all") {
      st.setEditRemove("");
      st.setEditAdd("");
      st.setEditChange("");
      if (kind === "all") st.setPrompt("");
    }
    toast.success(
      kind === "photo" ? "Photo cleared — drop a new one" : kind === "words" ? "Take out / Put in / Change emptied" : "Edit wiped. Drop a new photo.",
    );
  }

  function editThisStill() {
    const src = stageSrc;
    if (!src) {
      const fallback = jobs.find((j) => j.resultDataUrl && j.resultKind !== "video");
      if (!fallback?.resultDataUrl) {
        toast.error("No still yet — generate one or drop a photo, then Edit.");
        return;
      }
      loadForEdit(fallback.resultDataUrl, fallback.resultName || "edit.png", fallback.resultFolder);
      return;
    }
    void asDataUrl(src)
      .then((dataUrl) => {
        useForge.getState().setMedia([
          {
            id: uid(),
            kind: "image",
            name: active?.resultName || media[0]?.name || "edit.png",
            dataUrl,
            folder: active?.resultFolder || media[0]?.folder,
          },
        ]);
        useForge.getState().setMode("i2i");
        useForge.getState().setDenoise(0.82);
        setShowSource(true);
        setTab("image");
        toast.success("Editing this still. Type the change below, then Generate.");
      })
      .catch(() => {
        toast.error("Could not load that still. Drop the file onto the stage, then Edit.");
      });
  }

  function likeThisStill() {
    const src = stageSrc;
    if (!src) {
      toast.error("No still to like yet");
      return;
    }
    setLikes((prev) => {
      if (prev.some((l) => l.src === src)) return prev;
      return [{ id: uid(), src, prompt: useForge.getState().prompt, seed: useForge.getState().seed }, ...prev].slice(0, 16);
    });
    toast.success("Liked — Continue when you want the next beat");
  }

  function continueThisStill(fromSrc?: string) {
    const src = fromSrc || stageSrc;
    if (!src) {
      toast.error("Like or generate a still first, then Continue");
      return;
    }
    void (async () => {
      const dataUrl = await asDataUrl(src).catch(() => src);
      const st = useForge.getState();
      st.clearMedia();
      st.addMedia([{ id: uid(), kind: "image", name: "continue.png", dataUrl }]);
      st.setMode("i2i");
      st.setDenoise(0.52);
      if (st.seedLocked) st.toggleSeedLock();
      st.rollSeed();
      const p = st.prompt.trim();
      if (p && !/\b(next moment|continue the scene|then she|then he)\b/i.test(p)) {
        st.setPrompt(`${p}, next moment, same person, continue the scene`);
      }
      toast.success("Continue — next beat from this still");
      void generate();
    })();
  }

  function lockThisSeed(n: number, note: string) {
    useForge.getState().setSeed(n);
    if (!useForge.getState().seedLocked) useForge.getState().toggleSeedLock();
    toast.success(note);
  }

  function adoptJob(job: Job) {
    useForge.getState().setActiveJob(job.id);
    useForge.getState().setSeed(job.seed);
    if (!useForge.getState().seedLocked) useForge.getState().toggleSeedLock();
    const p = job.expandedPrompt || job.prompt;
    if (p) useForge.getState().setPrompt(p);
    if (job.scan) useForge.getState().setLiveScan(job.scan);
    toast.success(`This shot · seed ${job.seed} locked`);
  }

  async function adoptDroppedStill(dataUrl: string) {
    try {
      const bytes = await dataUrlToBytes(dataUrl);
      let n: number | undefined;
      let prompt: string | undefined;
      if (bytes[0] === 0x89) {
        const meta = seedFromPngText(readPngText(bytes));
        n = meta.seed;
        prompt = meta.prompt;
      }
      if (n == null) n = seedFromBytes(bytes);
      lockThisSeed(n, `Seed ${n} locked for this photo`);
      if (prompt && !useForge.getState().prompt.trim()) useForge.getState().setPrompt(prompt);
    } catch {
      /* ignore */
    }
    const scan = await runWd14Scan(dataUrl);
    if (scan) useForge.getState().setLiveScan(scan);
  }

  function remakeThisStill() {
    if (!active) {
      toast.error("Generate one first, then Remake");
      return;
    }
    useForge.getState().setPrompt(active.expandedPrompt || active.prompt);
    useForge.getState().setSeed(active.seed);
    if (!useForge.getState().seedLocked) useForge.getState().toggleSeedLock();
    useForge.getState().setMode(MODE_META[active.mode].video ? active.mode : "t2i");
    toast.success(`Remake · seed ${active.seed} locked. Tweak prompt or Generate.`);
  }

  async function deleteThisStill(srcOverride?: string) {
    const src = srcOverride || stageSrc;
    if (!src) {
      toast.error("Nothing to shred");
      return;
    }
    const hitJob =
      (active && (active.resultDataUrl === src || !srcOverride) ? active : null) ||
      useForge.getState().jobs.find((j) => j.resultDataUrl === src);
    const fromMedia = media.find((m) => m.dataUrl === src) || (showSource ? media[0] : null);
    let name = fromMedia?.name || hitJob?.resultName || "";
    let folder: "input" | "output" = fromMedia?.folder || hitJob?.resultFolder || "output";
    try {
      const u = new URL(src, "http://127.0.0.1");
      name = name || decodeURIComponent(u.searchParams.get("name") || u.searchParams.get("filename") || "");
      if (u.searchParams.get("folder") === "input" || u.searchParams.get("type") === "input") folder = "input";
    } catch {
      /* ignore */
    }
    if (!name) {
      const hit = liveFiles.find((f) => src.includes(encodeURIComponent(f.name)) || src.includes(f.name));
      if (hit) {
        name = hit.name;
        folder = hit.folder;
      }
    }
    if (name) {
      const r = await shredComfyFn({ data: { folder, name } });
      if (!r.ok) toast.error(r.message);
      else logForge("info", "Shred", r.message);
    }
    if (hitJob) useForge.getState().removeJob(hitJob.id);
    useForge.getState().clearMedia();
    useForge.getState().setActiveJob(null);
    setLikes((prev) => prev.filter((l) => l.src !== src));
    setLiveFiles((prev) => prev.filter((f) => f.name !== name));
    if (zoom?.src === src) setZoom(null);
    toast.success(name ? `Shredded ${name}` : "Removed from Forge (no disk file name — generate again then shred)");
  }

  function insertAtCursor(token: string) {
    const el = promptRef.current;
    if (!el) {
      useForge.getState().setPrompt(`${prompt} ${token}`.trim());
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${prompt.slice(0, start)}${token}${prompt.slice(end)}`;
    useForge.getState().setPrompt(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function ideaOpts(flavor: PromptFlavor, existing: string, seedVal: number) {
    const state = useForge.getState();
    return {
      flavor,
      files: state.wildcards,
      seed: seedVal,
      existing,
      family:
        state.settings.stillFamily === "sd15" ||
        guessArch(state.settings.checkpoint) === "sd15"
          ? ("sd15" as const)
          : state.settings.stillFamily,
      checkpoint: state.settings.checkpoint,
    };
  }

  function rollIdeas(flavor: PromptFlavor) {
    const state = useForge.getState();
    if (!state.seedLocked) state.rollSeed();
    const nextSeed = useForge.getState().seed;
    const list = writeIdeas(ideaOpts(flavor, state.prompt, nextSeed));
    skipIdeaRefresh.current = true;
    setIdeas([state.prompt.trim(), ...list].filter(Boolean));
  }

  function applyCheckpoint(checkpoint: string) {
    if (!checkpoint) return;
    useForge.getState().setSettings(settingsForCheckpoint(checkpoint));
    const fam = guessArch(checkpoint);
    toast.success(
      `${checkpoint.split("/").pop()} · ${fam === "sd15" ? "1.5" : fam === "flux" ? "Flux" : "XL"}`,
    );
  }

  function applyFamily(f: "sd15" | "sdxl" | "flux") {
    const list = useForge.getState().comfy?.checkpoints ?? [];
    const unets = useForge.getState().comfy?.unets ?? [];
    const cur = useForge.getState().settings.checkpoint;
    if (guessArch(cur) === f || (f === "flux" && useForge.getState().settings.stillLoader === "flux-unet")) {
      if (cur) applyCheckpoint(cur);
      else useForge.getState().setSettings(settingsForFamily(f));
      return;
    }
    const hit = list.find((n) => guessArch(n) === f);
    if (hit) {
      applyCheckpoint(hit);
      return;
    }
    if (f === "flux") {
      const u = unets.find((n) => guessArch(n) === "flux") || unets.find((n) => /flux/i.test(n));
      if (u) {
        useForge.getState().setSettings({ ...settingsForFamily("flux"), fluxUnet: u, stillLoader: "flux-unet", stillFamily: "flux" });
        toast.success(`Flux UNET: ${u.split("/").pop()}`);
        return;
      }
    }
    useForge.getState().setSettings(settingsForFamily(f));
    toast.error(
      f === "sd15"
        ? "No 1.5 checkpoint in the list (look for mix / pruned / v1-5 names)"
        : f === "flux"
          ? "No Flux file in checkpoints or UNET folder"
          : "No XL checkpoint in the list",
    );
  }

  function writeCatalog() {
    return [
      ...NSFW_TYPES,
      ...FACE_BITS,
      ...BODY_BITS,
      ...CLOTHES_BITS,
      ...PLACE_BITS,
      ...CAM_BITS,
      ...LIGHT_BITS,
      ...WHO_BITS,
      ...WHERE_BITS,
      ...MORE_BITS,
      ...COMIC_BITS,
      ...EVIL_BITS,
      ...LOOK_APPENDS,
    ];
  }

  function addChipToPrompt(item: { id: string; label: string; tags: string }) {
    setNsfwPick((prev) => {
      const n = new Set(prev);
      if (n.has(item.id)) n.delete(item.id);
      else n.add(item.id);
      return n;
    });
    const cur = useForge.getState().prompt.trim();
    const next = composeNewScene(cur, [item]);
    skipIdeaRefresh.current = true;
    useForge.getState().setPrompt(next);
  }

  function combineNsfw() {
    const picked = writeCatalog().filter((t) => nsfwPick.has(t.id));
    if (!picked.length) return;
    const cur = useForge.getState().prompt.trim();
    skipIdeaRefresh.current = true;
    useForge.getState().setPrompt(composeNewScene(cur, picked));
    setNsfwPick(new Set());
  }

  async function runBrain(flavor?: string) {
    const state = useForge.getState();
    const line =
      state.mode === "ref2i"
        ? state.refPrompt.trim() || state.prompt.trim()
        : state.prompt.trim();
    const core = sceneCore(line) || line || "an adult";
    const fam =
      state.settings.stillFamily === "sd15" || guessArch(state.settings.checkpoint) === "sd15"
        ? ("sd15" as const)
        : state.settings.stillFamily === "flux"
          ? ("flux" as const)
          : ("sdxl" as const);
    const seed = (Date.now() + Math.floor(Math.random() * 99991)) % 1_000_000_000;
    const locals = [0, 1, 2].map((i) =>
      grokExpand({
        typed: core,
        files: state.wildcards,
        seed: seed + i * 7919,
        family: fam,
        checkpoint: state.settings.checkpoint,
        roll: state.promptRoll,
        nsfwMode: state.nsfwMode,
      }),
    );
    const first = locals.find((t) => t && t !== core && t.length > core.length + 8) || locals[0] || core;
    skipIdeaRefresh.current = true;
    state.setPrompt(first);
    if (state.mode === "ref2i") state.setRefPrompt(first);
    setIdeas(locals.filter(Boolean).slice(0, 3));
    setDock("write");
    setBrainBusy(true);
    logForge("info", "Brain", `Filled “${core.slice(0, 40)}”`);
    try {
      const r = await lanBrain({
        prompt: core,
        flavor,
        wrap: state.artWrap,
        checkpoint: state.settings.checkpoint,
        fresh: !isShortSubject(line),
        seed,
        nsfwMode: state.nsfwMode,
      });
      if (!r.ok) {
        logForge("warn", "Brain", r.message);
        return true;
      }
      const text = r.text.replace(/\s+/g, " ").trim();
      const lost = core
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3)
        .some((w) => !text.toLowerCase().includes(w.toLowerCase()));
      const same = tokenOverlap(text, line) > 0.78 || tokenOverlap(text, first) > 0.9;
      const thin = text.split(/\s+/).length < 12;
      if (lost || same || thin) {
        logForge("info", "Brain", "Ollama echoed — kept the local fill");
        return true;
      }
      skipIdeaRefresh.current = true;
      useForge.getState().setPrompt(text);
      if (state.mode === "ref2i") useForge.getState().setRefPrompt(text);
      setIdeas([text, ...locals.filter((t) => tokenOverlap(t, text) < 0.82)].slice(0, 3));
      logForge("info", "Brain", `Ollama · ${r.model.split("/").pop()}`);
      return true;
    } finally {
      setBrainBusy(false);
    }
  }

  async function writeIntoBox(flavor: PromptFlavor) {
    const state = useForge.getState();
    const raw =
      state.mode === "i2i"
        ? state.prompt.trim() ||
          [state.editRemove, state.editAdd, state.editChange].filter(Boolean).join(", ") ||
          state.liveScan?.summary ||
          ""
        : state.mode === "ref2i"
          ? state.refPrompt.trim() || state.prompt.trim()
          : state.prompt.trim();
    const sceneUse = isPurpleProse(raw) ? recoverScene(raw) || raw : raw;
    const seed = Date.now() % 1_000_000_000;
    const picked = writeCatalog().filter((t) => nsfwPick.has(t.id));
    const woven = picked.length ? composeNewScene(sceneUse, picked) : sceneUse;
    const fam =
      state.settings.stillFamily === "sd15" || guessArch(state.settings.checkpoint) === "sd15"
        ? ("sd15" as const)
        : state.settings.stillFamily === "flux"
          ? ("flux" as const)
          : ("sdxl" as const);
    const rewritten = grokExpand({
      typed: woven || sceneUse || "an adult",
      files: state.wildcards.length ? state.wildcards : [],
      seed,
      family: fam,
      checkpoint: state.settings.checkpoint,
      roll: state.promptRoll,
      nsfwMode: state.nsfwMode,
    });
    const local =
      flavor === "horror"
        ? writeHorrorSet(rewritten, seed)
        : flavor === "taboo"
          ? writeTabooSet(rewritten, seed)
          : flavor === "dark"
            ? writeDarkSet(rewritten, seed)
            : flavor === "sex" || flavor === "bdsm"
              ? writeExtreme(rewritten, seed)
              : [rewritten, ...writeIdeas(ideaOpts(flavor, woven || sceneUse, seed))];
    const lines = local.map((t, i) => flattenPrompt(t, seed + i)).filter((t) => t && t.trim().toLowerCase() !== (sceneUse || "").toLowerCase());
    const first = lines[0] || flattenPrompt(rewritten, seed);
    skipIdeaRefresh.current = true;
    state.setPrompt(first);
    if (state.mode === "ref2i") state.setRefPrompt(first);
    state.setExpandedPreview(first);
    setIdeas([first, ...lines.filter((l) => l !== first)].slice(0, 4));
    setChipTab("write");
    setDock("write");
    requestAnimationFrame(() => {
      document.getElementById("forge-write-dock")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  async function insertWildcardPick(name: string) {
    const [parsed, peek] = await Promise.all([
      expandDiskWildcardsFn({
        data: {
          prompt: `__${name}__`,
          seed: Date.now() % 1_000_000_000,
          extra: useForge.getState().wildcards,
        },
      }),
      peekWildcardFn({ data: { name } }).catch(() => ({ total: 0, preview: [] as string[] })),
    ]);
    if (parsed.missing.length) {
      toast.error(`No list named ${name} in ComfyUI/wildcards`);
      return;
    }
    setChipTab("wild");
    setWildOpen({
      name,
      total: peek.total,
      preview: peek.preview,
      rolled: parsed.expanded.trim(),
    });
  }

  function useWildLine(line: string) {
    const text = line.trim();
    if (!text) return;
    const cur = useForge.getState().prompt.trim();
    useForge.getState().setPrompt(cur ? `${cur}, ${text}` : text);
    toast.success(`In the box: ${text.slice(0, 80)}`);
  }

  async function rollIntoPrompt() {
    const nextSeed = seedLocked ? seed : Math.floor(Math.random() * 1_000_000_000);
    if (!seedLocked) useForge.getState().setSeed(nextSeed);
    const parsed = await expandDiskWildcardsFn({
      data: { prompt: useForge.getState().prompt, seed: nextSeed, extra: useForge.getState().wildcards },
    });
    useForge.getState().setPrompt(parsed.expanded);
    if (parsed.missing.length) {
      toast.error(`No list named ${parsed.missing.map((m) => `__${m}__`).join(", ")}`);
    } else {
      toast.success("Rolled wildcards into the prompt");
    }
  }

  async function runWd14Scan(dataUrl: string) {
    let pixels = dataUrl;
    try {
      pixels = await asDataUrl(dataUrl);
    } catch {
      /* use the url as-is */
    }
    let local: ReturnType<typeof scanFromTags> | null = null;
    try {
      const frame = await extractFrame(pixels);
      local = await scanMedia(frame);
    } catch {
      try {
        local = await scanMedia(pixels);
      } catch {
        local = null;
      }
    }
    try {
      const viaProxy = await browserTag(pixels.startsWith("data:") ? pixels : dataUrl);
      if ("tags" in viaProxy && viaProxy.tags) {
        logForge("info", "Scan", viaProxy.tags.slice(0, 400));
        useForge.getState().setShowBoxes(true);
        return mergeScan(scanFromTags(viaProxy.tags), local);
      }
      const r = await tagWithWd14Fn({
        data: { baseUrl: useForge.getState().settings.baseUrl, dataUrl: pixels.startsWith("data:") ? pixels : dataUrl },
      });
      if ("tags" in r && r.tags) {
        logForge("info", "Scan", r.tags.slice(0, 400));
        useForge.getState().setShowBoxes(true);
        return mergeScan(scanFromTags(r.tags), local);
      }
      if ("error" in r && r.error) {
        logForge("error", "Scan", r.error);
        if (local?.boxes.length) {
          useForge.getState().setShowBoxes(true);
          return { ...local, notes: [...(local.notes || []), r.error.slice(0, 160)] };
        }
        return {
          summary: r.error,
          tags: [],
          boxes: [],
          palette: [],
          notes: ["WD14 — not a color guesser. Open Errors."],
          scannedAt: Date.now(),
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      logForge("error", "Scan", message);
      if (local?.boxes.length) {
        useForge.getState().setShowBoxes(true);
        return local;
      }
    }
    if (local) {
      useForge.getState().setShowBoxes(true);
      return local;
    }
    return {
      summary: "WD14 did not answer. Open Errors tab.",
      tags: [],
      boxes: [],
      palette: [],
      notes: ["Need ComfyUI-WD14-Tagger running inside Comfy."],
      scannedAt: Date.now(),
    };
  }

  async function runSavedGraph(name: string) {
    const state = useForge.getState();
    if (!state.prompt.trim()) {
      toast.error("Type a prompt first — Forge fills it into that graph.");
      return;
    }
    const img = state.media.find((m) => m.kind === "image");
    setBusy(true);
    try {
      const queued = await queueSavedWorkflowFn({
        data: {
          baseUrl: state.settings.baseUrl,
          name,
          prompt: state.prompt,
          negative: state.negative,
          seed: state.seed,
          image: img ? { filename: "forge_input_0.png", dataUrl: img.dataUrl } : undefined,
        },
      });
      if (!queued.ok) {
        toast.error(queued.message);
        logForge("error", "Queue", queued.message);
        return;
      }
      const job: Job = {
        id: uid(),
        createdAt: Date.now(),
        mode: state.mode,
        prompt: state.prompt,
        expandedPrompt: state.prompt,
        negative: state.negative,
        seed: state.seed,
        status: "running",
        resultKind: "image",
        apiWorkflow: {},
        uiWorkflow: {},
        promptId: queued.promptId,
        checkpoint: name,
      };
      useForge.getState().addJob(job);
      toast.success(`Queued ${name} on Comfy`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not queue that graph");
    } finally {
      setBusy(false);
    }
  }

  async function generateOnPc(opts?: { checkpoint?: string; keepSeed?: boolean; quiet?: boolean }) {
    const state = useForge.getState();
    const photoOn = state.media.some((m) => m.kind === "image");
    const runMode: typeof state.mode =
      tab === "video"
        ? photoOn
          ? "i2v"
          : "t2v"
        : tab === "comic"
          ? state.media.filter((m) => m.kind === "image").length >= 2
            ? "ref2i"
            : "t2i"
        : photoOn && state.mode !== "ref2i" && state.mode !== "i2i"
          ? "i2i"
          : state.mode;
    const typed = (promptRef.current?.value || "").trim();
    const comicPage =
      tab === "comic"
        ? buildComicPrompt(
            state.prompt || typed,
            comicLayout,
            COMIC_INK.find((x) => x.id === comicInk)?.tags || "",
          )
        : "";
    const userPrompt =
      tab === "comic"
        ? comicPage
        : runMode === "i2i"
        ? composeI2iPrompt(
            state.prompt || typed,
            { remove: state.editRemove, add: state.editAdd, change: state.editChange },
            (state.liveScan?.summary || state.liveScan?.tags.slice(0, 8).join(", ")) ?? "",
          )
        : runMode === "ref2i"
          ? state.refPrompt.trim() || state.prompt.trim() || typed
          : state.prompt.trim() || typed;
    if (!userPrompt) {
      const msg = "Type a prompt, then tap Generate.";
      setQueueBanner(msg);
      toast.error(msg);
      return;
    }
    if (!opts?.keepSeed && !state.seedLocked) state.rollSeed();
    const nextSeed = useForge.getState().seed;
    setBusy(true);
    setQueueBanner("");
    try {
      const images: { filename: string; dataUrl: string }[] = [];
      let idx = 0;
      const seenPc = new Set<string>();
      for (const m of state.media.filter((x) => x.kind === "image").slice(0, 5)) {
        const k = stillKey(m.name, m.dataUrl) || m.dataUrl.slice(0, 48);
        if (k && seenPc.has(k)) continue;
        if (k) seenPc.add(k);
        try {
          const dataUrl = await Promise.race([
            asDataUrl(m.dataUrl).catch(() => m.dataUrl),
            new Promise<string>((_, rej) => setTimeout(() => rej(new Error("photo timeout")), 8000)),
          ]);
          images.push({ filename: `forge_input_${idx}.png`, dataUrl });
        } catch {
          /* skip a stuck photo so Generate still fires */
        }
        idx += 1;
      }
      if ((tab === "combine" || (state.mode === "ref2i" && tab !== "comic")) && images.length < 2) {
        const msg = "Combine needs 2 different photos. Tap another in Results — not the same one twice.";
        setQueueBanner(msg);
        logForge("warn", "Combine", msg);
        return;
      }
      setQueueBanner("");
      const r = await lanGenerate({
        prompt: userPrompt,
        negative: state.negative,
        negLocked: state.negLocked,
        seed: nextSeed,
        mode: runMode,
        aspect: state.aspect,
        denoise: state.denoise,
        artWrap: state.artWrap,
        quality: state.qualityPick,
        roll: state.promptRoll,
        nsfwMode: state.nsfwMode,
        checkpoint: opts?.checkpoint || state.settings.checkpoint,
        settings: opts?.checkpoint
          ? { ...state.settings, ...settingsForCheckpoint(opts.checkpoint) }
          : state.settings,
        images,
        loras: state.loras.filter((l) => l.enabled).slice(0, 8),
      });
      if (!r.ok) {
        setQueueBanner(r.message);
        toast.error(r.message);
        logForge("error", "Queue", r.message);
        return;
      }
      const job: Job = {
        id: uid(),
        createdAt: Date.now(),
        mode: runMode,
        prompt: userPrompt,
        expandedPrompt: r.prompt || userPrompt,
        negative: state.negative,
        seed: r.seed || nextSeed,
        status: "running",
        resultKind: MODE_META[runMode].video ? "video" : "image",
        apiWorkflow: {},
        uiWorkflow: {},
        promptId: r.promptId,
        checkpoint: r.checkpoint || state.settings.checkpoint,
        progress: 12,
        log: "queued on ComfyUI from phone/laptop",
      };
      useForge.getState().addJob(job);
      void pushLive(job);
      setQueueBanner("");
      if (r.prompt && (runMode === "t2i" || runMode === "t2v")) {
        skipIdeaRefresh.current = true;
        useForge.getState().setPrompt(r.prompt);
        useForge.getState().setExpandedPreview(r.prompt);
      }
      logForge("info", "Queue", `phone/laptop queued ${r.promptId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the PC";
      setQueueBanner(msg);
      toast.error(msg);
      logForge("error", "Queue", msg);
    } finally {
      setBusy(false);
    }
  }

  async function generate(opts?: { checkpoint?: string; keepSeed?: boolean; quiet?: boolean }) {
    if (isLanRemote()) {
      await generateOnPc(opts);
      return;
    }
    try {
      const live = await lanProbe();
      useForge.getState().applyComfy(live);
    } catch {
      /* keep last */
    }
    if (opts?.checkpoint) {
      useForge.getState().setMode("t2i");
      useForge.getState().setSettings(settingsForCheckpoint(opts.checkpoint));
    }
    const state = useForge.getState();
    const photoOn = state.media.some((m) => m.kind === "image");
    if (tab === "video") {
      useForge.getState().setMode(photoOn ? "i2v" : "t2v");
      useForge.getState().setSoundOn(true);
    } else if (tab === "comic") {
      const n = state.media.filter((m) => m.kind === "image").length;
      useForge.getState().setMode(n >= 2 ? "ref2i" : "t2i");
    } else if (photoOn && !MODE_META[state.mode].video && state.mode !== "ref2i" && state.mode !== "i2i") {
      useForge.getState().setMode("i2i");
    }
    const runMode =
      tab === "video"
        ? photoOn
          ? "i2v"
          : "t2v"
        : tab === "comic"
          ? state.media.filter((m) => m.kind === "image").length >= 2
            ? "ref2i"
            : "t2i"
        : photoOn && !MODE_META[useForge.getState().mode].video && useForge.getState().mode !== "ref2i"
          ? "i2i"
          : useForge.getState().mode;
    const runMeta = MODE_META[runMode];
    const inputs: MediaRef[] = (() => {
      const raw: MediaRef[] =
        runMode === "ref2i"
          ? state.media.filter((m) => m.kind === "image").slice(0, 5)
          : (runMode === "i2i" || photoOn) && state.media[0]?.kind === "image"
            ? [state.media[0]]
            : state.media.length > 0
              ? state.media
              : runMeta.needsImage || runMeta.needsVideo
                ? (() => {
                    const job =
                      state.jobs.find((j) => j.id === state.activeJobId && j.resultDataUrl) ||
                      state.jobs.find((j) => j.resultDataUrl);
                    if (!job?.resultDataUrl) return [];
                    return [
                      {
                        id: "from-last",
                        kind: job.resultKind,
                        name: job.resultName || (job.resultKind === "video" ? "last.mp4" : "last.png"),
                        dataUrl: job.resultDataUrl,
                        folder: job.resultFolder,
                      },
                    ];
                  })()
                : [];
      const seen = new Set<string>();
      return raw.filter((m) => {
        const k = stillKey(m.name, m.dataUrl) || m.dataUrl.slice(0, 48);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    })();
    if (runMode === "ref2i" && inputs.filter((m) => m.kind === "image").length < 2) {
      const msg = "Combine needs 2 different photos. That 2×2 was the same still stacked. Tap another in Results.";
      setQueueBanner(msg);
      logForge("warn", "Combine", msg);
      return;
    }
    if (runMeta.video) {
      const wanList = useForge.getState().comfy?.unets ?? [];
      const picked =
        runMode === "t2v"
          ? pickT2vUnet(state.settings.wanUnet || "", wanList)
          : pickPlayUnet(state.settings.wanUnet || "", wanList);
      if (runMode === "t2v" && !picked) {
        toast.error("Need a WAN text-to-video model in Comfy (wan2.1 t2v 14B or wan2.2 ti2v 5B). Or make a still first, then Play.");
        logForge("error", "Video", `No T2V unet in ${wanList.slice(0, 8).join(", ") || "(none)"}`);
        return;
      }
      if (picked && picked !== state.settings.wanUnet) {
        useForge.getState().setSettings({ wanUnet: picked });
      }
      const u = useForge.getState().settings.wanUnet || "";
      if (!isWanUnet(u)) {
        toast.error(
          u
            ? `Video needs a WAN 2.1 unet. Header is ${u} — that is not WAN (Lumina/Hunyuan3D will crash).`
            : "Video needs a WAN 2.1 unet in the header. Put wan2.1*.safetensors in models/diffusion_models.",
        );
        logForge(
          "error",
          "Video",
          u ? `WAN slot is ${u}` : "No WAN unet selected",
        );
        return;
      }
      const pair = pairWanUnets(u, wanList);
      if (pair.error) {
        toast.error(pair.error);
        logForge("error", "Video", pair.error);
        setQueueBanner(pair.error);
        return;
      }
      if (pair.high || pair.low || pair.single) {
        useForge.getState().setSettings({
          wanUnet: pair.high || pair.single || u,
          wanUnetLow: pair.low,
        });
      }
      const vaes = useForge.getState().comfy?.vaes ?? [];
      const vae = pickWanVae(u, vaes, state.settings.wanVae);
      if (vae && vae !== state.settings.wanVae) {
        useForge.getState().setSettings({ wanVae: vae });
      }
      const useVae = vae || state.settings.wanVae;
      if (!useVae) {
        toast.error(
          wanStackVersion(u) === "22"
            ? "No WAN 2.2 VAE. Put wan2.2_vae.safetensors in models/vae."
            : "No WAN 2.1 VAE. Put wan_2.1_vae.safetensors in models/vae.",
        );
        logForge("error", "Video", wanStackVersion(u) === "22" ? "No WAN 2.2 VAE" : "No WAN 2.1 VAE");
        return;
      }
      if (!wanPairOk(u, useVae)) {
        toast.error(
          "WAN VAE does not match this unet. 14B Play uses wan_2.1_vae. 5B ti2v uses wan2.2_vae.",
        );
        logForge("error", "Video", `VAE mismatch unet=${u} vae=${useVae}`);
        return;
      }
      const clips = useForge.getState().comfy?.clips ?? [];
      const clip = pickWanClip(clips, useForge.getState().settings.wanClip);
      if (clip && clip !== useForge.getState().settings.wanClip) {
        useForge.getState().setSettings({ wanClip: clip });
      }
      if (!clip && !useForge.getState().settings.wanClip) {
        toast.error("Play needs umt5. Put nsfwWanUMT5*.gguf or umt5*.safetensors in models/text_encoders, restart Comfy.");
        logForge("error", "Video", "No WAN CLIP / umt5");
        return;
      }
    }
    if (runMeta.needsImage && !inputs.some((m) => m.kind === "image")) {
      toast.error(
        tab === "video"
          ? "Need a still for image-to-video. Tap one in Results or Library, then Generate."
          : "No photo on the stage. Drop one, or tap Edit this on a result, then Generate.",
      );
      return;
    }
    if (runMode === "ref2i" && inputs.filter((m) => m.kind === "image").length < 2) {
      toast.error("Combine needs 2 to 5 photos. Tap more from Results or Pick from library, then Generate.");
      return;
    }
    if ((runMode === "i2i" || runMode === "ref2i") && !canEditPhoto(state.settings.checkpoint)) {
      toast.error("That mix cannot edit a photo (3D / video / broken file). Pick Illustrious, Pony, or SDXL in the header.");
      logForge("error", "Edit", `${state.settings.checkpoint} cannot img2img`);
      return;
    }
    if (meta.needsVideo && !inputs.some((m) => m.kind === "video" || m.kind === "image")) {
      toast.error("Drop a video first");
      return;
    }
    const userPrompt =
      runMode === "i2i"
        ? composeI2iPrompt(state.prompt, {
            remove: state.editRemove,
            add: state.editAdd,
            change: state.editChange,
          }, (state.liveScan?.summary || state.liveScan?.tags.slice(0, 8).join(", ")) ?? "")
        : runMode === "ref2i"
          ? state.refPrompt.trim() || state.prompt.trim()
          : state.prompt.trim();
    if (!userPrompt) {
      toast.error(
        runMode === "i2i"
          ? "Type what to change, or fill Take out / Put in / Change."
          : runMode === "ref2i"
            ? "Type what the new picture should be."
            : "Type a prompt, or hit Write.",
      );
      return;
    }
    const neg = generateNegative(
      useForge.getState().negative,
      useForge.getState().settings.checkpoint,
      userPrompt,
      useForge.getState().negLocked,
    );
    if (!runMeta.video && state.settings.stillLoader === "checkpoint") {
      const resolved = resolveCkpt(state.settings.checkpoint, useForge.getState().comfy?.checkpoints ?? []);
      if (!resolved) {
        if (!isLanRemote()) {
          toast.error("No checkpoints found. Comfy must be running: python main.py --listen 0.0.0.0 --port 8188");
          logForge("error", "Checkpoint", "Generate blocked — 0 checkpoints from Comfy / disk");
          return;
        }
      } else if (resolved !== state.settings.checkpoint) {
        if (!isRealCheckpoint(state.settings.checkpoint)) {
          toast.error(
            `${state.settings.checkpoint} is a LoRA, not a checkpoint. Pick a real mix. Move that file to models/loras.`,
          );
          logForge("error", "Checkpoint", `${state.settings.checkpoint} is a LoRA sitting in checkpoints`);
        }
        useForge.getState().setSettings(settingsForCheckpoint(resolved));
      } else {
        const rec = settingsForCheckpoint(resolved);
        const cur = useForge.getState().settings;
        if ((cur.clipSkip || 1) < 2 && (rec.clipSkip || 1) >= 2) {
          useForge.getState().setSettings({
            clipSkip: 2,
            sampler: rec.sampler || cur.sampler,
            scheduler: rec.scheduler || cur.scheduler,
            steps: Math.max(cur.steps || 0, rec.steps || 28),
          });
        }
      }
    }
    let settingsNow = useForge.getState().settings;

    if (!opts?.keepSeed && !state.seedLocked) state.rollSeed();
    const nextSeed = useForge.getState().seed;
    const parsed = userPrompt.includes("__")
      ? await expandDiskWildcardsFn({
          data: {
            prompt: userPrompt,
            seed: nextSeed,
            extra: state.wildcards,
          },
        })
      : expandPrompt(userPrompt, state.wildcards, nextSeed);
    if (parsed.missing.length) {
      toast.error(`Unknown wildcard ${parsed.missing.map((m) => `__${m}__`).join(", ")}`);
    }
    const loraCkpt = runMeta.video
      ? state.settings.wanUnet || state.settings.checkpoint
      : state.settings.checkpoint || state.settings.fluxUnet;
    const fam = guessArch(loraCkpt);
    const liveLoras = useForge.getState().loras;
    const picked = pickLorasForPrompt(
      runMode === "i2i" ? "" : userPrompt,
      runMode === "i2i" ? liveLoras.filter((l) => l.enabled) : liveLoras,
      fam,
      loraCkpt,
    );
    const match = { ok: picked.ok, blocked: picked.blocked, family: fam };
    for (const l of picked.dropped) {
      useForge.getState().upsertLora({ ...l, enabled: false });
    }
    if (picked.dropped.length) {
      logForge(
        "info",
        "LoRA",
        `Off (not in this prompt): ${picked.dropped.map((d) => d.name).slice(0, 6).join(", ")}`,
      );
    }
    if (match.blocked.length) {
      logForge(
        "warn",
        "LoRA",
        `Wrong mix — skipped: ${match.blocked.map((b) => `${b.name} (${guessLoraLane(b.filename)})`).join(", ")}. 1.5 stays off XL. Pony stays off Illustrious. WAN stays on video.`,
      );
    }
    const catalog = useForge.getState().comfy?.loras ?? [];
    const stacked = [
      ...match.ok.map((l) => ({
        ...l,
        filename: resolveLoraName(l.filename, catalog),
        triggerWords:
          l.triggerWords.length > 0
            ? l.triggerWords
            : [loraTriggerFromFilename(l.filename)].filter(Boolean),
        enabled: true,
      })),
      ...parsed.loras
        .map((l) => ({
          id: `inline-${l.name}`,
          filename: resolveLoraName(
            l.name.endsWith(".safetensors") ? l.name : `${l.name}.safetensors`,
            catalog,
          ),
          name: l.name,
          family: match.family as ModelFamily,
          triggerWords: [] as string[],
          unetStrength: l.unet,
          clipStrength: l.clip,
          enabled: true,
        }))
        .filter((l) => loraFitsCheckpoint(l.filename, fam, loraCkpt)),
    ];
    if (stacked.length) {
      logForge(
        "info",
        "LoRA",
        `Using ${stacked.map((l) => `${l.name} ${l.unetStrength}`).join(", ")}`,
      );
    }
    let denoiseNow = state.denoise;
    let sent = flattenPrompt(parsed.expanded, nextSeed);
    if (tab === "comic") {
      const ink = COMIC_INK.find((x) => x.id === comicInk)?.tags || "";
      sent = flattenPrompt(buildComicPrompt(state.prompt || parsed.expanded, comicLayout, ink), nextSeed);
    }
    if (runMode === "i2i" && !/same art style/i.test(sent)) {
      sent = `${sent}, same art style, same rendering, same lighting, same colors, do not restyle`;
    }
    let finalPrompt = triggerPrefix(stacked, sent);
    if (runMode !== "i2i") {
      finalPrompt = applyArtWrap(finalPrompt, useForge.getState().artWrap);
      finalPrompt = applyQualityOffers(finalPrompt, useForge.getState().qualityPick);
      if (qualityWantsHires(useForge.getState().qualityPick) && !settingsNow.hires) {
        settingsNow = { ...settingsNow, hires: true };
      }
    }
    if (runMode === "ref2i" && tab !== "comic") {
      finalPrompt = `unified single scene combining the reference photos, not a split collage, not a grid, ${finalPrompt}`;
    }
    if (tab === "comic" && runMode === "ref2i") {
      finalPrompt = `arrange the reference photos as panels on one comic page with black gutters, sequential, ${finalPrompt}`;
    }
    if (runMode === "i2i" || runMode === "ref2i") {
      const change = /\b(remove|undress|take off|strip|add |change |replace |delete |put on|clothes|shirt|dress|nude|naked)\b/i.test(
        userPrompt,
      );
      denoiseNow = i2iDenoise(denoiseNow, change);
    }
    const api = buildApiWorkflow({
      mode: runMode,
      prompt: finalPrompt,
      negative: neg,
      seed: nextSeed,
      aspect: state.aspect,
      denoise: denoiseNow,
      loras: stacked,
      settings: settingsNow,
      imageCount:
        runMode === "ref2i"
          ? inputs.filter((m) => m.kind === "image").length
          : runMeta.needsImage
            ? inputs.filter((m) => m.kind === "image").length
            : 0,
      hasVideo: runMeta.needsVideo ? inputs.some((m) => m.kind === "video") : false,
      taggerClass: "",
      taggerModel: "",
      vaeName: pickVaeName(fam === "flux" || fam === "sd15" || fam === "sdxl" ? fam : "sdxl", settingsNow, useForge.getState().comfy?.vaes ?? []),
    });
    const ui = apiToUiWorkflow(api, `Forge ${MODE_META[runMode].label}`);
    const job: Job = {
      id: uid(),
      createdAt: Date.now(),
      mode: runMode,
      prompt: userPrompt,
      expandedPrompt: finalPrompt,
      negative: neg,
      seed: nextSeed,
      status: state.comfy?.ok ? "queued" : "held",
      resultKind: runMeta.video ? "video" : "image",
      apiWorkflow: api,
      uiWorkflow: ui,
      checkpoint: settingsNow.checkpoint || activeName,
    };
    state.addJob(job);
    state.setExpandedPreview(finalPrompt);
    void pushLive(job);

    if (!useForge.getState().comfy?.ok) {
      const again = await lanProbe().catch(() => null);
      if (again?.ok) useForge.getState().applyComfy(again);
    }
    const remote = isLanRemote();
    if (!useForge.getState().comfy?.ok && !remote) {
      toast.error("Comfy is off on the PC. Start it there, then hit Generate again.");
      logForge("error", "Queue", "Generate blocked — Comfy not answering on the PC");
      return;
    }

    setBusy(true);
    try {
      const images: { filename: string; dataUrl: string }[] = [];
      if (runMeta.needsImage || runMeta.needsVideo) {
        let idx = 0;
        for (const m of inputs) {
          if (m.kind === "image") {
            const dataUrl = await asDataUrl(m.dataUrl).catch(() => "");
            if (!dataUrl || (!dataUrl.startsWith("data:") && !dataUrl.startsWith("/forge-media") && !dataUrl.startsWith("http"))) {
              toast.error("Could not read that photo. Drop the file again — not a tiny thumbnail.");
              setBusy(false);
              return;
            }
            images.push({
              filename: `forge_input_${idx}.png`,
              dataUrl,
            });
            idx += 1;
          } else {
            images.push({
              filename: `forge_frame_${idx}.png`,
              dataUrl: await extractFrame(await asDataUrl(m.dataUrl).catch(() => m.dataUrl)),
            });
            idx += 1;
          }
        }
      }
      let queued: { ok: true; promptId: string } | { ok: false; message: string };
      const payload = {
        baseUrl: "http://127.0.0.1:8188",
        workflow: api,
        images,
        clientId: isLanRemote() ? "forge-phone" : "forge-studio",
        embedName: jobBasename(job),
        uiWorkflow: ui,
      };
      queued = await lanQueue(api as Record<string, unknown>, images, {
        clientId: isLanRemote() ? "forge-phone" : "forge-lan",
        embedName: jobBasename(job),
        uiWorkflow: ui,
      });
      if (!queued.ok) queued = await browserQueue(api as Record<string, unknown>, images, isLanRemote() ? "forge-phone" : "forge-studio");
      if (!queued.ok && !isLanRemote()) queued = await queueComfyFn({ data: payload });
      if (!queued.ok) {
        useForge.getState().patchJob(job.id, { status: "held", error: queued.message });
        toast.error(queued.message);
        logForge("error", "Queue", queued.message);
        return;
      }
      useForge.getState().patchJob(job.id, { status: "running", promptId: queued.promptId, progress: 12, log: "queued on ComfyUI" });
      const running = useForge.getState().jobs.find((j) => j.id === job.id);
      if (running) void pushLive(running);
      toast.success(
        opts?.quiet
          ? `${MODE_META[runMode].label} · ${settingsNow.checkpoint.split("/").pop()}`
          : `Queued on this PC's Comfy · ${MODE_META[runMode].label}`,
      );
      logForge("info", "Generate", `${MODE_META[runMode].label} · ${settingsNow.checkpoint} · ${finalPrompt.slice(0, 200)}`);
      void appendPromptFn({
        data: {
          mode: runMode,
          prompt: finalPrompt,
          negative: neg,
          seed: nextSeed,
          checkpoint: settingsNow.checkpoint,
          loras: stacked.filter((l) => l.enabled).map((l) => l.filename),
        },
      }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Queue failed";
      useForge.getState().patchJob(job.id, { status: "error", error: message });
      toast.error(message);
      logForge("error", "Generate", message);
    } finally {
      setBusy(false);
    }
  }

  async function runMixes() {
    const names = mixPick.filter(isImageCheckpoint);
    if (!names.length) {
      const msg = "Tick the image checkpoints you want. This tab runs the same prompt + same seed on each.";
      setQueueBanner(msg);
      logForge("warn", "All ckpts", msg);
      return;
    }
    if (!useForge.getState().prompt.trim()) {
      const msg = "Type a prompt first.";
      setQueueBanner(msg);
      return;
    }
    const prev = useForge.getState().settings.checkpoint;
    if (!useForge.getState().seedLocked) useForge.getState().toggleSeedLock();
    const seedUsed = useForge.getState().seed;
    const ids: string[] = [];
    setQueueBanner(`Queueing ${names.length} checkpoints · seed ${seedUsed} locked`);
    logForge("info", "All ckpts", `${names.length} · seed ${seedUsed}`);
    for (const name of names) {
      const before = new Set(useForge.getState().jobs.map((j) => j.id));
      await generate({ checkpoint: name, keepSeed: true, quiet: true });
      const added = useForge.getState().jobs.find((j) => !before.has(j.id));
      if (added) ids.push(added.id);
    }
    setMixJobIds(ids);
    if (prev) useForge.getState().setSettings(settingsForCheckpoint(prev));
    setQueueBanner(`${ids.length} queued · seed ${seedUsed} · Comfy runs them one after another`);
    logForge("info", "All ckpts", `${ids.length} queued, seed ${seedUsed}`);
  }

  function fireGenerate() {
    const now = Date.now();
    if (now - genLock.current < 400) return;
    genLock.current = now;
    setQueueBanner("");
    if (tab === "mixes") void runMixes();
    else void generate().catch((err) => {
      const msg = err instanceof Error ? err.message : "Generate failed";
      setQueueBanner(msg);
      toast.error(msg);
    });
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
      JSON.stringify({ ...job.uiWorkflow, forge_seed: job.seed, forge_prompt: job.expandedPrompt || job.prompt }),
      JSON.stringify(job.apiWorkflow),
    );
    const buf = new ArrayBuffer(out.byteLength);
    new Uint8Array(buf).set(out);
    downloadBlob(`${base}.png`, new Blob([buf], { type: "image/png" }));
  }

  const familyNow = familyOfSelection(settings);
  const ckpts = comfy?.checkpoints ?? [];
  const unets = comfy?.unets ?? [];
  const listedCkpts = (() => {
    const real = ckpts.filter(isRealCheckpoint);
    const styled = ckptStyle === "all" ? real : real.filter((n) => checkpointMatchesStyle(n, ckptStyle));
    const pool = styled.length ? styled : real;
    const cur = settings.checkpoint;
    if (cur && !pool.includes(cur)) return [cur, ...pool];
    return pool;
  })();

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-8 text-fg">
      <header className="flex items-center gap-3 px-4 py-3 md:px-6">
        <p className="text-[15px] font-medium tracking-tight">Forge</p>
        <span className="text-[11px] tabular-nums text-subtle">196</span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {meta.video ? (
            <select
              aria-label="WAN model"
              className="h-9 min-w-0 flex-1 truncate rounded-full bg-raised px-3 text-xs"
              value={settings.wanUnet}
              onChange={(e) => {
                const v = e.target.value;
                const pair = pairWanUnets(v, unets);
                useForge.getState().setSettings({
                  wanUnet: v,
                  wanUnetLow: pair.error ? "" : pair.low,
                });
              }}
            >
              <option value="">WAN model</option>
              {(unets.filter((n) => isWanUnet(n)).length
                ? unets.filter((n) => isWanUnet(n))
                : [settings.wanUnet].filter(Boolean)
              ).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : settings.stillLoader === "flux-unet" ? (
            <select
              aria-label="Flux UNET"
              className="h-9 min-w-0 flex-1 truncate rounded-full bg-raised px-3 text-xs"
              value={settings.fluxUnet}
              onChange={(e) => useForge.getState().setSettings({ fluxUnet: e.target.value })}
            >
              {(unets.length ? unets : [settings.fluxUnet].filter(Boolean)).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Checkpoint"
              className="h-9 min-w-0 flex-1 truncate rounded-full bg-raised px-3 text-xs"
              value={settings.checkpoint}
              onChange={(e) => applyCheckpoint(e.target.value)}
            >
              <option value="">Pick mix · {listedCkpts.length}</option>
              {(listedCkpts.length ? listedCkpts : [settings.checkpoint].filter(Boolean)).map((n) => (
                <option key={n} value={n}>
                  {n.split("/").pop()} · {guessArch(n) === "sd15" ? "1.5" : guessArch(n) === "flux" ? "Flux" : "XL"}
                </option>
              ))}
            </select>
          )}
          {!meta.video ? (
            <select
              aria-label="What the mix should look like"
              title="Filters the mix list only."
              className="hidden h-9 w-36 shrink-0 rounded-full bg-raised px-2 text-xs sm:block"
              value={ckptStyle}
              onChange={(e) =>
                useForge.getState().setCkptStyle(e.target.value as (typeof CKPT_STYLES)[number]["id"])
              }
            >
              {CKPT_STYLES.map((s) => (
                <option key={s.id} value={s.id} title={s.hint}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="forge-pill rounded-full"
          onClick={() => {
            useForge.getState().startNew();
            setShowSource(false);
            setZoom(null);
            setIdeas([]);
            setNsfwPick(new Set());
            setMixJobIds([]);
            skipIdeaRefresh.current = true;
            const st = useForge.getState();
            st.setMode(tab === "combine" ? "ref2i" : tab === "video" ? "t2v" : "t2i");
            logForge("info", "New", "Cleared stage, prompt, and photo");
          }}
        >
          New
        </Button>
        <div className="flex shrink-0 rounded-full bg-raised p-0.5" title="SFW fills clothes and place. NSFW fills explicit uncensored for people.">
          <button
            type="button"
            className={cn("h-8 rounded-full px-2.5 text-xs", !nsfwMode ? "bg-accent text-accent-fg" : "text-subtle")}
            onClick={() => useForge.getState().setNsfwMode(false)}
          >
            SFW
          </button>
          <button
            type="button"
            className={cn("h-8 rounded-full px-2.5 text-xs", nsfwMode ? "bg-accent text-accent-fg" : "text-subtle")}
            onClick={() => useForge.getState().setNsfwMode(true)}
          >
            NSFW
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 min-h-9 min-w-9"
          onClick={() => {
            setTab("mixes");
            const st = useForge.getState();
            st.setMode("t2i");
            if (!st.seedLocked) st.toggleSeedLock();
            const image = (comfy?.checkpoints ?? []).filter(isImageCheckpoint);
            setMixPick((prev) => (prev.length ? prev : image));
          }}
          aria-label="All checkpoints"
          title="Same prompt and seed on every image checkpoint"
        >
          <Images />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 min-h-9 min-w-9"
          onClick={() => setTab("errors")}
          aria-label="Errors"
        >
          {logs.some((l) => l.level === "error") ? (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-danger" />
          ) : null}
          <span className="text-[10px] font-medium text-muted">!</span>
        </Button>
        <span
          className={cn("size-2 shrink-0 rounded-full", comfy?.ok ? "bg-signal" : "bg-warn")}
          title={comfy?.ok ? "Comfy on" : "Comfy off"}
        />
        <Button variant="ghost" size="icon" className="size-9 min-h-9 min-w-9" onClick={() => setSheet("settings")} aria-label="Settings">
          <Settings2 />
        </Button>
      </header>
      {!comfy?.ok ? (
        <div className="px-4 py-1.5 text-center text-xs text-warn">Comfy is off. Generate will wait.</div>
      ) : isLanRemote() ? (
        <div className="px-4 py-1.5 text-center text-xs text-muted">
          This device drives the PC. Type a prompt here, tap Generate.
        </div>
      ) : null}
      {queueBanner ? (
        <div className="px-4 py-2 text-center text-sm font-medium text-danger">{queueBanner}</div>
      ) : null}

      <div className="flex flex-col gap-1 px-2 md:px-4">
        <div className="flex items-center gap-0.5">
          {(["image", "video", "combine", "comic", "mixes"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                if (g === "combine") {
                  beginCombine();
                  return;
                }
                setTab(g);
                const st = useForge.getState();
                st.setLiveScan(null);
                st.setEditRemove("");
                st.setEditAdd("");
                st.setEditChange("");
                setShowSource(false);
                setZoom(null);
                if (g === "video") {
                  const img =
                    st.media.find((m) => m.kind === "image") ||
                    (active?.resultKind === "image" && active.resultDataUrl
                      ? {
                          id: "from-still",
                          kind: "image" as const,
                          name: active.resultName || "still.png",
                          dataUrl: active.resultDataUrl,
                          folder: active.resultFolder,
                        }
                      : null);
                  if (img) {
                    st.setMedia([img]);
                    st.setMode("i2v");
                    setShowSource(true);
                  } else {
                    st.setMedia([]);
                    st.setMode("t2v");
                  }
                  st.setDuration(6);
                  st.setSoundOn(true);
                  st.setSettings({
                    steps: 24,
                    batchSize: 1,
                    videoFrames: wanFrameCount(6),
                    videoFps: wanFpsForDuration(6),
                  });
                  return;
                }
                if (g === "comic") {
                  st.setMode("t2i");
                  const lay = COMIC_LAYOUTS.find((l) => l.id === comicLayout) || COMIC_LAYOUTS[2];
                  st.setAspect(lay.aspect);
                  return;
                }
                if (g !== "mixes") {
                  st.setMedia([]);
                  st.setRefPrompt("");
                }
                st.setMode("t2i");
                if (g === "mixes") {
                  if (!st.seedLocked) st.toggleSeedLock();
                  const image = (comfy?.checkpoints ?? []).filter(isImageCheckpoint);
                  setMixPick((prev) => (prev.length ? prev : image));
                }
              }}
              className={cn(
                "relative h-10 px-3 text-sm font-medium transition-colors",
                tab === g
                  ? "text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-fg"
                  : "text-subtle hover:text-fg",
              )}
            >
              {g === "image"
                ? "Image"
                : g === "combine"
                  ? "Combine"
                  : g === "comic"
                    ? "Comic"
                    : g === "video"
                      ? "Video"
                      : "All ckpts"}
            </button>
          ))}
        </div>
        {tab === "mixes" ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted">
              Type a prompt below. Seed is locked so every mix starts the same. Tick the image checkpoints, then Run.
              Comfy does them one after another — 40 mixes can take hours.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-subtle">Seed {seed} locked</span>
              <Button
                type="button"
                size="sm"
                variant={seedLocked ? "default" : "secondary"}
                onClick={() => useForge.getState().toggleSeedLock()}
              >
                {seedLocked ? "Unlock seed" : "Lock seed"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => useForge.getState().rollSeed()}>
                New seed
              </Button>
              <Input
                className="h-9 w-32 bg-raised"
                value={seed}
                onChange={(e) => useForge.getState().setSeed(Number(e.target.value) || 0)}
                aria-label="Seed"
              />
            </div>
            <Input
              value={mixQ}
              onChange={(e) => setMixQ(e.target.value)}
              placeholder="Filter checkpoints…"
              className="h-10 bg-raised"
            />
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setMixPick(
                    ckpts
                      .filter(isImageCheckpoint)
                      .filter((n) => !mixQ || n.toLowerCase().includes(mixQ.toLowerCase()))
                      .filter((n) => ckptStyle === "all" || checkpointMatchesStyle(n, ckptStyle)),
                  )
                }
              >
                Tick all image
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setMixPick([])}>
                Clear
              </Button>
              <span className="self-center text-xs text-subtle">
                {mixPick.length} ticked · {ckpts.filter(isImageCheckpoint).length} image ckpts
              </span>
            </div>
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
              {ckpts
                .filter(isImageCheckpoint)
                .filter((n) => !mixQ || n.toLowerCase().includes(mixQ.toLowerCase()))
                .filter((n) => ckptStyle === "all" || checkpointMatchesStyle(n, ckptStyle))
                .map((n) => {
                  const on = mixPick.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setMixPick((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
                      }
                      className={cn(
                        "truncate rounded-lg px-2 py-2 text-left text-xs",
                        on ? "bg-accent text-accent-fg" : "bg-raised text-fg",
                      )}
                      title={n}
                    >
                      {n.split("/").pop()} · {guessArch(n) === "sd15" ? "1.5" : guessArch(n) === "flux" ? "Flux" : "XL"}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}
      </div>

      {tab === "errors" ? <ErrorsPanel /> : null}

      <section
        className={cn("forge-stage relative min-h-0 flex-1", tab === "errors" && "hidden")}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onStageDrop}
      >
        {stageSrc ? (
          stageKind === "video" ? (
            <ForgeClip src={stageSrc} controls autoPlay className="forge-still mx-auto size-full max-h-[70dvh] object-contain md:max-h-[72dvh]" />
          ) : (
            <div className="relative mx-auto inline-flex max-h-[70dvh] max-w-full items-center justify-center p-3 md:max-h-[72dvh]">
              <div className="relative inline-block max-h-[66dvh] max-w-full">
                <img
                  src={stageSrc}
                  alt=""
                  className="forge-still max-h-[66dvh] w-auto max-w-full cursor-zoom-in object-contain md:max-h-[70dvh]"
                  onClick={() => setZoom({ src: stageSrc, kind: "image" })}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.dataset.fallback) return;
                    el.dataset.fallback = "1";
                    const name = el.src.split("name=")[1]?.split("&")[0];
                    if (name) el.src = `/comfy-proxy/view?filename=${decodeURIComponent(name)}&type=output`;
                  }}
                />
                <ScanBoxes boxes={scan?.boxes ?? []} show={showBoxes} />
              </div>
              <button
                type="button"
                className="absolute bottom-4 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg"
                title="Play — this still becomes a clip"
                onClick={(e) => {
                  e.stopPropagation();
                  playStill(stageSrc, active?.resultName || "still.png", active?.resultFolder || "output");
                }}
              >
                <Play className="size-6 fill-current" />
              </button>
            </div>
          )
        ) : tab === "combine" ? (
          <div className="flex h-[42dvh] flex-col items-center justify-center gap-3 px-4 md:h-[52dvh]">
            <p className="text-2xl font-medium tracking-tight text-fg">Combine 2–5 photos</p>
            <p className="max-w-md text-center text-sm text-muted">
              {media.filter((x) => x.kind === "image").length >= 2
                ? "Type the new scene below, then Generate. Tap a slot to remove. Tap Results or the library to add more."
                : media.filter((x) => x.kind === "image").length === 1
                  ? "That’s slot 1. Tap a second photo from Results or the library. Then type the new scene."
                  : "Tap photos from Results below or the library. Need at least two."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => {
                const m = media.filter((x) => x.kind === "image")[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className="size-24 overflow-hidden rounded-xl bg-raised ring-1 ring-line md:size-28"
                    onClick={() => {
                      if (m) useForge.getState().removeMedia(m.id);
                      else openLibrary();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const still = readForgeStill(e.dataTransfer);
                      if (still) void placeLibraryStill(still, "add");
                      else if (e.dataTransfer.files.length) void onDropFiles(e.dataTransfer.files);
                    }}
                  >
                    {m ? (
                      <img src={m.dataUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs text-subtle">{i + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={openLibrary}>
                Pick from library
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => filePickRef.current?.click()}
              >
                From this PC
              </Button>
            </div>
          </div>
        ) : tab === "comic" ? (
          <div className="flex h-[42dvh] flex-col items-center justify-center gap-3 px-4 md:h-[52dvh]">
            <p className="text-2xl font-medium tracking-tight text-fg">Build a comic page</p>
            <p className="max-w-md text-center text-sm text-muted">
              Type the story below. One beat per line, or <span className="text-fg">P1:</span> <span className="text-fg">P2:</span>.
              Pick a layout. Generate makes one printed page — same characters in every panel.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {COMIC_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  title={l.hint}
                  onClick={() => {
                    setComicLayout(l.id);
                    useForge.getState().setAspect(l.aspect);
                  }}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs",
                    comicLayout === l.id ? "bg-accent text-accent-fg" : "bg-raised text-fg",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {COMIC_INK.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  onClick={() => setComicInk(ink.id)}
                  className={cn(
                    "h-8 rounded-full px-2.5 text-[11px]",
                    comicInk === ink.id ? "bg-bg text-fg" : "text-subtle hover:text-fg",
                  )}
                >
                  {ink.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-[42dvh] w-full flex-col items-center justify-center gap-3 px-6 text-center md:h-[52dvh]"
            onClick={openLibrary}
          >
            <p className="text-2xl font-medium tracking-tight text-fg">
              {tab === "video" ? "Animate it" : "Imagine it"}
            </p>
            <p className="max-w-sm text-sm text-muted">
              {tab === "video"
                ? "Pick a still from the library or Results — that photo is frame 1. Or type below for text-to-video."
                : "Type below. Or pick a photo from the library to edit."}
            </p>
            <span className="rounded-full bg-accent px-5 py-2.5 text-sm text-accent-fg">
              {tab === "video" ? "Add a still to animate" : "Library or type below"}
            </span>
          </button>
        )}
        <div className={cn("absolute left-3 top-14 z-[70] w-[7.5rem] space-y-1", tab === "combine" && "hidden")}>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {mode === "ref2i" ? "Combine" : tab === "video" ? "Frame 1" : "Edit source"}
          </p>
          {(mode === "ref2i" ? media.filter((m) => m.kind === "image").slice(0, 5) : media.slice(0, 1)).map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="block size-[7.5rem] overflow-hidden rounded-lg bg-raised ring-1 ring-line"
              onClick={() => {
                if (mode === "ref2i" || tab === "combine") {
                  useForge.getState().removeMedia(m.id);
                  return;
                }
                openLibrary();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const still = readForgeStill(e.dataTransfer);
                if (still) void placeLibraryStill(still, mode === "ref2i" ? "add" : "edit");
                else if (e.dataTransfer.files.length) void onDropFiles(e.dataTransfer.files);
              }}
              title={mode === "ref2i" ? `Ref ${i + 1}` : "Drop a library still here to edit"}
            >
              {m.kind === "video" ? (
                <video src={m.dataUrl} muted className="size-full object-cover" />
              ) : (
                <img src={m.dataUrl} alt="" className="size-full object-cover" />
              )}
            </button>
          ))}
          <button
            type="button"
            className="flex size-[7.5rem] flex-col items-center justify-center gap-1 rounded-lg bg-raised px-2 text-center text-[11px] text-subtle ring-1 ring-line"
            onClick={() => {
              if (tab === "combine" || mode === "ref2i") {
                useForge.getState().setMode("ref2i");
                const d = useForge.getState().denoise;
                if (d < 0.62 || d === 1) useForge.getState().setDenoise(0.76);
                openLibrary();
                return;
              }
              openLibrary();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const still = readForgeStill(e.dataTransfer);
              if (still) void placeLibraryStill(still, "add");
              else if (e.dataTransfer.files.length) void onDropFiles(e.dataTransfer.files);
            }}
            title="Drop a library still here to add it"
          >
            <ImagePlus className="size-4" />
            {mode === "ref2i" ? "Add ref" : tab === "video" ? "Add still" : "Add photo"}
          </button>
          {sourceSrc && mode !== "ref2i" ? (
            <Button size="sm" variant="secondary" className="w-full" onClick={() => void deleteThisStill(sourceSrc)}>
              <Trash2 />
              Shred this
            </Button>
          ) : null}
          {mode === "ref2i" && media.length ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => {
                useForge.getState().setMedia([]);
                useForge.getState().setMode("t2i");
              }}
            >
              Clear refs
            </Button>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-3">
          <div className="forge-hover-bar">
          <Button
            size="icon"
            variant="secondary"
            className="size-10 rounded-full"
            onClick={openLibrary}
            aria-label="Add"
          >
            <ImagePlus />
          </Button>
          <Button
            size="sm"
            variant={mode === "ref2i" || tab === "combine" ? "default" : "secondary"}
            className="rounded-full"
            onClick={beginCombine}
          >
            Combine
          </Button>
          {stageSrc ? (
            <>
              <Button size="sm" variant="secondary" className="rounded-full" onClick={editThisStill}>
                Edit
              </Button>
              <Button
                size="sm"
                variant={qualityPick.includes("4k") ? "default" : "secondary"}
                className="rounded-full"
                onClick={() => {
                  const on = !useForge.getState().qualityPick.includes("4k");
                  useForge.getState().toggleQuality("4k");
                  if (on) void fireGenerate();
                }}
              >
                4K
              </Button>
              <Button size="icon" variant="secondary" className="size-10 rounded-full" onClick={likeThisStill} aria-label="Like">
                <Heart />
              </Button>
              <Button size="icon" variant="secondary" className="size-10 rounded-full" onClick={() => void deleteThisStill()} aria-label="Shred">
                <Trash2 />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" className="rounded-full" onClick={editThisStill}>
              Edit
            </Button>
          )}
          </div>
        </div>
        <input
          ref={filePickRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv,.m4v"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void onDropFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        {media.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                className="relative size-12 overflow-hidden rounded-md bg-raised"
                onClick={() => useForge.getState().removeMedia(m.id)}
                aria-label={`Remove ${m.name}`}
              >
                {m.kind === "video" ? (
                  <video src={m.dataUrl} muted className="size-full object-cover" />
                ) : (
                  <img src={m.dataUrl} alt="" className="size-full object-cover" />
                )}
                <X className="absolute right-0.5 top-0.5 size-3 text-fg" />
              </button>
            ))}
          </div>
        )}
        {active?.status && active.status !== "done" && (
          <div className="absolute inset-x-3 top-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={active.status === "error" ? "danger" : "warn"}>{active.status}</Badge>
              {active.status === "running" || active.status === "queued" ? (
                <span className="text-xs text-muted">{active.progress ?? 5}%</span>
              ) : null}
            </div>
            {(active.status === "running" || active.status === "queued") && (
              <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{ width: `${Math.max(5, active.progress ?? 5)}%` }}
                />
              </div>
            )}
            {(active.error || active.log) && (
              <pre className="max-h-36 overflow-auto rounded-lg bg-bg/90 p-2 text-[11px] leading-snug text-danger whitespace-pre-wrap">
                {active.error}
                {active.log && active.log !== active.error ? `\n${active.log}` : ""}
              </pre>
            )}
          </div>
        )}
        {active?.error && active.status === "done" ? (
          <p className="absolute inset-x-3 bottom-3 rounded-lg bg-bg/80 px-3 py-2 text-xs text-danger">
            {active.error}
          </p>
        ) : null}
      </section>

      {(liveFiles.length > 0 || jobs.length > 0 || likes.length > 0) && tab !== "errors" ? (
        <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 md:px-5">
          <p className="flex h-16 shrink-0 items-center text-[11px] text-subtle">Results</p>
          {likes.map((l) => (
            <button
              key={l.id}
              type="button"
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ring-accent"
              title="Enlarge"
              onClick={() => {
                if (tab === "combine" || mode === "ref2i") {
                  void placeLibraryStill({ src: l.src, name: "liked.png", folder: "output" }, "add");
                  return;
                }
                setZoom({ src: l.src, kind: "image", name: "liked" });
              }}
            >
              <img src={l.src} alt="" className="size-full object-cover" />
              <Heart className="absolute bottom-1 right-1 size-3 fill-accent text-accent" />
            </button>
          ))}
          {liveFiles.filter((f) => !jobs.some((j) => stillKey(j.resultName) === stillKey(f.name))).map((f) => {
            const src = `/forge-media?folder=${f.folder}&name=${encodeURIComponent(f.name)}`;
            const vid = isVideoName(f.name);
            return (
              <button
                key={`${f.folder}-${f.name}-${f.mtime}`}
                type="button"
                draggable
                className="relative h-16 w-16 shrink-0 cursor-grab overflow-hidden rounded-lg bg-raised active:cursor-grabbing"
                title={tab === "combine" || mode === "ref2i" ? "Tap to add to Combine" : "Drag onto Add photo, or tap to enlarge"}
                onDragStart={(e) => dragForgeStill(e, { src, name: f.name, folder: f.folder })}
                onClick={() => {
                  if (!vid && (tab === "combine" || mode === "ref2i")) {
                    void placeLibraryStill({ src, name: f.name, folder: f.folder }, "add");
                    return;
                  }
                  if (!vid && tab === "video") {
                    loadForVideo(src, f.name, f.folder);
                    return;
                  }
                  setZoom({ src, kind: vid ? "video" : "image", name: f.name });
                  if (!vid) void adoptDroppedStill(src);
                }}
              >
                {vid ? (
                  <ForgeClip src={src} muted className="size-full object-cover" />
                ) : (
                  <img src={src} alt="" className="size-full object-cover" />
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-bg/70 px-0.5 text-[8px] text-muted">
                  {f.folder === "input" ? "in" : "out"}
                </span>
              </button>
            );
          })}
          {jobs.map((job) => (
            <div key={job.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!job.resultDataUrl) {
                    useForge.getState().setActiveJob(job.id);
                    return;
                  }
                  if (job.resultKind !== "video" && (tab === "combine" || mode === "ref2i")) {
                    void placeLibraryStill(
                      { src: job.resultDataUrl, name: job.resultName || `seed ${job.seed}`, folder: job.resultFolder },
                      "add",
                    );
                    return;
                  }
                  if (job.resultKind !== "video" && tab === "video") {
                    loadForVideo(job.resultDataUrl, job.resultName || `seed ${job.seed}`, job.resultFolder);
                    return;
                  }
                  adoptJob(job);
                  setZoom({
                    src: job.resultDataUrl,
                    kind: job.resultKind,
                    name: job.resultName || `seed ${job.seed}`,
                  });
                }}
                className={cn(
                  "h-16 w-16 overflow-hidden rounded-lg bg-raised",
                  job.id === active?.id && "ring-2 ring-accent",
                )}
                title="Enlarge"
              >
                {job.resultDataUrl ? (
                  job.resultKind === "video" ? (
                    <ForgeClip src={job.resultDataUrl} muted className="size-full object-cover" />
                  ) : (
                    <img src={job.resultDataUrl} alt="" className="size-full object-cover" />
                  )
                ) : (
                  <span className="flex size-full items-center justify-center text-[10px] text-subtle">
                    {job.status}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-danger text-white"
                title="Shred this still (overwrite then delete)"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteThisStill(job.resultDataUrl);
                }}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "mixes" && mixJobIds.length ? (
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 sm:grid-cols-3 md:grid-cols-4 md:px-5">
          {mixJobIds.map((id) => {
            const job = jobs.find((j) => j.id === id);
            if (!job) return null;
            const label = (job.checkpoint || "").split("/").pop() || "mix";
            return (
              <button
                key={id}
                type="button"
                className="overflow-hidden rounded-xl bg-raised text-left"
                onClick={() => {
                  adoptJob(job);
                  if (job.resultDataUrl) {
                    setZoom({
                      src: job.resultDataUrl,
                      kind: job.resultKind,
                      name: label,
                    });
                  }
                }}
              >
                <div className="aspect-square bg-surface">
                  {job.resultDataUrl ? (
                    <img src={job.resultDataUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-xs text-subtle">
                      {job.status}
                    </span>
                  )}
                </div>
                <p className="truncate px-2 py-1 text-[11px] text-fg">{label}</p>
                <p className="px-2 pb-2 text-[10px] text-subtle">seed {job.seed}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      {scan && tab !== "errors" ? (
      <div className="flex items-start gap-3 px-3 py-2 md:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Detector</p>
          {scan ? (
            <>
              <p className="mt-0.5 text-sm leading-relaxed">{scan.summary}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {scan.tags.slice(0, 20).map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    className="rounded-full bg-raised px-2 py-0.5 text-[10px] hover:bg-accent hover:text-accent-fg"
                    onClick={() => {
                      const cur = useForge.getState().prompt.trim();
                      useForge.getState().setPrompt(cur ? `${cur}, ${t.tag}` : t.tag);
                    }}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-subtle">
              {comfy?.taggerClass
                ? "WD14 tags the still after Generate, or tap Scan."
                : "WD14 node not seen — restart Comfy with ComfyUI-WD14-Tagger."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="hidden items-center gap-2 text-xs text-muted sm:flex">
            Boxes
            <Switch checked={showBoxes} onCheckedChange={(v) => useForge.getState().setShowBoxes(v)} />
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!stageSrc) {
                toast.error("Drop a still or video first");
                return;
              }
              setBusy(true);
              void runWd14Scan(stageSrc)
                .then((result) => {
                  useForge.getState().setLiveScan(result);
                  useForge.getState().setShowBoxes(true);
                  if (active) useForge.getState().patchJob(active.id, { scan: result });
                })
                .finally(() => setBusy(false));
            }}
          >
            <ScanSearch />
            Scan
          </Button>
        </div>
      </div>
      ) : null}

      <div className={cn("bg-bg px-3 pb-4 pt-2 md:px-5", tab === "errors" && "hidden")}>
        <div className="forge-composer mx-auto max-w-3xl rounded-[28px] p-3">
          {mode === "i2i" && tab !== "mixes" ? (
            <div className="space-y-2 px-2 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-fg">
                  {media[0] ? `Editing: ${media[0].name}` : "No photo yet — drop one or tap Edit this on a result."}
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={() => clearEdit("photo")}>
                  Clear photo
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => clearEdit("words")}>
                  Clear words
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => clearEdit("all")}>
                  Clear all
                </Button>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Photo on the stage (done if you see it above)</li>
                <li>Fill Take out / Put in / Change — not a whole new scene</li>
                <li>Header mix = Illustrious / Pony / SDXL, then Generate</li>
              </ol>
              <p className="text-sm text-muted">What should change?</p>
              <div className="flex items-start gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => useForge.getState().setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void generate();
                  }
                }}
                placeholder="remove the shirt, add a red jacket"
                className="min-h-20 flex-1 bg-bg text-base"
              />
              <SpeechMic
                label="Speak edit"
                onPhrase={(p) => useForge.getState().setPrompt(appendSpoken(useForge.getState().prompt, p))}
              />
              </div>
              <label className="block text-xs uppercase tracking-wide text-muted">Take out</label>
              <div className="flex gap-2">
              <Input
                value={editRemove}
                onChange={(e) => useForge.getState().setEditRemove(e.target.value)}
                placeholder="the shirt"
                className="h-11 flex-1 bg-bg"
              />
              <SpeechMic
                label="Speak take out"
                className="size-11"
                onPhrase={(p) => useForge.getState().setEditRemove(appendSpoken(useForge.getState().editRemove, p))}
              />
              </div>
              <label className="block text-xs uppercase tracking-wide text-muted">Put in</label>
              <div className="flex gap-2">
              <Input
                value={editAdd}
                onChange={(e) => useForge.getState().setEditAdd(e.target.value)}
                placeholder="a red jacket"
                className="h-11 flex-1 bg-bg"
              />
              <SpeechMic
                label="Speak put in"
                onPhrase={(p) => useForge.getState().setEditAdd(appendSpoken(useForge.getState().editAdd, p))}
              />
              </div>
              <label className="block text-xs uppercase tracking-wide text-muted">Change</label>
              <div className="flex gap-2">
              <Input
                value={editChange}
                onChange={(e) => useForge.getState().setEditChange(e.target.value)}
                placeholder="hair to blonde"
                className="h-11 flex-1 bg-bg"
              />
              <SpeechMic
                label="Speak change"
                onPhrase={(p) => useForge.getState().setEditChange(appendSpoken(useForge.getState().editChange, p))}
              />
              </div>
              {liveScan?.tags.length ? (
                <p className="text-xs text-muted">
                  Scan sees: {liveScan.tags.slice(0, 10).map((t) => t.tag).join(", ")}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const x = expandEditFields({
                    remove: useForge.getState().editRemove,
                    add: useForge.getState().editAdd,
                    change: useForge.getState().editChange,
                  });
                  if (!x.remove && !x.add && !x.change) {
                    toast.error("Type something in Take out, Put in, or Change first.");
                    return;
                  }
                  useForge.getState().setEditRemove(x.remove);
                  useForge.getState().setEditAdd(x.add);
                  useForge.getState().setEditChange(x.change);
                  toast.success("Those three lines are now longer. Generate to apply.");
                }}
              >
                Make longer
              </Button>
            </div>
          ) : mode === "ref2i" ? (
            <>
              <p className="px-3 pt-2 text-sm text-muted">
                Combine {media.filter((m) => m.kind === "image").length} of 5 photos into one new still.
                {media.filter((m) => m.kind === "image").length < 2
                  ? " Tap another photo from Results or Pick from library."
                  : " Type that new scene, then Generate."}
              </p>
              <div className="flex items-start gap-2">
              <Textarea
                value={refPrompt}
                onChange={(e) => useForge.getState().setRefPrompt(e.target.value)}
                placeholder="Same face as photo 1, outfit from photo 2, bedroom"
                className="min-h-20 flex-1 bg-transparent text-base shadow-none"
              />
              <SpeechMic
                label="Speak combine"
                onPhrase={(p) => useForge.getState().setRefPrompt(appendSpoken(useForge.getState().refPrompt, p))}
              />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2">
              <Textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => {
                  useForge.getState().setPrompt(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (tab === "mixes") void runMixes();
                    else void generate();
                  }
                }}
                placeholder="Imagine anything — or tap the mic"
                className="min-h-[4.5rem] flex-1 resize-none bg-transparent text-[17px] leading-relaxed shadow-none placeholder:text-subtle"
              />
              <SpeechMic
                label="Speak prompt"
                onPhrase={(p) => useForge.getState().setPrompt(appendSpoken(useForge.getState().prompt, p))}
              />
              <button
                type="button"
                disabled={brainBusy}
                className="inline-flex h-11 shrink-0 items-center rounded-full bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-60"
                title={brainOn ? `Fills the prompt. Local brain · ${brainModel}` : "Fills the prompt locally. Turn Ollama on for a smarter rewrite."}
                onClick={() => void runBrain()}
              >
                {brainBusy ? "…" : "Brain"}
              </button>
              </div>
              <div className="mt-1 border-t border-line px-1 pt-2">
                <div className="mb-1 flex items-center gap-1 px-1">
                  <Label htmlFor="neg" className="flex-1 px-1 text-[11px] uppercase tracking-wide text-muted">
                    Negative — keep out {negLocked ? "(locked)" : ""}
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      useForge.getState().setNegative(
                        negativeForPrompt(useForge.getState().settings.checkpoint, useForge.getState().prompt),
                        { force: true },
                      );
                      useForge.getState().setNegLocked(true);
                      logForge("info", "Negative", "Filled and locked");
                    }}
                  >
                    Auto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={negLocked ? "default" : "secondary"}
                    onClick={() => {
                      const next = !useForge.getState().negLocked;
                      useForge.getState().setNegLocked(next);
                      logForge("info", "Negative", next ? "Locked" : "Unlocked");
                    }}
                  >
                    {negLocked ? "Unlock" : "Lock"}
                  </Button>
                </div>
                <div className="flex items-start gap-2">
                  <Textarea
                    id="neg"
                    ref={negRef}
                    value={negative}
                    readOnly={negLocked}
                    onChange={(e) => {
                      if (useForge.getState().negLocked) return;
                      useForge.getState().setNegative(e.target.value);
                    }}
                    placeholder={negLocked ? "Locked. Tap Unlock to edit." : "extra fingers, watermark, blurry…  (empty still sends a quality floor)"}
                    className={cn("min-h-14 flex-1 resize-none bg-transparent text-sm shadow-none placeholder:text-subtle", negLocked && "opacity-60")}
                  />
                  <SpeechMic
                    label="Speak negative"
                    onPhrase={(p) => {
                      if (useForge.getState().negLocked) return;
                      useForge.getState().setNegative(appendSpoken(useForge.getState().negative, p));
                    }}
                  />
                </div>
              </div>
              {dock === "look" ? (
              <div className="forge-chip-row px-1 pb-1">
                <button
                  type="button"
                  className={
                    promptRoll === "normal"
                      ? "h-8 shrink-0 rounded-full bg-accent px-2.5 text-xs text-accent-fg"
                      : "h-8 shrink-0 rounded-full bg-raised px-2.5 text-xs text-fg"
                  }
                  onClick={() => useForge.getState().setPromptRoll("normal")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={
                    promptRoll === "random"
                      ? "h-8 shrink-0 rounded-full bg-accent px-2.5 text-xs text-accent-fg"
                      : "h-8 shrink-0 rounded-full bg-raised px-2.5 text-xs text-fg"
                  }
                  onClick={() => useForge.getState().setPromptRoll("random")}
                >
                  {"{ a | b }"}
                </button>
                {QUALITY_OFFERS.map((o) => (
                  <button
                    key={`q-${o.id}`}
                    type="button"
                    className={
                      qualityPick.includes(o.id)
                        ? "h-8 shrink-0 rounded-full bg-accent px-2.5 text-xs text-accent-fg"
                        : "h-8 shrink-0 rounded-full bg-raised px-2.5 text-xs text-fg"
                    }
                    title={o.tags}
                    onClick={() => useForge.getState().toggleQuality(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
                {ART_WRAPS.filter((w) => w.id !== "none" && w.id !== "none2").map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={
                      artWrap === w.id
                        ? "h-8 shrink-0 rounded-full bg-accent px-2.5 text-xs text-accent-fg"
                        : "h-8 shrink-0 rounded-full bg-raised px-2.5 text-xs text-fg"
                    }
                    onClick={() => useForge.getState().setArtWrap(w.id)}
                    title={w.wrap.replace("[p]", "your prompt")}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              ) : null}
            </>
          )}
          {ideas.length > 0 && dock === "write" ? (
            <div className="grid gap-2 px-1 pb-2 sm:grid-cols-2">
              {ideas.map((idea, i) => (
                <button
                  key={`${i}-${idea.slice(0, 24)}`}
                  type="button"
                  className="max-h-48 overflow-auto rounded-xl bg-bg px-3 py-2 text-left text-xs leading-snug text-fg shadow-[var(--shadow-border)] hover:bg-accent hover:text-accent-fg"
                  onClick={() => {
                    skipIdeaRefresh.current = true;
                    const st = useForge.getState();
                    st.setPrompt(idea);
                    promptRef.current?.focus();
                    if (st.mode === "ref2i") st.setRefPrompt(idea);
                    void generate();
                  }}
                >
                  <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                    {i === 0 ? "Tap to generate" : `Option ${i + 1} · tap to generate`}
                  </span>
                  {idea}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Add photo"
              onClick={openLibrary}
            >
              <ImagePlus className="size-4" />
            </Button>
            {tab === "comic"
              ? COMIC_LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    title={`${l.hint} · ${l.panels} panels`}
                    onClick={() => {
                      setComicLayout(l.id);
                      useForge.getState().setAspect(l.aspect);
                    }}
                    className={cn(
                      "h-9 rounded-full px-2.5 text-xs",
                      comicLayout === l.id ? "bg-bg text-fg" : "text-subtle hover:text-fg",
                    )}
                  >
                    {l.label}
                  </button>
                ))
              : ASPECTS.slice(0, 4).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => useForge.getState().setAspect(a)}
                className={cn(
                  "h-9 rounded-full px-2.5 text-xs",
                  aspect === a ? "bg-bg text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {a}
              </button>
            ))}
            {!meta.video && tab !== "comic"
              ? ([1, 2, 4, 8] as const).map((n) => (
                  <button
                    key={`b${n}`}
                    type="button"
                    title={`${n} stills per Generate`}
                    onClick={() => useForge.getState().setSettings({ batchSize: n })}
                    className={cn(
                      "h-9 rounded-full px-2.5 text-xs",
                      (settings.batchSize || 1) === n ? "bg-bg text-fg" : "text-subtle hover:text-fg",
                    )}
                  >
                    {n}×
                  </button>
                ))
              : null}
            {meta.video
              ? ([6, 10, 15] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={cn(
                      "h-9 rounded-full px-2.5 text-xs",
                      duration === d ? "bg-bg text-fg" : "text-subtle",
                    )}
                    onClick={() => {
                      useForge.getState().setDuration(d);
                    }}
                  >
                    {d}s
                  </button>
                ))
              : null}
            {meta.video ? (
              <Button
                type="button"
                size="sm"
                variant={soundOn ? "default" : "secondary"}
                onClick={() => useForge.getState().setSoundOn(!useForge.getState().soundOn)}
                title="After the clip is done, mux a female voice + room tone with ffmpeg"
              >
                {soundOn ? "Sound on" : "Sound off"}
              </Button>
            ) : null}
            {(mode === "i2i" || mode === "v2v" || media.length > 0) && (
              <div className="flex w-40 items-center gap-2">
                <span className="text-xs text-muted">Strength {denoise.toFixed(2)}</span>
                <Slider
                  min={0.15}
                  max={1}
                  step={0.01}
                  value={[denoise]}
                  onValueChange={(v) => useForge.getState().setDenoise(v[0] ?? denoise)}
                />
              </div>
            )}
            {dock === "look" ? (
            <>
            <Button
              type="button"
              variant={seedLocked ? "default" : "ghost"}
              size="icon"
              className="size-9 min-h-9 min-w-9"
              title={seedLocked ? "Seed locked — same number, same picture if nothing else changes" : "Seed unlocked — each Generate rolls a new one"}
              aria-label="Lock seed"
              onClick={() => useForge.getState().toggleSeedLock()}
            >
              {seedLocked ? <Lock /> : <Unlock />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 min-h-9 min-w-9"
              onClick={() => useForge.getState().rollSeed()}
              aria-label="Shuffle seed"
              title="New random seed"
            >
              <Shuffle />
            </Button>
            <Input
              className="h-9 w-28 bg-bg"
              value={seed}
              title="Seed: the random start. Same seed + same prompt + same checkpoint = same still. Copy it to remake a shot."
              onChange={(e) => useForge.getState().setSeed(Number(e.target.value) || 0)}
              aria-label="Seed"
            />
            <Button
              type="button"
              variant={showMore ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowMore((v) => !v)}
            >
              More
            </Button>
            {!meta.video ? (
              <Button
                type="button"
                variant={settings.hires ? "default" : "secondary"}
                size="sm"
                title="Second pass: enlarge 1.5× and paint again. From text only. Takes about twice as long."
                aria-pressed={!!settings.hires}
                onClick={() => useForge.getState().setSettings({ hires: !settings.hires })}
              >
                {settings.hires ? "Hires on" : "Hires"}
              </Button>
            ) : null}
            {showMore ? (
              <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              title="CLIP layers dropped. Illustrious / Pony / SD1.5 = 2. Flux = 1. Picking a checkpoint already sets this."
              onClick={() =>
                useForge.getState().setSettings({
                  clipSkip: (settings.clipSkip || 1) >= 2 ? 1 : 2,
                })
              }
            >
              CLIP skip {settings.clipSkip || 1}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSheet("library");
                void listComfyRecentFn({ data: { all: true } }).then(setLibrary).catch(() => setLibrary([]));
              }}
            >
              Comfy files
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void listComfyRecentFn({ data: { all: true } }).then((list) => {
                  setSlides(list);
                  setShowShow(true);
                });
              }}
            >
              <Images />
              Slideshow
            </Button>
              </>
            ) : null}
            </>
            ) : null}
            <Button
              type="button"
              variant={dock === "look" ? "default" : "secondary"}
              size="sm"
              className="rounded-full"
              onClick={() => setDock((d) => (d === "look" ? "off" : "look"))}
            >
              Look
            </Button>
            <Button
              type="button"
              variant={dock === "write" ? "default" : "secondary"}
              size="sm"
              className="rounded-full"
              onClick={() => {
                setChipTab("write");
                setDock("write");
                const menu = writeMenus().find((m) => m.id === writeCat);
                void writeIntoBox(menu?.surprise ?? "enhance");
              }}
            >
              <Sparkles />
              Write
            </Button>
            <Button
              type="button"
              className="ml-auto min-h-12 min-w-32 touch-manipulation rounded-full"
              size="lg"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              title="Sends the box as-is. Tap Brain or Write to fill it first."
              onTouchEnd={(e) => {
                e.stopPropagation();
                fireGenerate();
              }}
              onClick={() => fireGenerate()}
            >
              {tab === "mixes" ? (
                `Run ${mixPick.length || 0}`
              ) : jobs.some((j) => j.status === "running" || j.status === "queued") ? (
                <>
                  <Loader2 className="animate-spin" />
                  Queue
                </>
              ) : (
                "Generate"
              )}
            </Button>
            {showMore && graphs.length ? (
              <select
                aria-label="Saved Comfy workflow"
                className="h-11 max-w-[10rem] truncate rounded-lg bg-raised px-2 text-xs text-fg"
                defaultValue=""
                onChange={(e) => {
                  const name = e.target.value;
                  e.currentTarget.value = "";
                  if (name) void runSavedGraph(name);
                }}
              >
                <option value="">Comfy graphs…</option>
                {graphs.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-3xl">
          {dock !== "write" ? null : (
          <div id="forge-write-dock">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ["write", "Writer"],
                ["types", "Kinks"],
                ["wild", "Lists"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "h-9 rounded-full px-3 text-sm",
                  chipTab === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                )}
                onClick={() => setChipTab(id)}
              >
                {label}
                {id === "types" && nsfwPick.size ? ` ${nsfwPick.size}` : ""}
              </button>
            ))}
            {nsfwPick.size > 0 ? (
              <>
                <button type="button" className="h-9 rounded-full bg-accent px-3 text-xs text-accent-fg" onClick={combineNsfw}>
                  Put in prompt {nsfwPick.size}
                </button>
                <button type="button" className="h-9 rounded-full px-3 text-xs text-subtle" onClick={() => setNsfwPick(new Set())}>
                  Clear
                </button>
              </>
            ) : null}
            <button type="button" className="ml-auto h-9 rounded-full px-3 text-xs text-subtle hover:text-fg" onClick={() => useForge.getState().setPrompt("")}>
              Clear box
            </button>
            <button type="button" className="h-9 rounded-full px-3 text-xs text-subtle hover:text-fg" onClick={() => setDock("off")}>
              Close
            </button>
          </div>
          {chipTab === "write" ? (
            <div className="mt-2 space-y-2">
              <p className="px-2 text-xs text-muted">Write fills the box from this group. Tap chips to add. Search if the list is long.</p>
              <Input
                value={writeQ}
                onChange={(e) => setWriteQ(e.target.value)}
                placeholder="Search this group…"
                className="h-9 bg-bg text-sm"
              />
              <div className="flex gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="h-9 shrink-0 rounded-full bg-accent px-3 text-sm font-medium text-accent-fg"
                  onClick={() => {
                    const line = randomSceneLine(Date.now());
                    const next = flattenPrompt(line, Date.now() % 1_000_000_000);
                    skipIdeaRefresh.current = true;
                    useForge.getState().setPrompt(next);
                  }}
                >
                  Random scene
                </button>
                {writeMenus().map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    className={
                      writeCat === menu.id
                        ? "h-9 shrink-0 rounded-full bg-accent px-3 text-sm font-medium text-accent-fg"
                        : "h-9 shrink-0 rounded-full bg-raised px-3 text-sm text-fg hover:bg-accent hover:text-accent-fg"
                    }
                    onClick={() => {
                      setWriteCat(menu.id);
                      setWriteQ("");
                    }}
                  >
                    {menu.label} {menu.items.length}
                  </button>
                ))}
              </div>
              {(() => {
                const menu = writeMenus().find((m) => m.id === writeCat) ?? writeMenus()[0]!;
                const q = writeQ.trim().toLowerCase();
                const items = q
                  ? menu.items.filter(
                      (t) =>
                        t.label.toLowerCase().includes(q) ||
                        t.tags.toLowerCase().includes(q) ||
                        t.id.toLowerCase().includes(q),
                    )
                  : menu.items;
                return (
                  <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto rounded-2xl bg-bg p-2">
                    {menu.surprise ? (
                      <button
                        type="button"
                        className="h-10 rounded-full bg-accent px-3 text-sm font-medium text-accent-fg"
                        onClick={() => writeIntoBox(menu.surprise!)}
                      >
                        Write {menu.label}
                      </button>
                    ) : null}
                    {items.map((t) => {
                      const on = nsfwPick.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          title={t.tags}
                          className={
                            on
                              ? "h-10 rounded-full bg-accent px-3 text-sm text-accent-fg"
                              : "h-10 rounded-full bg-raised px-3 text-sm text-fg hover:bg-accent hover:text-accent-fg"
                          }
                          onClick={() => addChipToPrompt(t)}
                        >
                          {on ? `+ ${t.label}` : t.label}
                        </button>
                      );
                    })}
                    {items.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted">Nothing in {menu.label} for that search.</p>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          ) : null}
          {chipTab === "types" ? (
            <div className="mt-2">
              <p className="px-2 pb-2 text-xs text-muted">Tap types, then Put in prompt.</p>
              {nsfwPick.size > 0 ? (
                <p className="mb-2 px-2 text-xs text-fg">
                  Picked: {NSFW_TYPES.filter((t) => nsfwPick.has(t.id)).map((t) => t.label).join(" + ")}
                </p>
              ) : null}
              <div className="mb-2 flex gap-1 px-1">
                <Button type="button" size="sm" onClick={combineNsfw} disabled={!nsfwPick.size}>
                  Put in prompt {nsfwPick.size || ""}
                </Button>
                {nsfwPick.size > 0 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setNsfwPick(new Set())}>
                    Clear picks
                  </Button>
                ) : null}
              </div>
              <Input
                value={typeQ}
                onChange={(e) => setTypeQ(e.target.value)}
                placeholder="Search types — vampire, gore, breeding…"
                className="mb-2 h-9 bg-bg text-sm"
              />
              {(
                [
                  ["Creatures", "Monster, demon, vampire, tentacle"],
                  ["Positions", "Missionary, doggy, cowgirl, 69, anal…"],
                  ["Sex", "Acts — breeding, DP, gangbang"],
                  ["BDSM", "Rope, collar, dungeon"],
                  ["Taboo", "Affair, stepmom 18+, boss"],
                  ["Horror", "Force, gore, stab"],
                ] as const
              ).map(([g, hint]) => {
                const items = NSFW_TYPES.filter(
                  (t) =>
                    nsfwGroup(t.id) === g &&
                    (!typeQ.trim() ||
                      t.label.toLowerCase().includes(typeQ.toLowerCase()) ||
                      t.tags.toLowerCase().includes(typeQ.toLowerCase())),
                );
                if (!items.length) return null;
                return (
                  <div key={g} className="mb-2">
                    <p className="px-2 text-[10px] uppercase tracking-wide text-muted">
                      {g} <span className="normal-case text-subtle">— {hint}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {items.map((t) => {
                        const on = nsfwPick.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            title={t.tags}
                            className={
                              on
                                ? "h-8 rounded-full bg-accent px-2.5 text-[11px] text-accent-fg"
                                : "h-8 rounded-full bg-bg px-2.5 text-[11px] text-fg hover:bg-accent hover:text-accent-fg"
                            }
                            onClick={() => {
                              setNsfwPick((prev) => {
                                const n = new Set(prev);
                                if (n.has(t.id)) n.delete(t.id);
                                else n.add(t.id);
                                return n;
                              });
                            }}
                          >
                            {on ? `+ ${t.label}` : t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {chipTab === "wild" ? (
            <div className="mt-2">
              <p className="px-2 pb-2 text-xs text-muted">Tap a list, pick a line. It writes real words.</p>
              <Input
                value={typeQ}
                onChange={(e) => setTypeQ(e.target.value)}
                placeholder="Search lists — hair, clothing, camera…"
                className="mb-2 h-9 bg-bg text-sm"
              />
              {wildOpen ? (
                <div className="mb-2 rounded-xl bg-bg p-2">
                  <p className="px-1 text-xs text-fg">
                    {wildOpen.name} · {wildOpen.total} lines · pick one
                  </p>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg bg-accent px-3 py-2 text-left text-xs text-accent-fg"
                    onClick={() => useWildLine(wildOpen.rolled)}
                  >
                    Random: {wildOpen.rolled.slice(0, 140) || "(empty)"}
                  </button>
                  <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-auto">
                    {wildOpen.preview.map((line) => (
                      <button
                        key={line}
                        type="button"
                        className="max-w-full truncate rounded-full bg-raised px-2.5 py-1 text-[11px] text-fg hover:bg-accent hover:text-accent-fg"
                        onClick={() => useWildLine(line)}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => void insertWildcardPick(wildOpen.name)}>
                      Another random
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setWildOpen(null)}>
                      Close list
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {(typeQ.trim()
                  ? (comfy?.wildcards ?? wildcards.map((w) => w.name)).filter((n) =>
                      n.toLowerCase().includes(typeQ.toLowerCase()),
                    )
                  : featuredWildcards(comfy?.wildcards?.length ? comfy.wildcards : wildcards.map((w) => w.name))
                )
                  .slice(0, 36)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="h-9 max-w-[10rem] truncate rounded-full bg-bg px-2.5 text-xs text-fg hover:bg-accent hover:text-accent-fg"
                      onClick={() => void insertWildcardPick(n)}
                    >
                      {n.replace(/[_-]+/g, " ")}
                    </button>
                  ))}
                <button
                  type="button"
                  className="h-9 rounded-full bg-bg px-3 text-xs text-fg hover:bg-accent hover:text-accent-fg"
                  onClick={() => void rollIntoPrompt()}
                >
                  Roll leftover lists
                </button>
                <button
                  type="button"
                  className="h-9 rounded-full px-3 text-xs text-subtle hover:text-fg"
                  onClick={() => setSheet("wild")}
                >
                  All {comfy?.wildcards.length || wildcards.length} lists
                </button>
              </div>
            </div>
          ) : null}
          </div>
          )}
          {loras
            .filter((l) => l.enabled)
            .slice(0, 4)
            .map((l) => (
              <button
                key={l.id}
                type="button"
                className="h-9 max-w-[9rem] truncate rounded-full bg-accent px-3 text-xs text-accent-fg"
                onClick={() => useForge.getState().upsertLora({ ...l, enabled: false })}
                title="Turn off"
              >
                {l.name}
              </button>
            ))}
          <button
            type="button"
            className="h-9 rounded-full px-3 text-xs text-subtle hover:text-fg"
            onClick={() => setSheet("loras")}
          >
            LoRAs {loras.filter((l) => l.enabled).length}/{loras.length || comfy?.loras.length || 0}
          </button>
          <p className="ml-auto truncate text-[11px] text-subtle">
            {activeName}
            {familyMatch.ok.length ? ` · ${familyMatch.ok.length} LoRA` : ""}
          </p>
        </div>
      </div>

      <Sheet open={sheet === "library"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Comfy input / output" side="bottom">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {tab === "combine" || mode === "ref2i"
                ? "Tap a still to add it to Combine. Need 2 to 5. Drag still works too."
                : tab === "video"
                  ? "Tap a still to animate it. That photo becomes frame 1."
                  : "Tap a still to edit it. Drag onto Add photo if you prefer."}
            </p>
            {(["output", "input"] as const).map((folder) => (
              <div key={folder}>
                <p className="mb-2 text-xs uppercase tracking-wide text-subtle">{folder}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {library.filter((f) => f.folder === folder).map((f) => {
                    const src = `/forge-media?folder=${folder}&name=${encodeURIComponent(f.name)}`;
                    return (
                      <div key={`${folder}-${f.name}`} className="relative overflow-hidden rounded-lg bg-raised">
                        <button
                          type="button"
                          draggable
                          className="block w-full cursor-grab active:cursor-grabbing"
                          onDragStart={(e) => dragForgeStill(e, { src, name: f.name, folder })}
                          onClick={() => {
                            if (tab === "combine" || mode === "ref2i") {
                              void placeLibraryStill({ src, name: f.name, folder }, "add");
                              return;
                            }
                            if (tab === "video") {
                              loadForVideo(src, f.name, folder);
                              setSheet(null);
                              return;
                            }
                            void loadForEdit(src, f.name, f.folder);
                            setSheet(null);
                          }}
                        >
                          <img src={src} alt={f.name} className="aspect-square w-full object-cover" />
                        </button>
                        <button
                          type="button"
                          className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-danger text-white"
                          title="shred -v -u -n 3"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const r = await shredComfyFn({ data: { folder, name: f.name } });
                            if (r.ok) {
                              toast.success("Shredded");
                              setLibrary((prev) => prev.filter((x) => !(x.folder === folder && x.name === f.name)));
                              logForge("info", "Shred", r.message);
                            } else {
                              toast.error(r.message);
                              logForge("error", "Shred", r.message);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!library.some((f) => f.folder === folder) ? (
                  <p className="text-xs text-subtle">Empty</p>
                ) : null}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "settings"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Settings" side="right">
          <SettingsForm urls={lanUrls} llm={llm} onOpen={(s) => setSheet(s)} />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "loras"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="LoRAs" side="bottom">
          <LoraCard loras={loras} family={familyMatch.family} blocked={familyMatch.blocked} />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "wild"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Wildcards" side="bottom">
          <WildcardCard
            diskNames={comfy?.wildcards ?? []}
            files={wildcards}
            expanded={expandedPreview}
            onInsert={(name) => {
              void insertWildcardPick(name);
              setSheet(null);
            }}
            onRoll={rollIntoPrompt}
          />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "graph"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Graph" side="bottom">
          <GraphCard job={active} onDownload={(k) => active && void downloadJob(active, k)} />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "scan"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Scan" side="bottom">
          <DetectorCard
            scan={scan}
            src={stageSrc}
            showBoxes={showBoxes}
            onToggleBoxes={(v) => useForge.getState().setShowBoxes(v)}
            onScan={() => {
              if (!stageSrc) {
                toast.error("Drop a still first");
                return;
              }
              void runWd14Scan(stageSrc).then((result) => {
                useForge.getState().setLiveScan(result);
                if (active) useForge.getState().patchJob(active.id, { scan: result });
              });
            }}
            busy={busy}
            onUseTags={() => {
              if (!scan) return;
              const tags = scan.tags
                .slice(0, 8)
                .map((t) => t.tag)
                .join(", ");
              useForge.getState().setPrompt(`${prompt}${prompt ? ", " : ""}${tags}`);
            }}
          />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "story"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Storyteller" side="bottom">
          <StoryCard
            scene={prompt}
            llm={llm}
            onUsePrompt={(t) => {
              useForge.getState().setPrompt(t);
              setSheet(null);
            }}
          />
        </SheetContent>
      </Sheet>
      <Sheet open={sheet === "history"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent title="Prompt history" side="bottom">
          <HistoryCard
            onUse={(t) => {
              useForge.getState().setPrompt(t);
              setSheet(null);
            }}
            onZoom={(src, name) => {
              setSheet(null);
              setZoom({ src, kind: "image", name });
            }}
          />
        </SheetContent>
      </Sheet>
      {zoom ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div className="flex items-center gap-2 p-3 text-sm text-white/70">
            <span>
              {zoom.name ?? "Still"} · {Math.max(1, gallery.findIndex((g) => g.src === zoom.src) + 1)}/{gallery.length || 1} · arrows · Esc
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const i = gallery.findIndex((g) => g.src === zoom.src);
                const next = gallery[(Math.max(i, 0) - 1 + gallery.length) % Math.max(gallery.length, 1)];
                if (next) setZoom(next);
              }}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const i = gallery.findIndex((g) => g.src === zoom.src);
                const next = gallery[(Math.max(i, 0) + 1) % Math.max(gallery.length, 1)];
                if (next) setZoom(next);
              }}
            >
              Next
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void placeLibraryStill({ src: zoom.src, name: zoom.name || "still.png", folder: "output" }, "add");
                setTab("combine");
                useForge.getState().setMode("ref2i");
                setZoom(null);
              }}
            >
              Add to Combine
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                loadForEdit(zoom.src, zoom.name || "still.png", "output");
                setZoom(null);
              }}
            >
              Edit this
            </Button>
            {zoom.kind !== "video" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  playStill(zoom.src, zoom.name || "still.png", "output");
                  setZoom(null);
                }}
              >
                <Play className="size-3 fill-current" />
                Play
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void deleteThisStill(zoom.src)}>
              <Trash2 />
              Shred
            </Button>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setZoom(null)}>
              Close
            </Button>
          </div>
          <button type="button" className="flex min-h-0 flex-1 items-center justify-center" onClick={() => setZoom(null)}>
            {zoom.kind === "video" || isVideoName(zoom.name || zoom.src) ? (
              <ForgeClip
                src={zoom.src}
                controls
                className="max-h-[88dvh] max-w-[96vw] object-contain"
              />
            ) : (
              <span className="relative inline-block max-h-[88dvh] max-w-[96vw]">
                <img src={zoom.src} alt="" className="max-h-[88dvh] max-w-[96vw] object-contain" />
                <ScanBoxes boxes={scan?.boxes ?? []} show={showBoxes} />
              </span>
            )}
          </button>
        </div>
      ) : null}
      {showShow ? (
        <Slideshow
          files={slides}
          onClose={() => setShowShow(false)}
          onUse={(folder, name, dataUrl) => {
            useForge.getState().clearMedia();
            useForge.getState().addMedia([{ id: uid(), kind: "image", name, dataUrl }]);
            useForge.getState().setMode("i2i");
            setShowShow(false);
            toast.success(`Edit ← ${name}`);
          }}
        />
      ) : null}
    </div>
  );
}

function Slideshow({
  files,
  onClose,
  onUse,
}: {
  files: { folder: "input" | "output"; name: string; mtime: number }[];
  onClose: () => void;
  onUse: (folder: "input" | "output", name: string, dataUrl: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(true);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!play || files.length < 2) return;
    const id = window.setInterval(() => {
      setI((n) => {
        const next = (n + 1) % files.length;
        scroller.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
        return next;
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [play, files.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute top-0 right-0 left-0 z-10 flex items-center gap-2 p-3">
        <p className="text-sm text-white/80">
          Slideshow · {files.length} · scroll or wait · {i + 1}/{files.length || 1}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setPlay((p) => !p)}>
          {play ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <div
        ref={scroller}
        className="h-dvh snap-y snap-mandatory overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
          if (idx !== i) setI(Math.max(0, Math.min(files.length - 1, idx)));
        }}
      >
        {files.map((f) => {
          const fresh = /(?:^|\/)(Forge_|forge_)/i.test(f.name);
          const src = `/forge-media?folder=${f.folder}&name=${encodeURIComponent(f.name)}`;
          return (
            <section
              key={`${f.folder}-${f.name}-${f.mtime}`}
              className="flex h-dvh snap-start flex-col items-center justify-center px-4 pt-14 pb-8"
            >
              {isVideoName(f.name) ? (
                <ForgeClip src={src} controls className="max-h-[78dvh] max-w-full object-contain" />
              ) : (
                <img src={src} alt={f.name} className="max-h-[78dvh] max-w-full object-contain" />
              )}
              <p className="mt-3 text-center text-xs text-white/70">
                <span className={fresh ? "text-signal" : "text-white/50"}>{fresh ? "New" : "Older"}</span>
                {" · "}
                {f.folder}/{f.name}
              </p>
              <Button
                className="mt-2"
                size="sm"
                onClick={() => {
                  void comfyMediaFn({ data: { folder: f.folder, name: f.name } }).then((file) => {
                    if (file.ok) onUse(f.folder, f.name, file.dataUrl);
                    else toast.error("Could not load");
                  });
                }}
              >
                Edit this
              </Button>
            </section>
          );
        })}
        {!files.length ? (
          <p className="flex h-dvh items-center justify-center text-white/50">No stills in Comfy yet</p>
        ) : null}
      </div>
    </div>
  );
}

function femaleVoices(): SpeechSynthesisVoice[] {
  const all = window.speechSynthesis?.getVoices() ?? [];
  const hot = all.filter((v) =>
    /female|woman|girl|samantha|zira|aria|jenny|amy|emma|victoria|karen|moira|tessa|fiona|susan|linda|hazel|siri|google us english/i.test(
      `${v.name} ${v.voiceURI}`,
    ),
  );
  return hot.length ? hot : all;
}

function speakStory(text: string, voiceURI: string) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = femaleVoices().find((x) => x.voiceURI === voiceURI) ?? femaleVoices()[0];
  if (v) u.voice = v;
  u.rate = 0.88;
  u.pitch = 0.82;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

function StoryCard({
  scene,
  llm,
  onUsePrompt,
}: {
  scene: string;
  llm: { ok: boolean; models: string[]; message: string };
  onUsePrompt: (t: string) => void;
}) {
  const settings = useForge((s) => s.settings);
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");

  useEffect(() => {
    const load = () => {
      const list = femaleVoices();
      setVoices(list);
      if (!voiceURI && list[0]) setVoiceURI(list[0].voiceURI);
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, [voiceURI]);

  async function write() {
    const url = settings.llmUrl || "http://127.0.0.1:11434";
    const models = llm.models;
    const want = settings.llmModel || "";
    const model =
      (want && models.includes(want) ? want : "") ||
      models.find((m) => /abliterate|dolphin/i.test(m)) ||
      models[0] ||
      want;
    setBusy(true);
    try {
      const r = await writeStoryFn({ data: { baseUrl: url, model, scene } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setStory(r.story);
      speakStory(r.story, voiceURI);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Writes a spoken story from the box, then reads it in a female voice on this device (browser
        TTS — pick the hottest female voice your OS has).
      </p>
      <select
        className="h-11 w-full rounded-lg bg-raised px-3 text-sm"
        value={voiceURI}
        onChange={(e) => setVoiceURI(e.target.value)}
      >
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name}
          </option>
        ))}
        {!voices.length ? <option value="">No voices yet — click Speak once</option> : null}
      </select>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void write()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Volume2 />}
          Write + speak
        </Button>
        <Button
          variant="secondary"
          onClick={() => (story ? speakStory(story, voiceURI) : toast.error("Write a story first"))}
        >
          Speak
        </Button>
        <Button variant="secondary" onClick={() => window.speechSynthesis.cancel()}>
          Stop
        </Button>
      </div>
      {story ? (
        <>
          <p className="max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{story}</p>
          <Button variant="outline" className="w-full" onClick={() => onUsePrompt(story.split("\n")[0] ?? story)}>
            First line → prompt
          </Button>
        </>
      ) : (
        <p className="text-xs text-subtle">Uses your current prompt as the scene. {llm.message}.</p>
      )}
    </div>
  );
}

function HistoryCard({
  onUse,
  onZoom,
}: {
  onUse: (prompt: string) => void;
  onZoom: (src: string, name: string) => void;
}) {
  const jobs = useForge((s) => s.jobs);
  const [disk, setDisk] = useState<{ path: string; items: { at: string; prompt: string; checkpoint: string; seed: number; mode: string }[] }>({
    path: "",
    items: [],
  });
  useEffect(() => {
    void listPromptsFn()
      .then(setDisk)
      .catch(() => {});
  }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        File on this PC:{" "}
        <span className="font-mono text-fg">{disk.path || "~/forge/prompt-history.jsonl"}</span>
      </p>
      <p className="text-xs text-subtle">
        Browser copy lives in localStorage key <span className="font-mono">forge-studio-v16</span> (this
        device only). Stills are in ComfyUI/output. Comfy graphs: user/default/workflows.
      </p>
      <div className="max-h-72 space-y-2 overflow-auto">
        {disk.items.map((it, i) => (
          <button
            key={`${it.at}-${i}`}
            type="button"
            className="block w-full rounded-xl bg-raised px-3 py-2 text-left text-xs"
            onClick={() => onUse(it.prompt)}
          >
            <span className="text-subtle">
              {it.mode} · seed {it.seed} · {it.checkpoint.split("/").pop()}
            </span>
            <span className="mt-1 block text-fg">{it.prompt.slice(0, 220)}</span>
          </button>
        ))}
        {jobs.slice(0, 24).map((j) => (
              <div key={j.id} className="flex gap-2 rounded-xl bg-raised p-2">
                {j.resultDataUrl ? (
                  <button
                    type="button"
                    className="size-16 shrink-0 overflow-hidden rounded-lg bg-surface"
                    title="Enlarge"
                    onClick={() => onZoom(j.resultDataUrl!, j.resultName || `seed ${j.seed}`)}
                  >
                    {j.resultKind === "video" ? (
                      <video src={j.resultDataUrl} muted className="size-full object-cover" />
                    ) : (
                      <img src={j.resultDataUrl} alt="" className="size-full object-cover" />
                    )}
                  </button>
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-surface text-[10px] text-subtle">
                    {j.status}
                  </span>
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs"
                  onClick={() => onUse(j.expandedPrompt || j.prompt)}
                >
                  <span className="text-subtle">
                    {j.mode} · seed {j.seed} · {(j.checkpoint || "").split("/").pop()}
                  </span>
                  <span className="mt-1 block text-fg">{(j.expandedPrompt || j.prompt).slice(0, 220)}</span>
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}

function ErrorsPanel() {
  const logs = useForge((s) => s.logs);
  const comfy = useForge((s) => s.comfy);
  const jobs = useForge((s) => s.jobs);
  const settings = useForge((s) => s.settings);
  const text = [
    `time ${new Date().toISOString()}`,
    `comfy ${settings.baseUrl} ok=${comfy?.ok} ckpt=${comfy?.checkpoints.length ?? 0} lora=${comfy?.loras.length ?? 0}`,
    `checkpoint ${settings.checkpoint || "(none)"}`,
    `writer ${settings.llmUrl} ${settings.llmModel}`,
    ...jobs.slice(0, 5).map((j) => `job ${j.status} ${j.checkpoint || ""} ${j.error || j.log || ""}`),
    ...logs.map((l) => `${new Date(l.at).toLocaleTimeString()} [${l.level}] ${l.source}: ${l.message}`),
  ].join("\n");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted">Every Comfy / writer / generate failure lands here.</p>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => useForge.getState().clearLogs()}>
          Clear
        </Button>
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-raised p-3 font-mono text-xs text-fg">
        {`Comfy: ${comfy?.ok ? "up" : "down"} · ${comfy?.checkpoints.length ?? 0} checkpoints
${comfy?.message || ""}
Checkpoint: ${settings.checkpoint || "(none)"}
Writer: ${settings.llmUrl} · ${settings.llmModel}`}
      </pre>
      <ul className="space-y-2">
        {logs.length ? (
          logs.map((l) => (
            <li
              key={l.id}
              className={cn(
                "rounded-xl px-3 py-2 font-mono text-xs",
                l.level === "error" ? "bg-danger/15 text-danger" : l.level === "warn" ? "bg-warn/15 text-fg" : "bg-raised text-muted",
              )}
            >
              <p className="text-[10px] uppercase tracking-wide">
                {new Date(l.at).toLocaleTimeString()} · {l.source}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-fg">{l.message}</p>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">No errors yet. Generate or Write prompt — failures show here.</li>
        )}
      </ul>
    </div>
  );
}

function featuredWildcards(names: string[]) {
  const prefer =
    /quality|hair|clothing|camera|pose|background|girl|monster|emotion|body|sex|outfit|style|skin|eye/i;
  const top = names.filter((n) => prefer.test(n) && !n.includes("/"));
  const rest = names.filter((n) => !n.includes("/"));
  return [...new Set([...top, ...rest])].slice(0, 28);
}

function WildcardCard({
  diskNames,
  files,
  onInsert,
  onRoll,
  expanded,
}: {
  diskNames: string[];
  files: { name: string; lines: string[] }[];
  onInsert: (name: string) => void;
  onRoll: () => void;
  expanded: string;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState("");
  const [peek, setPeek] = useState<{ total: number; preview: string[] } | null>(null);
  const names = useMemo(() => {
    const set = new Set([...diskNames, ...files.map((f) => f.name)]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [diskNames, files]);
  const needle = q.trim().toLowerCase();
  const shown = (needle ? names.filter((n) => n.toLowerCase().includes(needle)) : featuredWildcards(names).concat(names))
    .filter((n, i, a) => a.indexOf(n) === i)
    .slice(0, 80);

  useEffect(() => {
    if (!picked) {
      setPeek(null);
      return;
    }
    const local = files.find((f) => f.name === picked);
    if (local?.lines.length) {
      const lines = local.lines.filter((l) => l.trim() && !l.startsWith("#"));
      setPeek({ total: lines.length, preview: lines.slice(0, 16) });
      return;
    }
    let stop = false;
    peekWildcardFn({ data: { name: picked } })
      .then((r) => {
        if (!stop) setPeek({ total: r.total, preview: r.preview });
      })
      .catch(() => {
        if (!stop) setPeek({ total: 0, preview: [] });
      });
    return () => {
      stop = true;
    };
  }, [picked, files]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        These are .txt lists in ComfyUI/wildcards. Tap a name, then tap a line — that line is written into the prompt as real words.
      </p>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${names.length} lists — hair, clothing, camera, girl…`}
      />
      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-auto">
        {shown.map((n) => (
          <button
            key={n}
            type="button"
            className={cn(
              "h-9 max-w-full truncate rounded-full px-3 text-xs",
              n === picked ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
            onClick={() => onInsert(n)}
          >
            __{n}__
          </button>
        ))}
      </div>
      {picked ? (
        <div className="rounded-xl bg-raised p-3">
          <p className="font-mono text-sm text-fg">
            __{picked}__ · {peek?.total ?? "…"} lines
          </p>
          <pre className="mt-2 max-h-32 overflow-auto text-[11px] leading-snug text-muted whitespace-pre-wrap">
            {(peek?.preview ?? []).join("\n") || "No lines in this file."}
          </pre>
          <Button className="mt-3 w-full" onClick={() => onInsert(picked)}>
            Insert __{picked}__
          </Button>
        </div>
      ) : null}
      <Button variant="secondary" className="w-full" onClick={onRoll}>
        Bake roll into the prompt
      </Button>
      <p className="text-xs text-subtle">Preview: {expanded || "type __hair__ then generate"}</p>
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
  const [q, setQ] = useState("");
  const [loraFam, setLoraFam] = useState<"all" | "sd15" | "sdxl" | "flux" | "wan">("all");
  const comfy = useForge((s) => s.comfy);
  const needle = q.trim().toLowerCase();
  const shown = loras
    .filter((l) => {
      if (loraFam !== "all") {
        const lane = guessLoraLane(l.filename);
        if (loraFam === "sdxl") {
          if (!["sdxl", "illustrious", "pony", "any"].includes(lane)) return false;
        } else if (lane !== loraFam) return false;
      }
      if (!needle) return true;
      return l.name.toLowerCase().includes(needle) || l.filename.toLowerCase().includes(needle);
    })
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Toggle at most two. Type the name in the prompt. Generate skips 1.5 LoRAs on XL mixes
        (that is the “lora key not loaded” spam). Pony stays off Illustrious. WAN only on video.
      </p>
      <div className="flex flex-wrap gap-1">
        {(["all", "sdxl", "sd15", "flux", "wan"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              loraFam === f ? "bg-accent text-accent-fg" : "bg-bg text-muted",
            )}
            onClick={() => setLoraFam(f)}
          >
            {f === "all" ? `All ${loras.length}` : f === "sd15" ? "1.5" : f === "sdxl" ? "XL" : f === "wan" ? "WAN" : "Flux"}
          </button>
        ))}
      </div>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          for (const l of loras.filter((x) => x.enabled)) {
            useForge.getState().upsertLora({ ...l, enabled: false });
          }
          toast.success("All LoRAs off");
        }}
      >
        All LoRAs off
      </Button>
      {blocked.length > 0 && (
        <p className="text-xs text-warn">
          On but wrong family for this mix ({family}): {blocked.map((b) => b.name).join(", ")}
        </p>
      )}
      <Input
        placeholder="Search LoRAs — mara, alice, ninja…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <p className="text-xs text-subtle">
        {loras.filter((l) => l.enabled).length} on · showing {shown.length} of {loras.length}
        {comfy?.loras?.length ? ` · disk ${comfy.loras.length}` : " · none from disk yet"}
      </p>
      {shown.map((l) => (
        <div key={l.id} className="rounded-xl bg-raised p-3 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2">
            <Switch
              checked={l.enabled}
              onCheckedChange={(v) => {
                const words =
                  l.triggerWords.length > 0
                    ? l.triggerWords
                    : [loraTriggerFromFilename(l.filename)].filter(Boolean);
                useForge.getState().upsertLora({ ...l, enabled: v, triggerWords: words });
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{l.name}</p>
              <p className="truncate text-[11px] text-subtle">
                {l.filename} · {guessLoraLane(l.filename)}
              </p>
            </div>
          </div>
          {l.enabled ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted">
                Strength {l.unetStrength.toFixed(2)}
                <Slider
                  className="mt-1"
                  min={0}
                  max={1.2}
                  step={0.05}
                  value={[l.unetStrength]}
                  onValueChange={(v) =>
                    useForge.getState().upsertLora({
                      ...l,
                      unetStrength: v[0] ?? l.unetStrength,
                      clipStrength: v[0] ?? l.clipStrength,
                    })
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      ))}
      {loras.length === 0 ? (
        <p className="text-sm text-warn">
          No LoRA files yet. They live in ~/comfy/ComfyUI/models/loras. Restart Forge after you add
          some.
        </p>
      ) : null}
    </div>
  );
}

function GraphCard({
  job,
  onDownload,
}: {
  job: Job | null;
  onDownload: (kind: "ui" | "api" | "png") => void;
}) {
  const nodes = job ? Object.keys(job.apiWorkflow).length : 0;
  return (
    <div>
      {job ? (
        <>
          <p className="text-sm text-muted">
            {nodes} nodes · {job.checkpoint || MODE_META[job.mode].label} · seed {job.seed}
          </p>
          <p className="mt-2 text-sm">{job.expandedPrompt}</p>
          <ScrollArea className="mt-3 h-40 rounded-lg bg-raised p-2">
            <pre className="font-mono text-[10px] leading-relaxed text-subtle">
              {JSON.stringify(job.apiWorkflow, null, 2).slice(0, 2000)}
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
        <p className="text-sm text-muted">Generate once. Graph uses the checkpoint in the header.</p>
      )}
    </div>
  );
}

function ScanBoxes({
  boxes,
  show,
}: {
  boxes: { id: string; label: string; confidence: number; x: number; y: number; w: number; h: number }[];
  show: boolean;
}) {
  if (!show || !boxes.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map((b) => (
        <div
          key={b.id}
          className="absolute border-2 border-signal"
          style={{
            left: `${Math.max(0, Math.min(1, b.x)) * 100}%`,
            top: `${Math.max(0, Math.min(1, b.y)) * 100}%`,
            width: `${Math.max(0.04, Math.min(1, b.w)) * 100}%`,
            height: `${Math.max(0.04, Math.min(1, b.h)) * 100}%`,
          }}
        >
          <span
            className={cn(
              "absolute left-0 whitespace-nowrap bg-signal px-1 text-[10px] font-medium text-black",
              b.y < 0.08 ? "top-0" : "-top-5",
            )}
          >
            {b.label} {pct(b.confidence)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetectorCard({
  scan,
  src,
  showBoxes,
  onToggleBoxes,
  onScan,
  busy,
  onUseTags,
}: {
  scan: Job["scan"] | null;
  src?: string;
  showBoxes: boolean;
  onToggleBoxes: (v: boolean) => void;
  onScan: () => void;
  busy: boolean;
  onUseTags: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={onScan} disabled={busy}>
        <ScanSearch />
        Scan
      </Button>
      {src ? (
        <div className="relative mx-auto inline-block max-h-56 max-w-full overflow-hidden rounded-lg bg-raised">
          <img src={src} alt="" className="max-h-56 w-auto max-w-full object-contain" />
          <ScanBoxes boxes={scan?.boxes ?? []} show={showBoxes} />
        </div>
      ) : null}
      {scan ? (
        <>
          <p className="text-sm leading-relaxed">{scan.summary}</p>
          {scan.boxes.length ? (
            <p className="text-xs text-muted">
              {scan.boxes.length} box{scan.boxes.length === 1 ? "" : "es"} on the still. Toggle Boxes if you do not see the green frames.
            </p>
          ) : (
            <p className="text-xs text-warn">No boxes yet. Tap Scan with a still on stage.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {scan.tags.map((t) => (
              <Badge key={t.tag}>
                {t.tag}
                <span className="ml-1 text-subtle">{pct(t.confidence)}</span>
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="boxes">Boxes</Label>
            <Switch id="boxes" checked={showBoxes} onCheckedChange={onToggleBoxes} />
          </div>
          <Button variant="outline" className="w-full" onClick={onUseTags}>
            Send tags to prompt
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">Local scanner. Not a cloud model.</p>
      )}
    </div>
  );
}

function SettingsForm({
  urls,
  llm,
  onOpen,
}: {
  urls: string[];
  llm: { ok: boolean; models: string[]; message: string };
  onOpen: (s: "story" | "history" | "graph") => void;
}) {
  const settings = useForge((s) => s.settings);
  const nsfwMode = useForge((s) => s.nsfwMode);
  const comfy = useForge((s) => s.comfy);
  const patch = (p: Partial<typeof settings>) => useForge.getState().setSettings(p);
  const primary = urls[0] ?? "http://YOUR-PC-IP:8080";
  return (
    <div className="space-y-4">
      <div>
        <Label>Content</Label>
        <p className="mt-1 text-xs text-subtle">SFW fills looks and place only. NSFW fills explicit uncensored for people. Animals stay non-porn unless you type it. Underage always stays in the negative.</p>
        <div className="mt-2 flex rounded-full bg-raised p-0.5">
          <button
            type="button"
            className={cn("h-9 flex-1 rounded-full text-sm", !nsfwMode ? "bg-bg text-fg" : "text-subtle")}
            onClick={() => useForge.getState().setNsfwMode(false)}
          >
            SFW
          </button>
          <button
            type="button"
            className={cn("h-9 flex-1 rounded-full text-sm", nsfwMode ? "bg-accent text-accent-fg" : "text-subtle")}
            onClick={() => useForge.getState().setNsfwMode(true)}
          >
            NSFW
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onOpen("story")}>
          Story
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onOpen("history")}>
          History
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onOpen("graph")}>
          Graph
        </Button>
      </div>
      <p className="text-sm text-muted">
        Stills use a <span className="text-fg">checkpoint</span> from ComfyUI. That file is node 1
        on every still graph. Flux UNET stack is optional if you actually split Flux that way.
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
        <Label>Local writer (Ollama)</Label>
        <p className="mt-1 text-xs text-subtle">
          {llm.message}. Stays on your LAN. Write prompt uses this when it is up.
        </p>
        <Input
          className="mt-1"
          value={settings.llmUrl || "http://127.0.0.1:11434"}
          onChange={(e) => patch({ llmUrl: e.target.value })}
          placeholder="http://127.0.0.1:11434 or http://SERVER-IP:11434"
        />
        <select
          className="mt-2 h-11 w-full rounded-lg bg-raised px-3 text-sm"
          value={settings.llmModel || "dolphin-llama3"}
          onChange={(e) => patch({ llmModel: e.target.value })}
        >
          {[settings.llmModel, ...llm.models]
            .filter((v, i, a) => v && a.indexOf(v) === i)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          {!llm.models.length ? (
            <option value="huihui_ai/qwen2.5-abliterate:3b">huihui_ai/qwen2.5-abliterate:3b (pull first)</option>
          ) : null}
        </select>
      </div>
      <div>
        <Label>Still loader</Label>
        <div className="mt-2 flex gap-2">
          <Button
            variant={settings.stillLoader === "checkpoint" ? "default" : "secondary"}
            size="sm"
            onClick={() => patch({ stillLoader: "checkpoint" })}
          >
            Checkpoint
          </Button>
          <Button
            variant={settings.stillLoader === "flux-unet" ? "default" : "secondary"}
            size="sm"
            onClick={() => patch({ stillLoader: "flux-unet" })}
          >
            Flux UNET
          </Button>
        </div>
      </div>
      <Field
        label="Checkpoint"
        value={settings.checkpoint}
        onChange={(v) => patch({ checkpoint: v, sdxlCheckpoint: v })}
        options={comfy?.checkpoints}
      />
      <Field label="Flux UNET" value={settings.fluxUnet} onChange={(v) => patch({ fluxUnet: v })} options={comfy?.unets} />
      <Field label="WAN UNET" value={settings.wanUnet} onChange={(v) => patch({ wanUnet: v })} options={comfy?.unets} />
      <Field
        label="WAN LOW (2.2 pair)"
        value={settings.wanUnetLow || ""}
        onChange={(v) => patch({ wanUnetLow: v })}
        options={comfy?.unets}
      />
      <div>
        <Label>Steps {settings.steps}</Label>
        <Slider
          className="mt-2"
          min={4}
          max={50}
          step={1}
          value={[settings.steps]}
          onValueChange={(v) => patch({ steps: v[0] ?? settings.steps })}
        />
      </div>
      <div>
        <Label>CFG {settings.cfg}</Label>
        <Slider
          className="mt-2"
          min={1}
          max={12}
          step={0.5}
          value={[settings.cfg]}
          onValueChange={(v) => patch({ cfg: v[0] ?? settings.cfg })}
        />
      </div>
      <div>
        <Label>Batch {settings.batchSize || 1}</Label>
        <Slider
          className="mt-2"
          min={1}
          max={8}
          step={1}
          value={[settings.batchSize || 1]}
          onValueChange={(v) => patch({ batchSize: v[0] ?? 1 })}
        />
        <p className="mt-1 text-xs text-subtle">How many stills per Generate (text-to-image).</p>
      </div>
      {comfy?.ok ? (
        <p className="text-xs text-signal">
          {comfy.checkpoints.length} checkpoints · {comfy.loras.length} LoRAs · {comfy.unets.length}{" "}
          UNETs
        </p>
      ) : (
        <p className="text-xs text-warn">{comfy?.message ?? "ComfyUI not connected"}</p>
      )}
      <div>
        <p className="text-sm font-medium">LAN</p>
        <p className="mt-1 text-xs text-muted">
          Laptop / phone (full controls): {urls[0] ?? "http://PC-LAN-IP:8080"}
          <br />
          This PC monitor (picture only):{" "}
          <a className="text-fg underline" href="/stage">
            http://127.0.0.1:8080/stage
          </a>
        </p>
        <div className="mt-3 flex items-start gap-3">
          <QrMark value={primary} />
          <div className="space-y-1">
            {urls.length ? (
              urls.map((u) => (
                <p key={u} className="break-all font-mono text-xs">
                  {u}
                </p>
              ))
            ) : (
              <p className="font-mono text-xs text-subtle">{primary}</p>
            )}
          </div>
        </div>
      </div>
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
          value={options.includes(value) ? value : value || options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {!options.includes(value) && value ? <option value={value}>{value}</option> : null}
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
  return c.toDataURL("image/png");
}
