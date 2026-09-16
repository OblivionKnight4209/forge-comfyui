export type LogEntry = {
  id: string;
  at: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
};

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
  {
    label: string;
    blurb: string;
    how: string;
    needsImage: boolean;
    needsVideo: boolean;
    video: boolean;
    group: "image" | "video";
  }
> = {
  t2i: {
    label: "From text",
    blurb: "Prompt only",
    how: "Type what you want. No photo needed. This is the normal Grok still.",
    needsImage: false,
    needsVideo: false,
    video: false,
    group: "image",
  },
  i2i: {
    label: "Edit photo",
    blurb: "Change a still",
    how: "Put a picture on the left. Fill Take out / Put in / Change. Then Generate. Only that picture is edited. This box is NOT the From text box.",
    needsImage: true,
    needsVideo: false,
    video: false,
    group: "image",
  },
  ref2i: {
    label: "Combine",
    blurb: "Mix 2–5 photos",
    how: "Tap Combine. Your current still is slot 1. Tap more photos from Results or the library (need 2 to 5). Type the new scene. Generate.",
    needsImage: true,
    needsVideo: false,
    video: false,
    group: "image",
  },
  t2v: {
    label: "From text",
    blurb: "Prompt only",
    how: "Type what should happen. No file needed. This is the normal Grok clip.",
    needsImage: false,
    needsVideo: false,
    video: true,
    group: "video",
  },
  i2v: {
    label: "Animate photo",
    blurb: "Still becomes frame 1",
    how: "Drop one still. It becomes the first frame. The prompt is the motion. WAN 2.2 needs HIGH then LOW — high-only is pink static.",
    needsImage: true,
    needsVideo: false,
    video: true,
    group: "video",
  },
  ref2v: {
    label: "Refs into clip",
    blurb: "Photos drive a clip",
    how: "Drop 2–5 stills. Same idea as refs for image, but the output is video.",
    needsImage: true,
    needsVideo: false,
    video: true,
    group: "video",
  },
  v2v: {
    label: "Restyle clip",
    blurb: "Video to video",
    how: "Drop a video. The prompt restyles it. Strength is how far it drifts from the original.",
    needsImage: false,
    needsVideo: true,
    video: true,
    group: "video",
  },
  v2i: {
    label: "Grab a still",
    blurb: "Frame from a clip",
    how: "Drop a video. Forge pulls a still (and can scan it).",
    needsImage: false,
    needsVideo: true,
    video: false,
    group: "video",
  },
};

export type ModelFamily = "flux" | "sdxl" | "sd15" | "wan";

export type StillLoader = "checkpoint" | "flux-unet";

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
  folder?: "input" | "output";
};

const GENERIC_STILL = /^(still|edit|continue|liked|last|photo)(\.png|\.jpg|\.jpeg|\.webp)?$/i;

/** Same photo even if one path is /forge-media?name= and the other is a data URL. */
export function stillKey(name?: string, src?: string): string {
  const fromName = (name || "").replace(/\\/g, "/").split("/").pop() || "";
  let fromSrc = "";
  const s = src || "";
  const q = s.match(/[?&](?:name|filename)=([^&]+)/i);
  if (q) {
    try {
      fromSrc = decodeURIComponent(q[1]);
    } catch {
      fromSrc = q[1];
    }
  }
  for (const raw of [fromName, fromSrc]) {
    const base = (raw || "").replace(/\\/g, "/").split("/").pop()?.trim() || "";
    if (!base || GENERIC_STILL.test(base)) continue;
    return base.toLowerCase();
  }
  return "";
}

export function sameStill(
  a: { name?: string; dataUrl?: string },
  b: { name?: string; dataUrl?: string },
): boolean {
  if (a.dataUrl && b.dataUrl && a.dataUrl === b.dataUrl) return true;
  const ka = stillKey(a.name, a.dataUrl);
  const kb = stillKey(b.name, b.dataUrl);
  return Boolean(ka && kb && ka === kb);
}

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
  resultName?: string;
  resultFolder?: "input" | "output";
  resultKind: "image" | "video";
  scan?: ScanResult;
  apiWorkflow: Record<string, unknown>;
  uiWorkflow: Record<string, unknown>;
  promptId?: string;
  checkpoint?: string;
  progress?: number;
  log?: string;
};

