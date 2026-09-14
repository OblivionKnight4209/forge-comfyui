export const MODES = [
  "t2i",
  "i2i",
  "ref2i",
  "t2v",
  "i2v",
  "ref2v",
  "v2v",
  "v2i",
] as const;

export type Mode = (typeof MODES)[number];

export const MODE_META: Record<
  Mode,
  { label: string; blurb: string; needsImage: boolean; needsVideo: boolean; video: boolean }
> = {
  t2i: { label: "Text → Image", blurb: "Prompt in, still out", needsImage: false, needsVideo: false, video: false },
  i2i: { label: "Image → Image", blurb: "Edit or restyle a still", needsImage: true, needsVideo: false, video: false },
  ref2i: { label: "Refs → Image", blurb: "Mix 2–5 stills into one", needsImage: true, needsVideo: false, video: false },
  t2v: { label: "Text → Video", blurb: "Prompt in, clip out", needsImage: false, needsVideo: false, video: true },
  i2v: { label: "Image → Video", blurb: "Still becomes the first frame", needsImage: true, needsVideo: false, video: true },
  ref2v: { label: "Refs → Video", blurb: "Character and style control", needsImage: true, needsVideo: false, video: true },
  v2v: { label: "Video → Video", blurb: "Restyle existing footage", needsImage: false, needsVideo: true, video: true },
  v2i: { label: "Video → Image", blurb: "Pull a still from a clip", needsImage: false, needsVideo: true, video: false },
};

export type ModelFamily = "flux" | "sdxl" | "sd15" | "wan";

export type LoraEntry = {
  id: string;
  filename: string;
  name: string;
  family: ModelFamily;
  triggerWords: string[];
  unetStrength: number;
  clipStrength: number;
  enabled: boolean;
};

export type WildcardFile = {
  name: string;
  lines: string[];
};

export type MediaRef = {
  id: string;
  kind: "image" | "video";
  name: string;
  dataUrl: string;
};

export type DetectedBox = {
  id: string;
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ScanResult = {
  summary: string;
  tags: { tag: string; confidence: number }[];
  boxes: DetectedBox[];
  palette: string[];
  notes: string[];
  scannedAt: number;
};

export type JobStatus = "held" | "queued" | "running" | "done" | "error";

export type Job = {
  id: string;
  createdAt: number;
  mode: Mode;
  prompt: string;
  expandedPrompt: string;
  negative: string;
  seed: number;
  status: JobStatus;
  error?: string;
  resultDataUrl?: string;
  resultKind: "image" | "video";
  scan?: ScanResult;
  apiWorkflow: Record<string, unknown>;
  uiWorkflow: Record<string, unknown>;
  promptId?: string;
};

export type Aspect = "1:1" | "16:9" | "9:16" | "3:2" | "2:3" | "4:3" | "21:9";

export const ASPECTS: Aspect[] = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "21:9"];

export const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1344, h: 768 },
  "9:16": { w: 768, h: 1344 },
  "3:2": { w: 1216, h: 832 },
  "2:3": { w: 832, h: 1216 },
  "4:3": { w: 1152, h: 896 },
  "21:9": { w: 1536, h: 640 },
};

export type ComfySettings = {
  baseUrl: string;
  stillFamily: "flux" | "sdxl";
  fluxUnet: string;
  fluxClipL: string;
  fluxT5: string;
  fluxVae: string;
  sdxlCheckpoint: string;
  wanUnet: string;
  wanClip: string;
  wanVae: string;
  steps: number;
  cfg: number;
  fluxGuidance: number;
  sampler: string;
  scheduler: string;
  videoFrames: number;
  videoFps: number;
};

export const DEFAULT_COMFY: ComfySettings = {
  baseUrl: "http://127.0.0.1:8188",
  stillFamily: "flux",
  fluxUnet: "flux1-dev.safetensors",
  fluxClipL: "clip_l.safetensors",
  fluxT5: "t5xxl_fp16.safetensors",
  fluxVae: "ae.safetensors",
  sdxlCheckpoint: "sd_xl_base_1.0.safetensors",
  wanUnet: "wan2.1_t2v_14B_fp8_e4m3fn.safetensors",
  wanClip: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
  wanVae: "wan_2.1_vae.safetensors",
  steps: 20,
  cfg: 1,
  fluxGuidance: 3.5,
  sampler: "euler",
  scheduler: "simple",
  videoFrames: 81,
  videoFps: 16,
};

export type ComfyStatus = {
  ok: boolean;
  message: string;
  checkpoints: string[];
  unets: string[];
  loras: string[];
  vaes: string[];
};
