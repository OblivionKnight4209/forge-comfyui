import type { Aspect, ComfySettings, Job, LoraEntry, Mode, ModelFamily } from "./types";
import { ASPECT_SIZE, guessArch, guessLoraLane, i2iCanvasSize, isHighNoiseUnet, isLightningUnet, isLowNoiseUnet, isNotALora, isWan14b, isWan5b, loraFitsCheckpoint, loraNameKeys, pickInpaintCkpt, promptNameWords, sizeForFamily, wordHitsLoraName } from "./types";

export type ApiNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title: string };
};

export type ApiPrompt = Record<string, ApiNode>;

type BuildArgs = {
  mode: Mode;
  prompt: string;
  negative: string;
  seed: number;
  aspect: Aspect;
  denoise: number;
  loras: LoraEntry[];
  settings: ComfySettings;
  imageCount: number;
  hasVideo: boolean;
  taggerClass?: string;
  taggerModel?: string;
  vaeName?: string;
  lean?: boolean;
  inputW?: number;
  inputH?: number;
  maskText?: string;
  controlnetName?: string;
  hasClipSeg?: boolean;
  hasCanny?: boolean;
};

function node(
  class_type: string,
  inputs: Record<string, unknown>,
  title: string,
): ApiNode {
  return { class_type, inputs, _meta: { title } };
}

function encodeInputStill(
  prompt: ApiPrompt,
  filename: string,
  w: number,
  h: number,
  vae: [string, number],
  crop: "disabled" | "center" = "center",
) {
  prompt["20"] = node("LoadImage", { image: filename }, "Input still");
  prompt["22"] = node(
    "ImageScale",
    {
      image: ["20", 0],
      width: w,
      height: h,
      upscale_method: "lanczos",
      crop,
    },
    "Fit size",
  );
  prompt["21"] = node("VAEEncode", { pixels: ["22", 0], vae }, "Encode");
}

function encodeRefCollage(
  prompt: ApiPrompt,
  count: number,
  w: number,
  h: number,
  vae: [string, number],
) {
  const n = Math.min(5, Math.max(2, count));
  const scaled: [string, number][] = [];
  for (let i = 0; i < n; i++) {
    const loadId = String(200 + i);
    const scaleId = String(210 + i);
    prompt[loadId] = node("LoadImage", { image: `forge_input_${i}.png` }, `Ref ${i + 1}`);
    prompt[scaleId] = node(
      "ImageScale",
      {
        image: [loadId, 0],
        width: Math.max(256, Math.floor(w / 2)),
        height: Math.max(256, Math.floor(h / 2)),
        upscale_method: "lanczos",
        crop: "center",
      },
      `Ref ${i + 1} size`,
    );
    scaled.push([scaleId, 0]);
  }
  let cur: [string, number] = scaled[0]!;
  for (let i = 1; i < scaled.length; i++) {
    const nid = String(220 + i);
    prompt[nid] = node(
      "ImageStitch",
      {
        image1: cur,
        image2: scaled[i],
        direction: i === 2 ? "down" : "right",
        match_image_size: true,
        spacing_width: 0,
        spacing_color: "white",
        extra_padding: 0,
      },
      `Stitch ${i}`,
    );
    cur = [nid, 0];
  }
  prompt["22"] = node(
    "ImageScale",
    { image: cur, width: w, height: h, upscale_method: "lanczos", crop: "center" },
    "Collage fit",
  );
  prompt["21"] = node("VAEEncode", { pixels: ["22", 0], vae }, "Encode refs");
}

function chainLoras(
  loras: LoraEntry[],
  modelRef: [string, number],
  clipRef: [string, number] | null,
  startId = 40,
): { model: [string, number]; clip: [string, number] | null; nodes: ApiPrompt; nextId: number } {
  const nodes: ApiPrompt = {};
  let model = modelRef;
  let clip = clipRef;
  let id = startId;
  for (const l of loras.filter((x) => x.enabled && !isNotALora(x.filename))) {
    const nid = String(id++);
    const wantClip = clip && Math.abs(l.clipStrength ?? 0) > 0.001;
    if (wantClip) {
      nodes[nid] = node(
        "LoraLoader",
        {
          model,
          clip,
          lora_name: l.filename,
          strength_model: l.unetStrength,
          strength_clip: l.clipStrength,
        },
        `LoRA ${l.name}`,
      );
      model = [nid, 0];
      clip = [nid, 1];
    } else {
      nodes[nid] = node(
        "LoraLoaderModelOnly",
        {
          model,
          lora_name: l.filename,
          strength_model: l.unetStrength,
        },
        `LoRA ${l.name}`,
      );
      model = [nid, 0];
    }
  }
  return { model, clip, nodes, nextId: id };
}

export function chunkPrompt(text: string, maxChars = 320): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  if (clean.length <= maxChars) return [clean];
  const parts = clean.split(/,\s*/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of parts) {
    const next = buf ? `${buf}, ${p}` : p;
    if (buf && next.length > maxChars) {
      chunks.push(buf);
      buf = p;
    } else buf = next;
  }
  if (buf) chunks.push(buf);
  return chunks.slice(0, 4);
}