export type Aspect = "1:1" | "16:9" | "9:16" | "3:2" | "2:3" | "4:3" | "3:4" | "21:9";

export const ASPECTS: Aspect[] = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9"];

export const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1344, h: 768 },
  "9:16": { w: 768, h: 1344 },
  "3:2": { w: 1216, h: 832 },
  "2:3": { w: 832, h: 1216 },
  "4:3": { w: 1152, h: 896 },
  "3:4": { w: 896, h: 1152 },
  "21:9": { w: 1536, h: 640 },
};

export type ComfySettings = {
  baseUrl: string;
  stillLoader: StillLoader;
  checkpoint: string;
  stillFamily: "flux" | "sdxl" | "sd15";
  fluxUnet: string;
  fluxClipL: string;
  fluxT5: string;
  fluxVae: string;
  sdxlCheckpoint: string;
  wanUnet: string;
  wanUnetLow: string;
  wanClip: string;
  wanVae: string;
  steps: number;
  cfg: number;
  fluxGuidance: number;
  sampler: string;
  scheduler: string;
  videoFrames: number;
  videoFps: number;
  batchSize: number;
  clipSkip: number;
  hires: boolean;
  llmUrl: string;
  llmModel: string;
};

export const DEFAULT_COMFY: ComfySettings = {
  baseUrl: "http://127.0.0.1:8188",
  stillLoader: "checkpoint",
  checkpoint: "",
  stillFamily: "sdxl",
  fluxUnet: "flux1-dev.safetensors",
  fluxClipL: "clip_l.safetensors",
  fluxT5: "t5xxl_fp16.safetensors",
  fluxVae: "ae.safetensors",
  sdxlCheckpoint: "",
  wanUnet: "",
  wanUnetLow: "",
  wanClip: "",
  wanVae: "",
  steps: 28,
  cfg: 5,
  fluxGuidance: 3.5,
  sampler: "euler_ancestral",
  scheduler: "normal",
  videoFrames: 81,
  videoFps: 16,
  batchSize: 1,
  clipSkip: 2,
  hires: false,
  llmUrl: "http://127.0.0.1:11434",
  llmModel: "huihui_ai/qwen2.5-abliterate:7b",
};

