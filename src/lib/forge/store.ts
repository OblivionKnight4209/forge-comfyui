import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isLanRemote } from "./live-room";
import {
  ASPECTS,
  DEFAULT_COMFY,
  guessArch,
  guessLoraFamily,
  MODE_META,
  settingsForCheckpoint,
  settingsForFamily,
  negativeForCheckpoint,
  shouldReplaceNegative,
  wanFrameCount,
  wanFpsForDuration,
  pickPlayUnet,
  pickWanClip,
  pickWanVae,
  pairWanUnets,
  sameStill,
  isNotALora,
  isCharacterLora,
  characterLabel,
  ckptBase,
  type Aspect,
  type ComfySettings,
  type ComfyStatus,
  type Job,
  type LoraEntry,
  type MediaRef,
  type Mode,
  type ScanResult,
  type WildcardFile,
  type LogEntry,
  type ThemeId,
} from "./types";
import { DEFAULT_WILDCARDS } from "./wildcards";

export const DEFAULT_LORAS: LoraEntry[] = [];

type ForgeState = {
  mode: Mode;
  prompt: string;
  editRemove: string;
  editAdd: string;
  editChange: string;
  refPrompt: string;
  negative: string;
  negLocked: boolean;
  seed: number;
  seedLocked: boolean;
  promptRoll: "normal" | "random";
  aspect: Aspect;
  denoise: number;
  duration: 6 | 10 | 15;
  soundOn: boolean;
  showBoxes: boolean;
  media: MediaRef[];
  loras: LoraEntry[];
  loraPrefs: Record<string, { enabled: boolean; unetStrength: number; clipStrength: number; triggerWords: string[] }>;
  wildcards: WildcardFile[];
  jobs: Job[];
  activeJobId: string | null;
  jobCount: number;
  blankStage: boolean;
  settings: ComfySettings;
  comfy: ComfyStatus | null;
  lanUrls: string[];
  liveScan: ScanResult | null;
  expandedPreview: string;
  logs: LogEntry[];
  theme: ThemeId;
  ckptStyle: import("./types").CkptStyle;
  artWrap: string;
  qualityPick: string[];
  nsfwMode: boolean;
  setMode: (mode: Mode) => void;
  setPrompt: (prompt: string) => void;
  setEditRemove: (text: string) => void;
  setEditAdd: (text: string) => void;
  setEditChange: (text: string) => void;
  setRefPrompt: (text: string) => void;
  setNegative: (negative: string, opts?: { force?: boolean }) => void;
  setNegLocked: (locked: boolean) => void;
  setSeed: (seed: number) => void;
  toggleSeedLock: () => void;
  setPromptRoll: (roll: "normal" | "random") => void;
  rollSeed: () => void;
  setAspect: (aspect: Aspect) => void;
  setDenoise: (denoise: number) => void;
  setDuration: (duration: 6 | 10 | 15) => void;
  setSoundOn: (on: boolean) => void;
  setShowBoxes: (show: boolean) => void;
  addMedia: (items: MediaRef[]) => void;
  setMedia: (items: MediaRef[]) => void;
  patchMedia: (id: string, patch: Partial<MediaRef>) => void;
  removeMedia: (id: string) => void;
  clearMedia: () => void;
  upsertLora: (lora: LoraEntry) => void;
  removeLora: (id: string) => void;
  setWildcards: (wildcards: WildcardFile[]) => void;
  upsertWildcard: (file: WildcardFile) => void;
  removeWildcard: (name: string) => void;
  addJob: (job: Job) => void;
  ingestJobs: (jobs: Job[]) => void;
  patchJob: (id: string, patch: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearJobs: () => void;
  resetJobCount: () => void;
  setActiveJob: (id: string | null) => void;
  startNew: () => void;
  setSettings: (patch: Partial<ComfySettings>) => void;
  setComfy: (status: ComfyStatus | null) => void;
  applyComfy: (status: ComfyStatus) => void;
  setLanUrls: (urls: string[]) => void;
  setLiveScan: (scan: ScanResult | null) => void;
  setExpandedPreview: (text: string) => void;
  pushLog: (entry: Omit<LogEntry, "id" | "at">) => void;
  clearLogs: () => void;
  setTheme: (theme: ThemeId) => void;
  setCkptStyle: (style: import("./types").CkptStyle) => void;
  setArtWrap: (id: string) => void;
  setQualityPick: (ids: string[]) => void;
  toggleQuality: (id: string) => void;
  setNsfwMode: (on: boolean) => void;
};

function pickExisting(current: string, list: string[]) {
  if (!list.length) return current;
  if (!current) return list[0] ?? "";
  if (list.includes(current)) return current;
  const base = current.replace(/\\/g, "/").split("/").pop() || current;
  const lower = base.toLowerCase();
  return (
    list.find((a) => a === base) ||
    list.find((a) => (a.replace(/\\/g, "/").split("/").pop() || "").toLowerCase() === lower) ||
    current
  );
}

export const useForge = create<ForgeState>()(
  persist(
    (set, get) => ({
      mode: "t2i",
      prompt: "",
      editRemove: "",
      editAdd: "",
      editChange: "",
      refPrompt: "",
      negative: "",
      negLocked: false,
      seed: Math.floor(Math.random() * 1_000_000_000),
      seedLocked: false,
      promptRoll: "normal",
      aspect: "1:1",
      denoise: 0.65,
      duration: 6,
      soundOn: true,
      showBoxes: true,
      media: [],
      loras: DEFAULT_LORAS,
      loraPrefs: {},
      wildcards: DEFAULT_WILDCARDS,
      jobs: [],
      activeJobId: null,
      jobCount: 0,
      blankStage: false,
      settings: DEFAULT_COMFY,
      comfy: null,
      lanUrls: [],
      liveScan: null,
      expandedPreview: "",
      logs: [],
      theme: "void",
      ckptStyle: "all",
      artWrap: "none",
      qualityPick: [],
      nsfwMode: true,
      setMode: (mode) => {
        const cur = get();
        const meta = MODE_META[mode];
        let media = cur.media;
        if ((meta.needsImage || meta.needsVideo) && media.length === 0) {
          const job = cur.jobs.find((j) => j.id === cur.activeJobId);
          if (job?.resultDataUrl) {
            media = [
              {
                id: "from-last",
                kind: job.resultKind,
                name: job.resultKind === "video" ? "last.mp4" : "last.png",
                dataUrl: job.resultDataUrl,
              },
            ];
          }
        }
        set({
          mode,
          media,
          denoise:
            mode === "i2i"
              ? cur.denoise >= 0.6
                ? 0.42
                : cur.denoise
              : mode === "v2v"
                ? cur.denoise === 1
                  ? 0.6
                  : cur.denoise
                : cur.denoise,
        });
      },
      setPrompt: (prompt) => set({ prompt }),
      setEditRemove: (editRemove) => set({ editRemove }),
      setEditAdd: (editAdd) => set({ editAdd }),
      setEditChange: (editChange) => set({ editChange }),
      setRefPrompt: (refPrompt) => set({ refPrompt }),
      setNegative: (negative, opts) => {
        if (get().negLocked && !opts?.force) return;
        set({ negative });
      },
      setNegLocked: (negLocked) => set({ negLocked }),
      setSeed: (seed) => set({ seed }),
      toggleSeedLock: () => set({ seedLocked: !get().seedLocked }),
      setPromptRoll: (promptRoll) => set({ promptRoll }),
      rollSeed: () => set({ seed: Math.floor(Math.random() * 1_000_000_000) }),
      setAspect: (aspect) => set({ aspect: ASPECTS.includes(aspect) ? aspect : "1:1" }),
      setDenoise: (denoise) => set({ denoise }),
      setDuration: (duration) => {
        set({
          duration,
          settings: {
            ...get().settings,
            videoFrames: wanFrameCount(duration),
            videoFps: wanFpsForDuration(duration),
            steps: 16,
            batchSize: 1,
          },
        });
      },
      setSoundOn: (soundOn) => set({ soundOn }),
      setShowBoxes: (showBoxes) => set({ showBoxes }),
      addMedia: (items) => {
        const cur = get().media;
        const extra = items.filter((n) => !cur.some((m) => sameStill(m, n)));
        set({ media: [...cur, ...extra].slice(0, 5) });
      },
      setMedia: (items) => set({ media: items.slice(0, 5), activeJobId: null }),
      patchMedia: (id, patch) =>
        set({ media: get().media.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      removeMedia: (id) => set({ media: get().media.filter((m) => m.id !== id) }),
      clearMedia: () => set({ media: [] }),
      upsertLora: (lora) => {
        const list = get().loras;
        const i = list.findIndex((l) => l.id === lora.id || l.filename === lora.filename);
        if (i === -1) set({ loras: [...list, lora] });
        else set({ loras: list.map((l, idx) => (idx === i ? { ...l, ...lora, id: l.id } : l)) });
        const cur = get().loras.find((l) => l.filename === lora.filename) || lora;
        set({
          loraPrefs: {
            ...get().loraPrefs,
            [cur.filename]: {
              enabled: cur.enabled,
              unetStrength: cur.unetStrength,
              clipStrength: cur.clipStrength,
              triggerWords: cur.triggerWords,
            },
          },
        });
      },
      removeLora: (id) => set({ loras: get().loras.filter((l) => l.id !== id) }),
      setWildcards: (wildcards) => set({ wildcards }),
      upsertWildcard: (file) => {
        const list = get().wildcards.filter((w) => w.name !== file.name);
        set({ wildcards: [...list, file].sort((a, b) => a.name.localeCompare(b.name)) });
      },
      removeWildcard: (name) =>
        set({ wildcards: get().wildcards.filter((w) => w.name !== name) }),
      addJob: (job) =>
        set((s) => ({
          jobs: [job, ...s.jobs].slice(0, 40),
          jobCount: (s.jobCount || 0) + 1,
          blankStage: false,
          activeJobId:
            MODE_META[s.mode].group === MODE_META[job.mode].group ? job.id : s.activeJobId,
        })),
      ingestJobs: (jobs) => {
        const prev = get().jobs;
        if (
          prev.length === jobs.length &&
          prev.every(
            (p, i) =>
              p.id === jobs[i]?.id &&
              p.status === jobs[i]?.status &&
              p.progress === jobs[i]?.progress &&
              p.error === jobs[i]?.error,
          )
        ) {
          return;
        }
        const cur = get().activeJobId;
        const blank = get().blankStage;
        const running = jobs.some((j) => j.status === "running" || j.status === "queued");
        set({
          jobs,
          activeJobId: blank
            ? null
            : running && cur && jobs.some((j) => j.id === cur)
              ? cur
              : cur && jobs.some((j) => j.id === cur)
                ? cur
                : (jobs[0]?.id ?? cur),
        });
      },
      patchJob: (id, patch) =>
        set({
          jobs: get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        }),
      removeJob: (id) => {
        const jobs = get().jobs.filter((j) => j.id !== id);
        const active = get().activeJobId === id ? (jobs[0]?.id ?? null) : get().activeJobId;
        set({ jobs, activeJobId: active });
      },
      clearJobs: () => set({ jobs: [], activeJobId: null, liveScan: null }),
      resetJobCount: () => set({ jobCount: 0 }),
      setActiveJob: (id) => set({ activeJobId: id, blankStage: id ? false : get().blankStage }),
      startNew: () =>
        set({
          blankStage: true,
          activeJobId: null,
          media: [],
          prompt: "",
          refPrompt: "",
          editRemove: "",
          editAdd: "",
          editChange: "",
          liveScan: null,
          expandedPreview: "",
        }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setComfy: (comfy) => set({ comfy }),
      applyComfy: (status) => {
        set({ comfy: status });
        const have = new Map(get().loras.map((l) => [l.filename, l]));
        const prefs = get().loraPrefs;
        if (status.loras.length) {
          const merged: LoraEntry[] = status.loras
            .filter((filename) => !isNotALora(filename))
            .map((filename) => {
            const prev = have.get(filename);
            const pref = prefs[filename];
            if (prev) {
              return {
                ...prev,
                enabled: pref?.enabled ?? prev.enabled,
                unetStrength: pref?.unetStrength ?? prev.unetStrength,
                clipStrength: pref?.clipStrength ?? prev.clipStrength,
                triggerWords: pref?.triggerWords ?? prev.triggerWords,
              };
            }
            return {
              id: `comfy-${filename}`,
              filename,
              name: isCharacterLora(filename)
                ? characterLabel(filename)
                : filename.replace(/\.safetensors$/i, "").replace(/.*\//, ""),
              family: (() => {
                const lane = guessLoraFamily(filename);
                return lane === "any" ? "sdxl" : lane;
              })(),
              triggerWords: pref?.triggerWords ?? [],
              unetStrength: pref?.unetStrength ?? 0.8,
              clipStrength: pref?.clipStrength ?? 0.8,
              enabled: pref?.enabled ?? false,
            };
          });
          set({ loras: merged });
        }
        const cur = get().settings;
        const checkpoint = pickExisting(cur.checkpoint || cur.sdxlCheckpoint, status.checkpoints);
        if (status.checkpoints.length && checkpoint) {
          const same =
            ckptBase(checkpoint).toLowerCase() ===
            ckptBase(cur.checkpoint || cur.sdxlCheckpoint || "").toLowerCase();
          if (!same && !(cur.checkpoint || cur.sdxlCheckpoint)) {
            const preset = settingsForCheckpoint(checkpoint);
            set({
              settings: {
                ...cur,
                ...preset,
                checkpoint,
                sdxlCheckpoint: checkpoint,
                stillLoader: "checkpoint",
              },
            });
          } else if (!same) {
            set({
              settings: {
                ...get().settings,
                checkpoint,
                sdxlCheckpoint: checkpoint,
              },
            });
          }
        }
        if (!status.ok) return;
        const fluxUnet =
          pickExisting(
            cur.fluxUnet,
            status.unets.filter((u) => /flux/i.test(u)),
          ) || pickExisting(cur.fluxUnet, status.unets);
        const wanUnet = pickPlayUnet(cur.wanUnet, status.unets);
        const pair = pairWanUnets(wanUnet, status.unets);
        const wanPicked = pair.error ? wanUnet : pair.high || pair.single || wanUnet;
        const wanUnetLow = pair.error ? "" : pair.low;
        const fluxVae = pickExisting(cur.fluxVae, status.vaes);
        const wanVae =
          pickWanVae(wanPicked || cur.wanUnet, status.vaes, cur.wanVae) ||
          pickExisting(
            cur.wanVae,
            status.vaes.filter((v) => /wan/i.test(v) && !/2[\s._-]*2/.test(v.toLowerCase())),
          );
        const clipL =
          pickExisting(
            cur.fluxClipL,
            status.clips.filter((c) => /clip_l/i.test(c)),
          ) || pickExisting(cur.fluxClipL, status.clips);
        const t5 =
          pickExisting(
            cur.fluxT5,
            status.clips.filter((c) => /t5/i.test(c)),
          ) || pickExisting(cur.fluxT5, status.clips);
        const wanClip = pickWanClip(status.clips, cur.wanClip);
        const live = get().settings;
        set({
          settings: {
            ...live,
            clipSkip: live.clipSkip ?? 2,
            hires: live.hires ?? false,
            fluxUnet,
            fluxVae,
            fluxClipL: clipL,
            fluxT5: t5,
            wanUnet: wanPicked || live.wanUnet,
            wanUnetLow,
            wanVae,
            wanClip,
            checkpoint: live.checkpoint || checkpoint,
            sdxlCheckpoint: live.checkpoint || checkpoint,
          },
        });
      },
      setLanUrls: (lanUrls) => set({ lanUrls }),
      setLiveScan: (liveScan) => set({ liveScan }),
      setExpandedPreview: (expandedPreview) => set({ expandedPreview }),
      pushLog: (entry) => {
        const logs = get().logs;
        const last = logs[0];
        if (
          last &&
          last.source === entry.source &&
          last.message === entry.message &&
          Date.now() - last.at < 15000
        ) {
          return;
        }
        set({
          logs: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              at: Date.now(),
              ...entry,
              message: entry.message.slice(0, 4000),
            },
            ...logs,
          ].slice(0, 40),
        });
      },
      clearLogs: () => set({ logs: [] }),
      setTheme: (theme) => set({ theme }),
      setCkptStyle: (ckptStyle) => set({ ckptStyle }),
      setArtWrap: (artWrap) => set({ artWrap }),
      setQualityPick: (qualityPick) => set({ qualityPick }),
      toggleQuality: (id) => {
        const cur = get().qualityPick ?? [];
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        const hires = next.includes("4k") ? true : get().settings.hires;
        set({
          qualityPick: next,
          settings: { ...get().settings, hires: next.includes("4k") ? true : hires },
          artWrap: next.includes("real") && get().artWrap === "none" ? "photo" : get().artWrap,
        });
      },
      setNsfwMode: (nsfwMode) => set({ nsfwMode }),
    }),
    {
      name: "forge-studio-v48",
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (isLanRemote()) return null;
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (isLanRemote()) {
            try {
              localStorage.removeItem(name);
            } catch {
              /* private mode */
            }
            return;
          }
          localStorage.setItem(name, value);
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
        },
      })),
      partialize: (s) => ({
        mode: s.mode,
        prompt: s.prompt,
        editRemove: s.editRemove,
        editAdd: s.editAdd,
        editChange: s.editChange,
        refPrompt: s.refPrompt,
        negative: s.negative,
        negLocked: s.negLocked,
        seed: s.seed,
        seedLocked: s.seedLocked,
        promptRoll: s.promptRoll,
        aspect: s.aspect,
        denoise: s.denoise,
        duration: s.duration,
        soundOn: s.soundOn,
        showBoxes: s.showBoxes,
        loraPrefs: s.loraPrefs,
        wildcards: s.wildcards,
        settings: s.settings,
        theme: s.theme,
        ckptStyle: s.ckptStyle,
        artWrap: s.artWrap,
        qualityPick: s.qualityPick,
        blankStage: s.blankStage,
        jobCount: s.jobCount,
      }),
      onRehydrateStorage: () => (s) => {
        if (!s) return;
        if (s.artWrap === "comic" || s.artWrap === "manga") s.artWrap = "none";
        s.qualityPick = (s.qualityPick || []).filter((id) => id !== "splash");
      },
    },
  ),
);