function encodeLong(
  graph: ApiPrompt,
  firstId: string,
  extraStart: number,
  text: string,
  clip: [string, number],
  title: string,
): [string, number] {
  const chunks = chunkPrompt(text);
  graph[firstId] = node("CLIPTextEncode", { text: chunks[0] ?? "", clip }, title);
  let cond: [string, number] = [firstId, 0];
  let id = extraStart;
  for (const chunk of chunks.slice(1)) {
    const enc = String(id++);
    graph[enc] = node("CLIPTextEncode", { text: chunk, clip }, `${title} +`);
    const cat = String(id++);
    graph[cat] = node(
      "ConditioningConcat",
      { conditioning_to: cond, conditioning_from: [enc, 0] },
      "Long prompt",
    );
    cond = [cat, 0];
  }
  return cond;
}

function fluxStill(args: BuildArgs): ApiPrompt {
  const { w, h } =
    args.mode === "i2i" && args.inputW && args.inputH
      ? i2iCanvasSize(args.inputW, args.inputH, "flux")
      : ASPECT_SIZE[args.aspect];
  const s = args.settings;
  const fromCkpt = s.stillLoader !== "flux-unet";
  const prompt: ApiPrompt = {
    "1": fromCkpt
      ? node("CheckpointLoaderSimple", { ckpt_name: s.checkpoint || s.fluxUnet }, "Flux weights")
      : node(
          "UNETLoader",
          { unet_name: s.fluxUnet || s.checkpoint, weight_dtype: "fp8_e4m3fn" },
          "Flux UNET",
        ),
    "2": node(
      "DualCLIPLoader",
      {
        clip_name1: s.fluxClipL || "clip_l.safetensors",
        clip_name2: s.fluxT5 || "t5xxl_fp16.safetensors",
        type: "flux",
      },
      "Flux CLIP",
    ),
    "3": node("VAELoader", { vae_name: s.fluxVae || "ae.safetensors" }, "Flux VAE"),
  };

  const chained = chainLoras(
    args.loras.filter((l) => loraFitsCheckpoint(l.filename, "flux", s.fluxUnet || s.checkpoint)),
    ["1", 0],
    ["2", 0],
  );
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  const clip = chained.clip ?? ["2", 0];

  const pos = encodeLong(prompt, "10", 70, args.prompt, clip, "Positive");
  const neg = encodeLong(prompt, "11", 100, args.negative, clip, "Negative");
  prompt["12"] = node(
    "FluxGuidance",
    { guidance: s.fluxGuidance, conditioning: pos },
    "Flux guidance",
  );

  const i2i = args.mode === "i2i" || args.mode === "ref2i";
  if (args.mode === "ref2i" && args.imageCount >= 2) {
    encodeRefCollage(prompt, args.imageCount, w, h, ["3", 0]);
  } else if (i2i) {
    encodeInputStill(prompt, "forge_input_0.png", w, h, ["3", 0], args.inputW ? "disabled" : "center");
  } else {
    prompt["21"] = node(
      "EmptySD3LatentImage",
      { width: w, height: h, batch_size: Math.min(8, Math.max(1, s.batchSize || 1)) },
      "Empty latent",
    );
  }

  prompt["30"] = node(
    "KSampler",
    {
      seed: args.seed,
      steps: s.steps,
      cfg: s.cfg,
      sampler_name: s.sampler,
      scheduler: s.scheduler,
      denoise: i2i ? args.denoise : 1,
      model,
      positive: ["12", 0],
      negative: neg,
      latent_image: ["21", 0],
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae: ["3", 0] }, "Decode");
  prompt["32"] = node("SaveImage", { filename_prefix: "Forge", images: ["31", 0] }, "Save");
  return prompt;
}