export const THEMES = [
  { id: "void", label: "Void" },
  { id: "ember", label: "Ember" },
  { id: "moss", label: "Moss" },
  { id: "ice", label: "Ice" },
  { id: "wine", label: "Wine" },
  { id: "violet", label: "Violet" },
  { id: "paper", label: "Paper" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

export function isRealCheckpoint(name: string) {
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  if (!base) return false;
  if (/\.(pth|bin|pt)$/i.test(base)) return false;
  if (/hunyuan3d|triposr|distutils|pipx_shared|^alex\.pth|data\.bin|lumina|nextdit|next-dit|svd_xt|gemma2/.test(base)) return false;
  if (base.includes(" & ")) return false;
  if (/(^|[^a-z])lora([^a-z]|$)/.test(base) && !/checkpoint|xl|pony|illustrious|sd15|mix/.test(base)) return false;
  return true;
}

export type ComfyStatus = {
  ok: boolean;
  message: string;
  checkpoints: string[];
  unets: string[];
  loras: string[];
  vaes: string[];
  clips: string[];
  wildcards: string[];
  taggerClass: string;
  taggerModels: string[];
};

export function ckptBase(name: string) {
  return (name || "").replace(/\\/g, "/").split("/").pop() || name;
}

export function resolveCkpt(want: string, list: string[]): string {
  const real = list.filter(isRealCheckpoint);
  if (!real.length) return want;
  if (want && real.includes(want)) return want;
  const base = ckptBase(want);
  if (base) {
    const lower = base.toLowerCase();
    const hit =
      real.find((a) => a === base) ??
      real.find((a) => a.replace(/\\/g, "/").endsWith(`/${base}`)) ??
      real.find((a) => ckptBase(a).toLowerCase() === lower);
    if (hit) return hit;
    if (want) return want;
  }
  return real[0] ?? want;
}

export function canEditPhoto(name: string) {
  const n = (name || "").toLowerCase();
  if (!isRealCheckpoint(name)) return false;
  if (/hunyuan3d|triposr|lumina|nextdit|next-dit|svd|wan2|text.encoder|gemma|t5xxl|dit-v2/.test(n)) return false;
  return true;
}

export function pickVaeName(family: "flux" | "sdxl" | "sd15", settings: Pick<ComfySettings, "fluxVae" | "wanVae">, vaes: string[]) {
  const list = vaes.filter((v) => v && !/wan|umt5/i.test(v));
  const hit = (re: RegExp) => list.find((v) => re.test(v)) || "";
  if (family === "flux") {
    return (
      (settings.fluxVae && list.includes(settings.fluxVae) ? settings.fluxVae : "") ||
      hit(/ae\.safetensors|flux.*vae/i) ||
      settings.fluxVae ||
      ""
    );
  }
  if (family === "sd15") return hit(/vae-ft-mse|kl-f8|sd-?vae/i) || list.find((v) => /vae/i.test(v)) || "";
  return (
    hit(/sdxl_vae|xlvae|vae-ft-mse|pony.*vae|illustrious.*vae/i) ||
    list.find((v) => /vae/i.test(v) && !/ae\.safetensors/i.test(v)) ||
    ""
  );
}

export function isWanUnet(name: string) {
  const n = (name || "").toLowerCase();
  if (!n) return false;
  if (/hunyuan3d|lumina|nextdit|flux|sdxl|krea|umt5|camera|text.encoder/.test(n)) return false;
  return /wan/.test(n);
}

/** 5B / ti2v / 2.2 VAE = 48ch. 14B 2.2 i2v high/low noise still uses 16ch + WAN 2.1 VAE. */
export function wanStackVersion(name: string): "21" | "22" | "" {
  const n = (name || "").toLowerCase();
  if (!n) return "";
  if (!/wan|vae/.test(n)) return "";
  if (/ti2v|5b|48ch/.test(n)) return "22";
  if (/vae/.test(n) && /2[\s._-]*2/.test(n)) return "22";
  if (/wan/.test(n) || /2[\s._-]*1/.test(n)) return "21";
  return "";
}

export function isPlayUnet(name: string) {
  if (!isWanUnet(name)) return false;
  const n = name.toLowerCase();
  if (/camera|umt5|lora|cunnilingus|masturbat/.test(n) && !/14b/.test(n)) return false;
  if (wanStackVersion(n) === "22") return false;
  return true;
}

export function pickWanVae(unet: string, vaes: string[], current = "") {
  const ver = wanStackVersion(unet) || "21";
  const pool = vaes.filter((v) => /wan/i.test(v) && wanStackVersion(v) === ver);
  const wan21 = vaes.filter((v) => /wan/i.test(v) && wanStackVersion(v) !== "22");
  if (current && pool.includes(current)) return current;
  return pool[0] || (ver === "21" ? wan21[0] : "") || "";
}

export function pickWanClip(clips: string[], current = "") {
  const umt5 = clips.filter((c) => /umt5/i.test(c));
  const safe = umt5.filter((c) => /\.safetensors$/i.test(c));
  const wan = clips.filter((c) => /wan/i.test(c) && !/gemma|clip_l/i.test(c) && !umt5.includes(c));
  const pool = [...safe, ...umt5, ...wan];
  if (current && pool.includes(current)) return current;
  return pool[0] || "";
}

export function wanPairOk(unet: string, vae: string) {
  if (!unet || !vae) return false;
  const u = wanStackVersion(unet) || "21";
  const v = wanStackVersion(vae) || "21";
  return u === v;
}

export function wanFrameCount(seconds: number, fps = 16) {
  void seconds;
  void fps;
  return 81;
}

export function wanFpsForDuration(seconds: number) {
  if (seconds >= 15) return 8;
  if (seconds >= 10) return 10;
  return 16;
}

export function isT2vUnet(name: string) {
  if (!isWanUnet(name)) return false;
  const n = name.toLowerCase();
  if (/camera|umt5|lora/.test(n) && !/t2v|ti2v/.test(n)) return false;
  return /t2v|ti2v/.test(n);
}

export function isHighNoiseUnet(name: string) {
  if (!isWanUnet(name)) return false;
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const stem = (n.split("/").pop() || n).replace(/\.(safetensors|gguf|pt|pth|bin)$/i, "");
  if (/low[\s._-]*noise|_low$/.test(stem)) return false;
  return /high[\s._-]*noise|snatchkisshigh|[\s._-]highv\d|highv\d|_high$/.test(stem);
}

export function isLowNoiseUnet(name: string) {
  if (!isWanUnet(name)) return false;
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const stem = (n.split("/").pop() || n).replace(/\.(safetensors|gguf|pt|pth|bin)$/i, "");
  if (/high[\s._-]*noise|snatchkisshigh|_high$/.test(stem)) return false;
  return /low[\s._-]*noise|snatchkisslow|[\s._-]lowv\d|lowv\d|_low$/.test(stem);
}

export function isLightningUnet(name: string) {
  return /lightspeed|lightx2v|rapid|lightning|4.?step|6.?step/i.test(name || "");
}

/** Family key so Dasiwa High never pairs with Rapid Low. */
export function wanExpertStem(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.(safetensors|gguf|pt|pth|bin)$/i, "")
    .replace(/high[\s._-]*noise/g, "")
    .replace(/low[\s._-]*noise/g, "")
    .replace(/snatchkiss(?:high|low)v?\d*/g, "")
    .replace(/[\s._-]highv\d+/g, "")
    .replace(/[\s._-]lowv\d+/g, "")
    .replace(/[\s._-](?:high|low)$/g, "")
    .replace(/[\s._-]+(?:fp8[_-]?scaled|fp8_e4m3fn|fp16|bf16|fp8)/g, "")
    .replace(/[\s._-]+/g, "");
}

export function pickMatchingExpert(name: string, unets: string[], want: "high" | "low") {
  const stem = wanExpertStem(name);
  if (!stem) return "";
  return (
    unets.find((n) => {
      if (wanExpertStem(n) !== stem) return false;
      return want === "high" ? isHighNoiseUnet(n) : isLowNoiseUnet(n);
    }) || ""
  );
}

export function wanHighOnlyMessage(name: string) {
  const base = (name || "").replace(/\\/g, "/").split("/").pop() || name;
  return `Pink static: ${base} is the HIGH-noise half. Play needs the matching LOW-noise 14B (same mix). Do not pair Dasiwa High with Rapid Low. Put wan2.2_i2v_low_noise_14B next to the high file, or pick a 2.1 / Lightspeed file that is not labeled High.`;
}

export function pairWanUnets(
  selected: string,
  unets: string[],
): { high: string; low: string; single: string; error?: string } {
  if (!selected) return { high: "", low: "", single: "" };
  if (isHighNoiseUnet(selected)) {
    const low = pickMatchingExpert(selected, unets, "low");
    if (!low) return { high: selected, low: "", single: "", error: wanHighOnlyMessage(selected) };
    return { high: selected, low, single: "" };
  }
  if (isLowNoiseUnet(selected)) {
    const high = pickMatchingExpert(selected, unets, "high");
    if (high) return { high, low: selected, single: "" };
    return { high: "", low: "", single: selected };
  }
  return { high: "", low: "", single: selected };
}

export function pickT2vUnet(current: string, unets: string[]) {
  const t2v = unets.filter(isT2vUnet);
  const b14 = t2v.filter((n) => /14b/i.test(n) && !/ti2v|5b/i.test(n) && !isHighNoiseUnet(n));
  const b5 = t2v.filter((n) => /ti2v|5b/i.test(n));
  if (current && t2v.includes(current)) {
    if (isHighNoiseUnet(current) && !pickMatchingExpert(current, unets, "low")) {
      return b14[0] || b5[0] || current;
    }
    return current;
  }
  return b14[0] || b5[0] || "";
}

/** 14B i2v (16ch). Skip 5B/ti2v which needs the 48ch VAE. Never default to high-noise-only. */
export function pickPlayUnet(current: string, unets: string[]) {
  const inList = (n: string) => Boolean(n) && unets.includes(n);
  if (inList(current) && isWanUnet(current) && wanStackVersion(current) !== "22") {
    if (isHighNoiseUnet(current)) {
      if (pickMatchingExpert(current, unets, "low")) return current;
    } else {
      return current;
    }
  }
  const playable = unets.filter((n) => isPlayUnet(n) && !isHighNoiseUnet(n));
  const safetensors = playable.filter((n) => /\.safetensors$/i.test(n));
  const pool = safetensors.length ? safetensors : playable;
  return (
    pool.find((n) => /14b/i.test(n) && isLowNoiseUnet(n)) ||
    pool.find((n) => /14b/i.test(n)) ||
    pool[0] ||
    current
  );
}

export const CKPT_STYLES = [
  { id: "all", label: "All looks", hint: "Show every mix" },
  { id: "anime", label: "Anime", hint: "2D Japan cartoon — Dasiwa, nova, kitten" },
  { id: "toon", label: "Cartoon", hint: "Western toon / comic, not anime" },
  { id: "real", label: "Photo", hint: "Looks like a real camera" },
  { id: "semi", label: "Half-real", hint: "Between a photo and a drawing" },
  { id: "pony", label: "Pony", hint: "Pony XL mixes (score_9 tags)" },
  { id: "illustrious", label: "Illustrious", hint: "Illustrious XL anime mixes" },
  { id: "nsfw", label: "NSFW mixes", hint: "Sex / hentai in the mix name" },
  { id: "3d", label: "3D", hint: "Blender / game / octane look" },
  { id: "furry", label: "Furry", hint: "Anthro animals" },
] as const;
export type CkptStyle = (typeof CKPT_STYLES)[number]["id"];

export function guessStyles(name: string): Exclude<CkptStyle, "all">[] {
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  const out = new Set<Exclude<CkptStyle, "all">>();
  if (/illustrious|noobai|\bnoob\b/.test(base) || /(?:^|[^a-z])il(?:[-_.]|xl)/.test(base)) out.add("illustrious");
  if (/pony/.test(base)) out.add("pony");
  if (
    /anime|hentai|manga|waifu|niji|anything|kitten|nova|dasiwa|meina|counterfeit|anima|janku|basnsfw/.test(
      base,
    )
  ) {
    out.add("anime");
  }
  if (/toon|cartoon|comic/.test(base)) out.add("toon");
  if (/furry|anthro|yiff/.test(base)) out.add("furry");
  if (/\b3d\b|octane|blender|unreal/.test(base)) out.add("3d");
  if (/semi|semireal|semi-real/.test(base)) out.add("semi");
  if (
    /real|photo|analog|vision|juggernaut|epicreal|deliberate|chillout|photon|raw|photoreal/.test(base) &&
    !out.has("anime")
  ) {
    out.add("real");
  }
  if (/nsfw|hentai|sex|porn|unholy|goblin|monstersex|abyssal|desire|\bcum\b|hda_/.test(base)) out.add("nsfw");
  if (!out.size) {
    out.add(guessArch(name) === "sd15" ? "anime" : "real");
  }
  return [...out];
}

export function checkpointMatchesStyle(name: string, style: CkptStyle) {
  if (style === "all") return true;
  return guessStyles(name).includes(style);
}

export function guessArch(name: string): ModelFamily {
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  if (/wan/.test(base) && !/swan|want/.test(base)) return "wan";
  if (
    /(flux1|flux-1|flux\.1|flux_|flux-|fluxdev|fluxschnell|\bflux\b)/.test(base) ||
    (/flux/.test(base) && /unet|dev|schnell|krea|kontext/.test(base))
  ) {
    return "flux";
  }
  if (
    /xl|sdxl|pony|illustrious|noobai|noob|anima|juggernaut|realvisxl/.test(base) ||
    /(?:^|[^a-z])il(?:[-_.]|$)/.test(base)
  ) {
    return "sdxl";
  }
  if (
    /sd15|sd1[\._-]?5|v1-5|pruned|emaonly|realisticvision|analog|deliberate|counterfeit|henmix|epicrealism|photon|meinamix|chillout|cutekitten|anythingv3|dreamshaper(?!xl)/.test(
      base,
    ) ||
    (base.includes("mix") && !/xl|pony|illustrious|noob/.test(base))
  ) {
    return "sd15";
  }
  return "sdxl";
}

/** Still-image mixes only — skip WAN / SVD / 3D. */
export function isImageCheckpoint(name: string) {
  if (!isRealCheckpoint(name)) return false;
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  if (/hunyuan3d|triposr|svd_xt|\bsvd\b|i2v|t2v|ti2v/.test(base)) return false;
  if (/wan/.test(base) && !/swan|want|waning/.test(base)) return false;
  const arch = guessArch(name);
  return arch === "sd15" || arch === "sdxl" || arch === "flux";
}

export function sizeForFamily(
  family: "flux" | "sdxl" | "sd15",
  aspect: Aspect,
): { w: number; h: number } {
  const base = ASPECT_SIZE[aspect];
  if (family !== "sd15") return base;
  const max = 640;
  const scale = max / Math.max(base.w, base.h);
  const round = (n: number) => Math.max(512, Math.round((n * scale) / 8) * 8);
  return { w: round(base.w), h: round(base.h) };
}

export type LoraLane = "wan" | "flux" | "pony" | "illustrious" | "sdxl" | "sd15" | "any";

export function guessLoraLane(name: string): LoraLane {
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  if (/flux/.test(base)) return "flux";
  if (/\bwan\b|wan2|wan22/.test(base) && !/swan/.test(base)) return "wan";
  if (/pony|pdxl|score.?9/.test(base)) return "pony";
  if (
    /illustrious|noobai|\bnoob\b|anima|\bilxl\b|illustriousxl|(?:^|[_-])il(?:[_.-]|$)/.test(base)
  ) {
    return "illustrious";
  }
  const xlHint = /xl|illustrious|pony|flux|wan/.test(base);
  if (
    !xlHint &&
    /(sd15|sd1[\._-]?5|\b1\.5\b|v1-5|epicrealism|uberrealistic|tutelage|chillout|analog.?diff|deliberate|realisticvision|pruned|emaonly|henmix|meinamix|cutekitten|anythingv3|dreamshaper(?!xl)|add[_-]?detail|more[_-]?details|detail[_-]?slider|detailslider)/.test(
      base,
    )
  ) {
    return "sd15";
  }
  if (/xl|sdxl/.test(base)) return "sdxl";
  return "any";
}

export function loraFitsLane(loraName: string, ckptName: string): boolean {
  const ll = guessLoraLane(loraName);
  let cl = guessLoraLane(ckptName);
  if (cl === "any") {
    const arch = guessArch(ckptName);
    cl = arch === "wan" ? "wan" : arch === "flux" ? "flux" : arch === "sd15" ? "sd15" : "sdxl";
  }
  if (cl === "wan" || ll === "wan") return cl === "wan" && ll === "wan";
  if (cl === "flux" || ll === "flux") return cl === "flux" && ll === "flux";
  // SD1.5 tensors are 768-wide. XL / Pony / IL / unlabeled character LoRAs are 1024–2048
  // and crash Comfy with "shape [1280, 768] is invalid for input of size 1310720".
  if (cl === "sd15") return ll === "sd15";
  if (ll === "sd15") return false;
  if (ll === "any") return cl === "sdxl" || cl === "illustrious" || cl === "pony";
  if (cl === "pony") return ll === "pony" || ll === "sdxl";
  if (cl === "illustrious") return ll === "illustrious" || ll === "sdxl";
  if (cl === "sdxl") return ll === "sdxl" || ll === "illustrious";
  return ll === cl;
}

export function guessLoraFamily(name: string): ModelFamily | "any" {
  const lane = guessLoraLane(name);
  if (lane === "flux") return "flux";
  if (lane === "wan") return "wan";
  if (lane === "sd15") return "sd15";
  if (lane === "any") return "any";
  return "sdxl";
}

export function loraFitsCheckpoint(loraName: string, ckptFamily: ModelFamily, ckptName?: string): boolean {
  if (ckptName) return loraFitsLane(loraName, ckptName);
  const lf = guessLoraLane(loraName);
  if (ckptFamily === "flux") return lf === "flux";
  if (ckptFamily === "wan") return lf === "wan";
  if (ckptFamily === "sd15") return lf === "sd15";
  if (lf === "wan" || lf === "flux" || lf === "sd15") return false;
  return true;
}

export function resolveLoraName(filename: string, list: string[]): string {
  if (!filename) return filename;
  if (list.includes(filename)) return filename;
  const base = filename.replace(/\\/g, "/").split("/").pop() || filename;
  return (
    list.find((a) => a === base) ??
    list.find((a) => a.replace(/\\/g, "/").endsWith(`/${base}`)) ??
    list.find((a) => (a.replace(/\\/g, "/").split("/").pop() || "") === base) ??
    filename
  );
}

export function loraTriggerFromFilename(filename: string) {
  let stem = (filename || "").replace(/\\/g, "/").split("/").pop() || "";
  stem = stem.replace(/\.safetensors$/i, "");
  stem = stem.replace(/[_\s-]*(illustrious|anima|pony|noobai|nsfw|sdxl|\bxl\b).*$/i, "");
  stem = stem.replace(/[._-]?v?\d+(\.\d+)?.*$/i, "");
  stem = stem.replace(/[()[\]]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return stem.length > 1 ? stem : "";
}

const LORA_NAME_STOP = new Set([
  "illustrious",
  "anima",
  "pony",
  "noobai",
  "nsfw",
  "style",
  "xl",
  "sdxl",
  "sd15",
  "lora",
  "locon",
  "lycoris",
  "the",
  "and",
  "mix",
  "hentai",
  "uncensored",
  "better",
  "base",
  "version",
  "copy",
  "realistic",
  "photoreal",
  "clothing",
  "clothes",
  "outfit",
  "costume",
  "tearing",
  "wardrobe",
  "pose",
  "camera",
  "angle",
]);

const PROMPT_NAME_SKIP = new Set([
  "girl",
  "woman",
  "female",
  "boy",
  "man",
  "male",
  "human",
  "adult",
  "person",
  "people",
  "nude",
  "naked",
  "sex",
  "fight",
  "dark",
  "light",
  "style",
  "anime",
  "photo",
  "detailed",
  "background",
  "scene",
  "shot",
  "view",
  "from",
  "with",
  "this",
  "that",
  "very",
  "more",
]);

export function promptNameWords(prompt: string): string[] {
  return ((prompt || "").toLowerCase().match(/[a-z][a-z0-9']{2,}/g) ?? []).filter(
    (w) => w.length >= 4 && !PROMPT_NAME_SKIP.has(w),
  );
}

export function loraNameKeys(filename: string): string[] {
  const trigger = loraTriggerFromFilename(filename);
  const raw = (filename || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.safetensors$/i, "")
    .replace(/[()[\]]/g, " ")
    .replace(/[_-]+/g, " ") ?? "";
  const parts = `${trigger} ${raw}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !LORA_NAME_STOP.has(w) && !/^v?\d+$/.test(w));
  return [...new Set([trigger.toLowerCase(), ...parts].filter(Boolean))];
}

export function wordHitsLoraName(word: string, keys: string[]): boolean {
  const w = word.toLowerCase();
  if (w.length < 4) return false;
  for (const k of keys) {
    if (!k || k.length < 3) continue;
    if (k === w) return true;
    if (k.includes(w)) return true;
    if (w.length >= 5 && k.startsWith(w.slice(0, 5))) return true;
  }
  return false;
}

export function settingsForFamily(family: "flux" | "sdxl" | "sd15"): Partial<ComfySettings> {
  if (family === "sd15") {
    return {
      stillFamily: "sd15",
      stillLoader: "checkpoint",
      steps: 20,
      cfg: 7,
      sampler: "euler_ancestral",
      scheduler: "normal",
      clipSkip: 2,
    };
  }
  if (family === "flux") {
    return {
      stillFamily: "flux",
      stillLoader: "flux-unet",
      steps: 20,
      cfg: 1,
      sampler: "euler",
      scheduler: "simple",
      clipSkip: 1,
      fluxGuidance: 3.5,
    };
  }
  return {
    stillFamily: "sdxl",
    stillLoader: "checkpoint",
    steps: 28,
    cfg: 5,
    sampler: "euler_ancestral",
    scheduler: "normal",
    clipSkip: 2,
  };
}

const QUALITY_NEG =
  "worst quality, low quality, jpeg artifacts, extra fingers, fused fingers, missing fingers, poorly drawn hands, watermark, logo, child, loli, shota, underage";

export function negativeForCheckpoint(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("flux") || n.includes("krea") || n.includes("kontext")) {
    return "blurry, watermark, extra fingers, child, underage";
  }
  if (n.includes("pony")) {
    return `score_4, score_5, score_6, ${QUALITY_NEG}`;
  }
  if (n.includes("illustrious") || n.includes("noob") || /(?:^|[^a-z])il(?:[-_.]|$)/.test(n)) {
    return `worst quality, low quality, extra fingers, fused fingers, poorly drawn hands, watermark, child, loli, underage`;
  }
  return QUALITY_NEG;
}

const STOCK_NEGS = new Set(
  [
    "",
    negativeForCheckpoint("mix"),
    negativeForCheckpoint("pony"),
    negativeForCheckpoint("illustrious"),
    negativeForCheckpoint("cutekittenmix"),
    negativeForCheckpoint("flux"),
  ].map((s) => s.trim()),
);

export function negativeForPrompt(checkpoint: string, prompt: string): string {
  const t = (prompt || "").toLowerCase();
  const extra: string[] = [];
  const nsfw =
    /\b(nude|naked|nsfw|undress|topless|pussy|cock|sex|fuck|hentai|explicit|bdsm|tentacle|18\+|creampie|bondage|ahegao|rape|forced)\b/.test(
      t,
    );
  if (nsfw) extra.push("censored", "mosaic", "bar censor");
  const seen = new Set<string>();
  return [...negativeForCheckpoint(checkpoint).split(","), ...extra]
    .map((s) => s.trim())
    .filter((s) => s && (seen.has(s) ? false : (seen.add(s), true)))
    .join(", ");
}

export function shouldReplaceNegative(current: string) {
  return STOCK_NEGS.has(current.trim());
}

/** Sent to Comfy. Empty box still gets a hands/quality floor so stills do not melt. */
export function generateNegative(userNeg: string, checkpoint: string, prompt: string, locked = false) {
  if (userNeg.trim()) return userNeg.trim();
  if (locked) return "";
  return negativeForPrompt(checkpoint, prompt);
}

export function familyOfSelection(s: Pick<ComfySettings, "stillLoader" | "checkpoint" | "fluxUnet" | "stillFamily">): "sd15" | "sdxl" | "flux" {
  if (s.stillLoader === "flux-unet") return "flux";
  const a = guessArch(s.checkpoint || s.fluxUnet || "");
  if (a === "flux") return "flux";
  if (a === "sd15") return "sd15";
  if (s.stillFamily === "sd15" || s.stillFamily === "flux") return s.stillFamily;
  return "sdxl";
}

export function settingsForCheckpoint(name: string): Partial<ComfySettings> {
  const n = name.toLowerCase();
  const arch = guessArch(name);
  const family: "flux" | "sdxl" | "sd15" =
    arch === "sd15" ? "sd15" : arch === "flux" ? "flux" : "sdxl";
  const base = settingsForFamily(family);
  const asUnet = family === "flux" && /unet|diffusion/.test(n);
  const pinned: Partial<ComfySettings> = {
    ...base,
    stillLoader: asUnet ? "flux-unet" : "checkpoint",
    stillFamily: family,
    checkpoint: name,
    sdxlCheckpoint: name,
    ...(asUnet ? { fluxUnet: name } : {}),
  };
  if (/lightning|turbo|lcm|hyper|dmd|schnell|4step|8step|lightspeed/i.test(n)) {
    return {
      ...pinned,
      steps: 8,
      cfg: family === "sd15" ? 1 : 1,
      sampler: "euler",
      scheduler: "simple",
    };
  }
  if (n.includes("pony")) {
    return { ...pinned, clipSkip: 2, cfg: 7, sampler: "euler_ancestral", scheduler: "normal", steps: 28 };
  }
  if (n.includes("illustrious") || n.includes("noob") || n.includes("anima") || /(?:^|[^a-z])il(?:[-_.]|$)/.test(n)) {
    return { ...pinned, clipSkip: 2, cfg: 5, sampler: "euler_ancestral", scheduler: "normal", steps: 28 };
  }
  return pinned;
}
