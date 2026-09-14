import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ASPECTS,
  DEFAULT_COMFY,
  type Aspect,
  type ComfySettings,
  type ComfyStatus,
  type Job,
  type LoraEntry,
  type MediaRef,
  type Mode,
  type ScanResult,
  type WildcardFile,
} from "./types";
import { DEFAULT_WILDCARDS } from "./wildcards";

export const DEFAULT_LORAS: LoraEntry[] = [
  {
    id: "detail",
    filename: "add_detail.safetensors",
    name: "Add detail",
    family: "flux",
    triggerWords: [],
    unetStrength: 0.6,
    clipStrength: 0.6,
    enabled: false,
  },
  {
    id: "portrait",
    filename: "flux_portrait.safetensors",
    name: "Portrait",
    family: "flux",
    triggerWords: ["portrait"],
    unetStrength: 0.75,
    clipStrength: 0.7,
    enabled: false,
  },
];

type ForgeState = {
  mode: Mode;
  prompt: string;
  negative: string;
  seed: number;
  seedLocked: boolean;
  aspect: Aspect;
  denoise: number;
  duration: 6 | 10 | 15;
  showBoxes: boolean;
  media: MediaRef[];
  loras: LoraEntry[];
  wildcards: WildcardFile[];
  jobs: Job[];
  activeJobId: string | null;
  settings: ComfySettings;
  comfy: ComfyStatus | null;
  lanUrls: string[];
  liveScan: ScanResult | null;
  expandedPreview: string;
  setMode: (mode: Mode) => void;
  setPrompt: (prompt: string) => void;
  setNegative: (negative: string) => void;
  setSeed: (seed: number) => void;
  toggleSeedLock: () => void;
  rollSeed: () => void;
  setAspect: (aspect: Aspect) => void;
  setDenoise: (denoise: number) => void;
  setDuration: (duration: 6 | 10 | 15) => void;
  setShowBoxes: (show: boolean) => void;
  addMedia: (items: MediaRef[]) => void;
  removeMedia: (id: string) => void;
  clearMedia: () => void;
  upsertLora: (lora: LoraEntry) => void;
  removeLora: (id: string) => void;
  setWildcards: (wildcards: WildcardFile[]) => void;
  upsertWildcard: (file: WildcardFile) => void;
  removeWildcard: (name: string) => void;
  addJob: (job: Job) => void;
  patchJob: (id: string, patch: Partial<Job>) => void;
  setActiveJob: (id: string | null) => void;
  setSettings: (patch: Partial<ComfySettings>) => void;
  setComfy: (status: ComfyStatus | null) => void;
  setLanUrls: (urls: string[]) => void;
  setLiveScan: (scan: ScanResult | null) => void;
  setExpandedPreview: (text: string) => void;
};

export const useForge = create<ForgeState>()(
  persist(
    (set, get) => ({
      mode: "t2i",
      prompt: "a __shot__ of a figure in a __setting__, __lighting__, __camera__, __style__",
      negative: "blurry, watermark, extra fingers, low-res",
      seed: 42,
      seedLocked: true,
      aspect: "1:1",
      denoise: 0.65,
      duration: 6,
      showBoxes: false,
      media: [],
      loras: DEFAULT_LORAS,
      wildcards: DEFAULT_WILDCARDS,
      jobs: [],
      activeJobId: null,
      settings: DEFAULT_COMFY,
      comfy: null,
      lanUrls: [],
      liveScan: null,
      expandedPreview: "",
      setMode: (mode) => set({ mode }),
      setPrompt: (prompt) => set({ prompt }),
      setNegative: (negative) => set({ negative }),
      setSeed: (seed) => set({ seed }),
      toggleSeedLock: () => set({ seedLocked: !get().seedLocked }),
      rollSeed: () => set({ seed: Math.floor(Math.random() * 1_000_000_000) }),
      setAspect: (aspect) => set({ aspect: ASPECTS.includes(aspect) ? aspect : "1:1" }),
      setDenoise: (denoise) => set({ denoise }),
      setDuration: (duration) => set({ duration }),
      setShowBoxes: (showBoxes) => set({ showBoxes }),
      addMedia: (items) => set({ media: [...get().media, ...items].slice(0, 5) }),
      removeMedia: (id) => set({ media: get().media.filter((m) => m.id !== id) }),
      clearMedia: () => set({ media: [] }),
      upsertLora: (lora) => {
        const list = get().loras;
        const i = list.findIndex((l) => l.id === lora.id);
        if (i === -1) set({ loras: [...list, lora] });
        else set({ loras: list.map((l) => (l.id === lora.id ? lora : l)) });
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
        set({ jobs: [job, ...get().jobs].slice(0, 40), activeJobId: job.id }),
      patchJob: (id, patch) =>
        set({
          jobs: get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        }),
      setActiveJob: (id) => set({ activeJobId: id }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setComfy: (comfy) => set({ comfy }),
      setLanUrls: (lanUrls) => set({ lanUrls }),
      setLiveScan: (liveScan) => set({ liveScan }),
      setExpandedPreview: (expandedPreview) => set({ expandedPreview }),
    }),
    {
      name: "forge-studio-v1",
      skipHydration: true,
      partialize: (s) => ({
        mode: s.mode,
        prompt: s.prompt,
        negative: s.negative,
        seed: s.seed,
        seedLocked: s.seedLocked,
        aspect: s.aspect,
        denoise: s.denoise,
        duration: s.duration,
        showBoxes: s.showBoxes,
        loras: s.loras,
        wildcards: s.wildcards,
        jobs: s.jobs.map((j) => ({
          ...j,
          resultDataUrl:
            j.resultDataUrl && j.resultDataUrl.length > 400_000 ? undefined : j.resultDataUrl,
        })),
        activeJobId: s.activeJobId,
        settings: s.settings,
      }),
    },
  ),
);