function sdxlStill(args: BuildArgs): ApiPrompt {
  const s = args.settings;
  const ckpt = s.checkpoint || s.sdxlCheckpoint;
  const arch = s.stillFamily === "flux" || s.stillFamily === "sd15" ? s.stillFamily : "sdxl";
  const { w, h } =
    args.mode === "i2i" && args.inputW && args.inputH
      ? i2iCanvasSize(args.inputW, args.inputH, arch === "sd15" ? "sd15" : arch === "flux" ? "flux" : "sdxl")
      : sizeForFamily(arch, args.aspect);
  const prompt: ApiPrompt = {
    "1": node("CheckpointLoaderSimple", { ckpt_name: ckpt }, "Checkpoint"),
  };
  let clip: [string, number] = ["1", 1];
  const skip = s.clipSkip || 0;
  const fluxCkpt = arch === "flux";
  // CLIP skip only on 1.5. XL/Pony/Illustrious + a file with no CLIP
  // throws `NoneType has no attribute clone` in CLIPSetLastLayer.
  if (skip >= 2 && arch === "sd15") {
    prompt["4"] = node(
      "CLIPSetLastLayer",
      { clip: ["1", 1], stop_at_clip_layer: -Math.min(skip, 12) },
      "CLIP skip",
    );
    clip = ["4", 0];
  }
  const chained = chainLoras(
    args.loras.filter((l) => loraFitsCheckpoint(l.filename, arch, ckpt)),
    ["1", 0],
    fluxCkpt ? null : clip,
  );
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  clip = chained.clip ?? clip;
  const pos = encodeLong(prompt, "10", 70, args.prompt, clip, "Positive");
  const neg = encodeLong(prompt, "11", 100, args.negative, clip, "Negative");
  const i2i = args.mode === "i2i" || args.mode === "ref2i";
  let vae: [string, number] = ["1", 2];
  const wantVae = (args.vaeName || "").trim();
  const wanVae = /wan/i.test(wantVae);
  if (wantVae && !wanVae && (i2i || fluxCkpt || /krea|lumina|hunyuan|sd3|dit/.test((ckpt || "").toLowerCase()))) {
    prompt["3"] = node("VAELoader", { vae_name: wantVae }, "VAE");
    vae = ["3", 0];
  }
  if (fluxCkpt) {
    prompt["12"] = node(
      "FluxGuidance",
      { guidance: s.fluxGuidance, conditioning: pos },
      "Flux guidance",
    );
  }
  if (args.mode === "ref2i" && args.imageCount >= 2) {
    encodeRefCollage(prompt, args.imageCount, w, h, vae);
    const n = Math.min(8, Math.max(1, s.batchSize || 1));
    if (n > 1) {
      prompt["21r"] = node("RepeatLatentBatch", { samples: ["21", 0], amount: n }, "Batch");
    }
  } else if (i2i) {
    encodeInputStill(prompt, "forge_input_0.png", w, h, vae, args.inputW ? "disabled" : "center");
    const n = Math.min(8, Math.max(1, s.batchSize || 1));
    if (n > 1) {
      prompt["21r"] = node("RepeatLatentBatch", { samples: ["21", 0], amount: n }, "Batch");
    }
  } else if (fluxCkpt) {
    prompt["21"] = node(
      "EmptySD3LatentImage",
      { width: w, height: h, batch_size: Math.min(8, Math.max(1, s.batchSize || 1)) },
      "Empty latent",
    );
  } else {
    prompt["21"] = node(
      "EmptyLatentImage",
      { width: w, height: h, batch_size: Math.min(8, Math.max(1, s.batchSize || 1)) },
      "Empty latent",
    );
  }

  const sampler =
    fluxCkpt ? "euler" : s.sampler || (arch === "sd15" ? "euler_ancestral" : "dpmpp_2m");
  const scheduler =
    fluxCkpt ? "simple" : s.scheduler || (arch === "sd15" ? "normal" : "karras");
  prompt["30"] = node(
    "KSampler",
    {
      seed: args.seed,
      steps: fluxCkpt ? Math.min(s.steps || 20, 28) : s.steps || 28,
      cfg: fluxCkpt ? 1 : s.cfg || (arch === "sd15" ? 7 : 5),
      sampler_name: sampler,
      scheduler,
      denoise: i2i ? args.denoise : 1,
      model,
      positive: fluxCkpt ? ["12", 0] : pos,
      negative: neg,
      latent_image: i2i && (s.batchSize || 1) > 1 ? ["21r", 0] : ["21", 0],
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae }, "Decode");
  let image: [string, number] = ["31", 0];
  if (s.hires && !fluxCkpt && !i2i) {
    prompt["33"] = node(
      "ImageScaleBy",
      { image, upscale_method: "lanczos", scale_by: 1.5 },
      "Hires scale",
    );
    prompt["34"] = node("VAEEncode", { pixels: ["33", 0], vae }, "Hires encode");
    prompt["35"] = node(
      "KSampler",
      {
        seed: args.seed + 1,
        steps: Math.max(12, Math.round((s.steps || 28) * 0.5)),
        cfg: s.cfg || 7,
        sampler_name: sampler,
        scheduler,
        denoise: 0.35,
        model,
        positive: pos,
        negative: neg,
        latent_image: ["34", 0],
      },
      "Hires sampler",
    );
    prompt["36"] = node("VAEDecode", { samples: ["35", 0], vae }, "Hires decode");
    image = ["36", 0];
  }
  prompt["32"] = node("SaveImage", { filename_prefix: "Forge", images: image }, "Save");
  if (args.taggerClass) {
    prompt["90"] = node(
      args.taggerClass,
      {
        image,
        model: args.taggerModel || "wd-v1-4-moat-tagger-v2",
        threshold: 0.35,
        character_threshold: 0.85,
        replace_underscore: true,
        trailing_comma: false,
        exclude_tags: "",
      },
      "WD14 tags",
    );
  }
  return prompt;
}

/** Grok-style photo edit: mask the change, hold the rest with ControlNet, composite back. */
function sdxlInpaint(args: BuildArgs): ApiPrompt {
  const s = args.settings;
  const ckptWant = s.checkpoint || s.sdxlCheckpoint;
  const arch = s.stillFamily === "sd15" ? "sd15" : "sdxl";
  const ckpt = pickInpaintCkpt(ckptWant, [ckptWant, s.sdxlCheckpoint].filter(Boolean));
  const inpaintWeights = /inpaint/i.test(ckpt);
  const { w, h } =
    args.inputW && args.inputH
      ? i2iCanvasSize(args.inputW, args.inputH, arch)
      : sizeForFamily(arch, args.aspect);
  const prompt: ApiPrompt = {
    "1": node("CheckpointLoaderSimple", { ckpt_name: ckpt || ckptWant }, "Checkpoint"),
  };
  let clip: [string, number] = ["1", 1];
  const skip = s.clipSkip || 0;
  if (skip >= 2 && arch === "sd15") {
    prompt["4"] = node(
      "CLIPSetLastLayer",
      { clip: ["1", 1], stop_at_clip_layer: -Math.min(skip, 12) },
      "CLIP skip",
    );
    clip = ["4", 0];
  }
  const chained = chainLoras(
    args.loras.filter((l) => loraFitsCheckpoint(l.filename, arch, ckpt || ckptWant)),
    ["1", 0],
    clip,
  );
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  clip = chained.clip ?? clip;
  const pos = encodeLong(prompt, "10", 70, args.prompt, clip, "Positive");
  const neg = encodeLong(prompt, "11", 100, args.negative, clip, "Negative");
  let vae: [string, number] = ["1", 2];
  const wantVae = (args.vaeName || "").trim();
  if (wantVae && !/wan/i.test(wantVae)) {
    prompt["3"] = node("VAELoader", { vae_name: wantVae }, "VAE");
    vae = ["3", 0];
  }
  prompt["20"] = node("LoadImage", { image: "forge_input_0.png" }, "Input still");
  prompt["22"] = node(
    "ImageScale",
    {
      image: ["20", 0],
      width: w,
      height: h,
      upscale_method: "lanczos",
      crop: args.inputW ? "disabled" : "center",
    },
    "Fit size",
  );

  let condPos: [string, number] = pos;
  let condNeg: [string, number] = neg;
  const cn = (args.controlnetName || "").trim();
  if (cn) {
    prompt["26"] = node("ControlNetLoader", { control_net_name: cn }, "ControlNet");
    let cnImage: [string, number] = ["22", 0];
    if (args.hasCanny && /canny/i.test(cn)) {
      prompt["24"] = node(
        "Canny",
        { image: ["22", 0], low_threshold: 0.4, high_threshold: 0.8 },
        "Canny",
      );
      cnImage = ["24", 0];
    }
    prompt["27"] = node(
      "ControlNetApplyAdvanced",
      {
        positive: pos,
        negative: neg,
        control_net: ["26", 0],
        image: cnImage,
        strength: /tile/i.test(cn) ? 0.65 : 0.55,
        start_percent: 0,
        end_percent: 0.85,
      },
      "Hold structure",
    );
    condPos = ["27", 0];
    condNeg = ["27", 1];
  }

  const maskPhrase = (args.maskText || "").trim();
  const useClipSeg = Boolean(maskPhrase && args.hasClipSeg);
  if (useClipSeg) {
    prompt["50"] = node(
      "CLIPSeg",
      {
        image: ["22", 0],
        text: maskPhrase,
        blur: 7,
        threshold: 0.35,
        dilation_factor: 4,
      },
      "Edit mask",
    );
    prompt["51"] = node(
      "GrowMask",
      { mask: ["50", 0], expand: 12, tapered_corners: true },
      "Grow mask",
    );
  } else {
    prompt["50"] = node("SolidMask", { value: 1, width: w, height: h }, "Full mask");
    prompt["51"] = node(
      "FeatherMask",
      { mask: ["50", 0], left: 24, top: 24, right: 24, bottom: 24 },
      "Feather",
    );
  }

  const denoise = inpaintWeights || useClipSeg ? Math.max(0.72, Math.min(1, args.denoise >= 0.95 ? 1 : args.denoise)) : args.denoise;
  if (inpaintWeights) {
    prompt["21"] = node(
      "VAEEncodeForInpaint",
      { pixels: ["22", 0], vae, mask: ["51", 0], grow_mask_by: useClipSeg ? 8 : 6 },
      "Inpaint encode",
    );
  } else {
    prompt["21"] = node("VAEEncode", { pixels: ["22", 0], vae }, "Encode");
    prompt["23"] = node(
      "SetLatentNoiseMask",
      { samples: ["21", 0], mask: ["51", 0] },
      "Noise mask",
    );
  }
  const latent: [string, number] = inpaintWeights ? ["21", 0] : ["23", 0];
  const sampler = s.sampler || (arch === "sd15" ? "euler_ancestral" : "dpmpp_2m");
  const scheduler = s.scheduler || (arch === "sd15" ? "normal" : "karras");
  prompt["30"] = node(
    "KSampler",
    {
      seed: args.seed,
      steps: s.steps || 28,
      cfg: s.cfg || (arch === "sd15" ? 7 : 5),
      sampler_name: sampler,
      scheduler,
      denoise,
      model,
      positive: condPos,
      negative: condNeg,
      latent_image: latent,
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae }, "Decode");
  let image: [string, number] = ["31", 0];
  if (useClipSeg) {
    prompt["37"] = node(
      "ImageCompositeMasked",
      {
        destination: ["22", 0],
        source: ["31", 0],
        mask: ["51", 0],
        x: 0,
        y: 0,
        resize_source: true,
      },
      "Keep unmasked",
    );
    image = ["37", 0];
  }
  prompt["32"] = node("SaveImage", { filename_prefix: "Forge", images: image }, "Save");
  return prompt;
}

function videoSize(aspect: Aspect, unet = "", lean = false): { w: number; h: number } {
  const five = isWan5b(unet);
  const heavy = isWan14b(unet);
  if (lean) {
    switch (aspect) {
      case "9:16":
      case "2:3":
      case "3:4":
        return { w: 480, h: 640 };
      case "1:1":
        return { w: 512, h: 512 };
      default:
        return { w: 640, h: 384 };
    }
  }
  if (heavy) {
    switch (aspect) {
      case "9:16":
      case "2:3":
      case "3:4":
        return { w: 480, h: 720 };
      case "1:1":
        return { w: 576, h: 576 };
      default:
        return { w: 640, h: 400 };
    }
  }
  if (five) {
    switch (aspect) {
      case "9:16":
      case "2:3":
        return { w: 480, h: 832 };
      case "1:1":
        return { w: 704, h: 704 };
      default:
        return { w: 832, h: 480 };
    }
  }
  switch (aspect) {
    case "9:16":
      return { w: 480, h: 832 };
    case "1:1":
      return { w: 640, h: 640 };
    case "2:3":
    case "3:4":
      return { w: 480, h: 720 };
    case "3:2":
      return { w: 720, h: 480 };
    case "4:3":
      return { w: 640, h: 480 };
    case "21:9":
      return { w: 832, h: 352 };
    default:
      return { w: 832, h: 480 };
  }
}

function loadWanUnet(name: string, title: string): ApiNode {
  return /\.gguf$/i.test(name)
    ? node("UnetLoaderGGUF", { unet_name: name }, title)
    : node(
        "UNETLoader",
        {
          unet_name: name,
          weight_dtype: /fp8/i.test(name) ? "fp8_e4m3fn" : "default",
        },
        title,
      );
}

function wanVideo(args: BuildArgs): ApiPrompt {
  const lean = Boolean(args.lean);
  const { w, h } = videoSize(args.aspect, args.settings.wanUnet, lean);
  const s = args.settings;
  const fps = s.videoFps || 16;
  const heavy = isWan14b(s.wanUnet) || isWan14b(s.wanUnetLow);
  const maxFrames = lean ? 49 : 81;
  const frames = Math.max(17, Math.min(s.videoFrames || maxFrames, maxFrames));
  const i2v = args.mode === "i2v" || args.mode === "ref2v" || args.mode === "v2v";
  const is5b = isWan5b(s.wanUnet);
  const highName = isHighNoiseUnet(s.wanUnet)
    ? s.wanUnet
    : isHighNoiseUnet(s.wanUnetLow || "")
      ? s.wanUnetLow
      : "";
  const lowName = isLowNoiseUnet(s.wanUnetLow || "")
    ? s.wanUnetLow
    : isLowNoiseUnet(s.wanUnet)
      ? s.wanUnet
      : "";
  const dual = !lean && Boolean(highName && lowName && highName !== lowName);
  const primary = dual ? highName : s.wanUnet;
  const lightning = isLightningUnet(primary) || isLightningUnet(lowName);
  const steps = lightning
    ? 4
    : dual
      ? 20
      : i2v
        ? Math.max(20, Math.min(s.steps || 28, 32))
        : Math.max(20, Math.min(s.steps || 24, 30));
  const split = dual ? Math.max(1, Math.floor(steps / 2)) : steps;
  const shift = i2v ? 5 : 8;
  const cfg = lightning ? 1 : dual ? (i2v ? 3.5 : 4) : i2v ? 5 : 6;
  const wanLoras = lean
    ? []
    : args.loras
        .filter((l) => guessLoraLane(l.filename) === "wan" || /wan/i.test(l.name))
        .slice(0, heavy ? 1 : 3);
  const prompt: ApiPrompt = {
    "1": loadWanUnet(primary, dual ? "WAN HIGH" : "WAN UNET"),
    "2": /\.gguf$/i.test(s.wanClip)
      ? node("CLIPLoaderGGUF", { clip_name: s.wanClip, type: "wan" }, "WAN CLIP")
      : node("CLIPLoader", { clip_name: s.wanClip, type: "wan" }, "WAN CLIP"),
    "3": node("VAELoader", { vae_name: s.wanVae }, "WAN VAE"),
  };
  if (dual) prompt["4"] = loadWanUnet(lowName, "WAN LOW");
  const chained = chainLoras(wanLoras, ["1", 0], null, 40);
  Object.assign(prompt, chained.nodes);
  prompt["5"] = node("ModelSamplingSD3", { model: chained.model, shift }, dual ? "WAN shift high" : "WAN shift");
  let modelHigh: [string, number] = ["5", 0];
  let modelLow: [string, number] = ["5", 0];
  if (dual) {
    const chainedLow = chainLoras(wanLoras, ["4", 0], null, chained.nextId);
    Object.assign(prompt, chainedLow.nodes);
    prompt["6"] = node("ModelSamplingSD3", { model: chainedLow.model, shift }, "WAN shift low");
    modelHigh = ["5", 0];
    modelLow = ["6", 0];
  }
  const pos = encodeLong(
    prompt,
    "10",
    70,
    /sharp focus|same face/.test(args.prompt)
      ? args.prompt
      : i2v
        ? `${args.prompt}, same face, same body, same clothes, subtle motion, sharp focus, no morph`
        : `${args.prompt}, sharp focus, high detail, stable camera, clear`,
    ["2", 0],
    "Positive",
  );
  const neg = encodeLong(
    prompt,
    "11",
    100,
    /blurry/.test(args.negative)
      ? args.negative
      : `${args.negative}, blurry, out of focus, lowres, jpeg artifacts, morphing face, warped face, extra limbs, text, watermark`,
    ["2", 0],
    "Negative",
  );

  const needsImage = args.mode === "i2v" || args.mode === "ref2v";
  const needsVideo = args.mode === "v2v" || args.mode === "v2i";
  const startFrame = needsImage || needsVideo;

  if (startFrame) {
    prompt["20"] = node(
      "LoadImage",
      { image: needsVideo ? "forge_frame_0.png" : "forge_input_0.png" },
      needsVideo ? "Source frame" : "First frame",
    );
    prompt["22"] = node(
      "ImageScale",
      { image: ["20", 0], width: w, height: h, upscale_method: "lanczos", crop: "center" },
      "Fit size",
    );
    if (is5b) {
      prompt["21"] = node(
        "Wan22ImageToVideoLatent",
        {
          width: w,
          height: h,
          length: frames,
          batch_size: 1,
          vae: ["3", 0],
          start_image: ["22", 0],
        },
        "WAN 5B latent",
      );
    } else {
      prompt["21"] = node(
        "WanImageToVideo",
        {
          width: w,
          height: h,
          length: frames,
          batch_size: 1,
          positive: pos,
          negative: neg,
          vae: ["3", 0],
          start_image: ["22", 0],
        },
        needsVideo ? "WAN restyle from frame" : "WAN image to video",
      );
    }
  } else if (is5b) {
    prompt["21"] = node(
      "Wan22ImageToVideoLatent",
      { width: w, height: h, length: frames, batch_size: 1, vae: ["3", 0] },
      "WAN 5B latent",
    );
  } else {
    prompt["21"] = node(
      "EmptyHunyuanLatentVideo",
      { width: w, height: h, length: frames, batch_size: 1 },
      "Empty video latent",
    );
  }

  const wrapCond = startFrame && !is5b;
  const posRef: [string, number] = wrapCond ? ["21", 0] : pos;
  const negRef: [string, number] = wrapCond ? ["21", 1] : neg;
  const latentRef: [string, number] = wrapCond ? ["21", 2] : ["21", 0];

  if (dual) {
    prompt["30"] = node(
      "KSamplerAdvanced",
      {
        add_noise: "enable",
        noise_seed: args.seed,
        steps,
        cfg,
        sampler_name: "euler",
        scheduler: "simple",
        start_at_step: 0,
        end_at_step: split,
        return_with_leftover_noise: "enable",
        model: modelHigh,
        positive: posRef,
        negative: negRef,
        latent_image: latentRef,
      },
      "High noise",
    );
    prompt["34"] = node(
      "KSamplerAdvanced",
      {
        add_noise: "disable",
        noise_seed: args.seed,
        steps,
        cfg,
        sampler_name: "euler",
        scheduler: "simple",
        start_at_step: split,
        end_at_step: steps,
        return_with_leftover_noise: "disable",
        model: modelLow,
        positive: posRef,
        negative: negRef,
        latent_image: ["30", 0],
      },
      "Low noise",
    );
    prompt["31"] = node("VAEDecode", { samples: ["34", 0], vae: ["3", 0] }, "Decode");
  } else {
    prompt["30"] = node(
      "KSampler",
      {
        seed: args.seed,
        steps,
        cfg,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: args.mode === "v2v" ? args.denoise : 1,
        model: modelHigh,
        positive: posRef,
        negative: negRef,
        latent_image: latentRef,
      },
      "Sampler",
    );
    prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae: ["3", 0] }, "Decode");
  }

  if (args.mode === "v2i") {
    prompt["32"] = node("SaveImage", { filename_prefix: "ForgeStill", images: ["31", 0] }, "Save still");
  } else {
    prompt["32"] = node("CreateVideo", { images: ["31", 0], fps }, "Create video");
    prompt["33"] = node(
      "SaveVideo",
      { filename_prefix: "Forge", video: ["32", 0], format: "mp4", codec: "h264" },
      "Save video",
    );
  }
  return prompt;
}

export function i2iDenoise(denoise: number, structural: boolean) {
  const n = Number.isFinite(denoise) ? denoise : 0.38;
  if (n >= 0.95) return structural ? 0.52 : 0.38;
  if (structural) return Math.min(0.52, Math.max(0.40, n));
  return Math.min(0.38, Math.max(0.28, n));
}

export function validateApiGraph(graph: ApiPrompt): string[] {
  const errors: string[] = [];
  for (const id of Object.keys(graph)) {
    if (!/^\d+$/.test(id)) errors.push(`non-numeric node id ${id}`);
  }
  for (const [id, n] of Object.entries(graph)) {
    if (!n?.class_type) errors.push(`${id} missing class_type`);
    for (const [key, val] of Object.entries(n?.inputs ?? {})) {
      if (Array.isArray(val) && val.length === 2 && typeof val[0] === "string") {
        if (!graph[val[0]]) errors.push(`${id}.${key} → missing ${val[0]}`);
      }
    }
  }
  return errors;
}

export function rewireLoadImages(
  workflow: Record<string, { class_type?: string; inputs?: Record<string, unknown> }>,
  uploaded: Record<string, string>,
) {
  for (const node of Object.values(workflow)) {
    if (node.class_type !== "LoadImage" || !node.inputs) continue;
    const cur = node.inputs.image;
    if (typeof cur === "string" && uploaded[cur]) node.inputs.image = uploaded[cur];
  }
}

export function buildApiWorkflow(args: BuildArgs): ApiPrompt {
  const video =
    args.mode === "t2v" ||
    args.mode === "i2v" ||
    args.mode === "ref2v" ||
    args.mode === "v2v" ||
    args.mode === "v2i";
  const graph = video
    ? wanVideo(args)
    : args.settings.stillLoader === "flux-unet" || guessArch(args.settings.checkpoint || args.settings.fluxUnet || "") === "flux"
      ? fluxStill(args)
      : args.mode === "i2i"
        ? sdxlInpaint(args)
        : sdxlStill(args);
  return stripBrokenLoraNodes(graph);
}

export function apiToUiWorkflow(api: ApiPrompt, name: string) {
  const ids = Object.keys(api);
  const nodes: unknown[] = [];
  const links: unknown[] = [];
  let linkId = 1;
  const outMap = new Map<string, number[]>();

  ids.forEach((id, index) => {
    const n = api[id]!;
    const widgetValues: unknown[] = [];
    const inputs: { name: string; type: string; link: number | null }[] = [];
    Object.entries(n.inputs).forEach(([key, val]) => {
      if (Array.isArray(val) && val.length === 2 && typeof val[0] === "string") {
        const fromId = Number(val[0]);
        const fromSlot = Number(val[1]);
        const lid = linkId++;
        links.push([lid, fromId, fromSlot, Number(id), inputs.length, "*"]);
        inputs.push({ name: key, type: "*", link: lid });
        const arr = outMap.get(String(val[0])) ?? [];
        arr.push(lid);
        outMap.set(String(val[0]), arr);
      } else {
        widgetValues.push(val);
      }
    });
    nodes.push({
      id: Number(id),
      type: n.class_type,
      pos: [80 + (index % 4) * 320, 80 + Math.floor(index / 4) * 180],
      size: [280, 110],
      flags: {},
      order: index,
      mode: 0,
      inputs,
      outputs: [{ name: "OUT", type: "*", links: outMap.get(id) ?? [], slot_index: 0 }],
      title: n._meta?.title,
      properties: { "Node name for S&R": n.class_type },
      widgets_values: widgetValues,
    });
  });

  return {
    last_node_id: Math.max(...ids.map(Number), 1),
    last_link_id: linkId,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {
      ds: { scale: 0.7, offset: [0, 0] },
      forge: { name, embedded: true },
    },
    version: 0.4,
  };
}

export function isQualityLora(filename: string) {
  const n = (filename || "").replace(/\\/g, "/").split("/").pop()?.toLowerCase() || "";
  if (/hand.?fix|finger.?fix/.test(n) && !/detail/.test(n)) return false;
  return /add[_-]?detail|more[_-]?details|detail[_-]?(slider|enhanc)|bss[_-]?detail/.test(n);
}

export function matchNamedLoras(
  prompt: string,
  loras: LoraEntry[],
  family: ModelFamily,
  ckptName?: string,
): LoraEntry[] {
  const words = promptNameWords(prompt);
  if (!words.length) return [];
  const hits: LoraEntry[] = [];
  for (const l of loras) {
    if (isQualityLora(l.filename)) continue;
    if (!loraFitsCheckpoint(l.filename, family, ckptName)) continue;
    const keys = [
      ...loraNameKeys(l.filename),
      ...loraNameKeys(l.name),
      ...l.triggerWords.map((t) => t.toLowerCase()),
    ];
    if (words.some((w) => wordHitsLoraName(w, keys))) hits.push(l);
  }
  return hits.slice(0, 2);
}

function conceptHitsPrompt(l: LoraEntry, prompt: string) {
  const words = promptNameWords(prompt);
  const keys = [
    ...loraNameKeys(l.filename),
    ...loraNameKeys(l.name),
    ...l.triggerWords.map((t) => t.toLowerCase()),
  ];
  return words.some((w) => wordHitsLoraName(w, keys));
}

export function pickLorasForPrompt(
  prompt: string,
  loras: LoraEntry[],
  family: ModelFamily,
  ckptName?: string,
): { ok: LoraEntry[]; named: LoraEntry[]; dropped: LoraEntry[]; blocked: LoraEntry[] } {
  const pool = loras.filter((l) => !isNotALora(l.filename));
  const enabled = pool.filter((l) => l.enabled);
  const blocked = enabled.filter((l) => !loraFitsCheckpoint(l.filename, family, ckptName));
  const fitOn = enabled.filter((l) => loraFitsCheckpoint(l.filename, family, ckptName));
  const named = matchNamedLoras(prompt, pool, family, ckptName);
  const quality = fitOn.filter((l) => {
    if (!isQualityLora(l.filename)) return false;
    return guessLoraLane(l.filename) !== "any";
  });
  const concept = fitOn.filter(
    (l) => !isQualityLora(l.filename) && !named.some((n) => n.filename === l.filename) && conceptHitsPrompt(l, prompt),
  );
  const cap = (l: LoraEntry, max: number): LoraEntry => ({
    ...l,
    enabled: true,
    unetStrength: Math.min(l.unetStrength || 0.8, max),
    clipStrength: Math.min(l.clipStrength || 0.8, max),
  });
  const ok: LoraEntry[] = [];
  const seen = new Set<string>();
  const push = (l: LoraEntry, max: number) => {
    if (seen.has(l.filename) || ok.length >= 3) return;
    seen.add(l.filename);
    ok.push(cap(l, max));
  };
  for (const l of named) push(l, 0.7);
  for (const l of quality) push(l, 0.55);
  for (const l of concept) push(l, 0.8);
  return {
    ok,
    named,
    dropped: fitOn.filter((l) => !ok.some((o) => o.filename === l.filename)),
    blocked,
  };
}

export function compatibleLoras(
  loras: LoraEntry[],
  mode: Mode,
  family: ModelFamily,
) {
  const videoOut = ["t2v", "i2v", "ref2v", "v2v"].includes(mode);
  const want: ModelFamily = videoOut ? "wan" : family === "wan" ? "wan" : family;
  const enabled = loras.filter((l) => l.enabled);
  const fits = (l: LoraEntry) => loraFitsCheckpoint(l.filename, want);
  return { ok: enabled.filter(fits), blocked: enabled.filter((l) => !fits(l)), family: want };
}

export function triggerPrefix(loras: LoraEntry[], prompt: string) {
  const missing = loras
    .filter((l) => l.enabled && l.triggerWords.length)
    .flatMap((l) => l.triggerWords)
    .map((w) => w.trim())
    .filter((w) => w && w.length <= 32 && w.split(/\s+/).length <= 3)
    .filter((w) => !prompt.toLowerCase().includes(w.toLowerCase()));
  if (!missing.length) return prompt;
  return `${missing.join(", ")}, ${prompt}`;
}

export function stripBrokenLoraNodes(prompt: ApiPrompt): ApiPrompt {
  const ids = Object.keys(prompt).filter((id) => {
    const n = prompt[id];
    if (!n || !/lora/i.test(n.class_type || "")) return false;
    return isNotALora(String(n.inputs?.lora_name || ""));
  });
  for (const id of ids) {
    const n = prompt[id];
    if (!n) continue;
    const modelIn = n.inputs.model;
    const clipIn = n.inputs.clip;
    delete prompt[id];
    for (const other of Object.values(prompt)) {
      for (const [k, v] of Object.entries(other.inputs)) {
        if (!Array.isArray(v) || v[0] !== id) continue;
        other.inputs[k] = v[1] === 1 && clipIn ? clipIn : modelIn;
      }
    }
  }
  return prompt;
}

export function jobBasename(job: Job) {
  return `forge-${job.mode}-${job.id.slice(0, 8)}`;
}
