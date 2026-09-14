import type { Aspect, ComfySettings, Job, LoraEntry, Mode } from "./types";
import { ASPECT_SIZE } from "./types";

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
};

function node(
  class_type: string,
  inputs: Record<string, unknown>,
  title: string,
): ApiNode {
  return { class_type, inputs, _meta: { title } };
}

function chainLoras(
  loras: LoraEntry[],
  modelRef: [string, number],
  clipRef: [string, number] | null,
): { model: [string, number]; clip: [string, number] | null; nodes: ApiPrompt; nextId: number } {
  const nodes: ApiPrompt = {};
  let model = modelRef;
  let clip = clipRef;
  let id = 40;
  for (const l of loras.filter((x) => x.enabled)) {
    const nid = String(id++);
    if (clip) {
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

function fluxStill(args: BuildArgs): ApiPrompt {
  const { w, h } = ASPECT_SIZE[args.aspect];
  const s = args.settings;
  const prompt: ApiPrompt = {
    "1": node(
      "UNETLoader",
      { unet_name: s.fluxUnet, weight_dtype: "fp8_e4m3fn" },
      "Flux UNET",
    ),
    "2": node(
      "DualCLIPLoader",
      {
        clip_name1: s.fluxClipL,
        clip_name2: s.fluxT5,
        type: "flux",
      },
      "Flux CLIP",
    ),
    "3": node("VAELoader", { vae_name: s.fluxVae }, "Flux VAE"),
  };

  const chained = chainLoras(args.loras, ["1", 0], ["2", 0]);
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  const clip = chained.clip ?? ["2", 0];

  prompt["10"] = node("CLIPTextEncode", { text: args.prompt, clip }, "Positive");
  prompt["11"] = node("CLIPTextEncode", { text: args.negative, clip }, "Negative");
  prompt["12"] = node(
    "FluxGuidance",
    { guidance: s.fluxGuidance, conditioning: ["10", 0] },
    "Flux guidance",
  );

  const i2i = args.mode === "i2i" || args.mode === "ref2i";
  if (i2i) {
    prompt["20"] = node("LoadImage", { image: "forge_input_0.png" }, "Input still");
    prompt["21"] = node("VAEEncode", { pixels: ["20", 0], vae: ["3", 0] }, "Encode");
  } else {
    prompt["21"] = node(
      "EmptySD3LatentImage",
      { width: w, height: h, batch_size: 1 },
      "Empty latent",
    );
  }

  if (args.mode === "ref2i") {
    for (let i = 1; i < Math.max(args.imageCount, 2); i++) {
      prompt[String(22 + i)] = node(
        "LoadImage",
        { image: `forge_input_${i}.png` },
        `Reference ${i + 1}`,
      );
    }
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
      negative: ["11", 0],
      latent_image: ["21", 0],
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae: ["3", 0] }, "Decode");
  prompt["32"] = node("SaveImage", { filename_prefix: "Forge", images: ["31", 0] }, "Save");
  return prompt;
}

function sdxlStill(args: BuildArgs): ApiPrompt {
  const { w, h } = ASPECT_SIZE[args.aspect];
  const s = args.settings;
  const prompt: ApiPrompt = {
    "1": node("CheckpointLoaderSimple", { ckpt_name: s.sdxlCheckpoint }, "SDXL checkpoint"),
  };
  const chained = chainLoras(args.loras, ["1", 0], ["1", 1]);
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  const clip = chained.clip ?? ["1", 1];
  prompt["10"] = node("CLIPTextEncode", { text: args.prompt, clip }, "Positive");
  prompt["11"] = node("CLIPTextEncode", { text: args.negative, clip }, "Negative");
  const i2i = args.mode === "i2i" || args.mode === "ref2i";
  if (i2i) {
    prompt["20"] = node("LoadImage", { image: "forge_input_0.png" }, "Input still");
    prompt["21"] = node("VAEEncode", { pixels: ["20", 0], vae: ["1", 2] }, "Encode");
  } else {
    prompt["21"] = node(
      "EmptyLatentImage",
      { width: w, height: h, batch_size: 1 },
      "Empty latent",
    );
  }
  prompt["30"] = node(
    "KSampler",
    {
      seed: args.seed,
      steps: Math.max(s.steps, 24),
      cfg: 5,
      sampler_name: "dpmpp_2m",
      scheduler: "karras",
      denoise: i2i ? args.denoise : 1,
      model,
      positive: ["10", 0],
      negative: ["11", 0],
      latent_image: ["21", 0],
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae: ["1", 2] }, "Decode");
  prompt["32"] = node("SaveImage", { filename_prefix: "Forge", images: ["31", 0] }, "Save");
  return prompt;
}

function wanVideo(args: BuildArgs): ApiPrompt {
  const { w, h } = ASPECT_SIZE[args.aspect];
  const s = args.settings;
  const prompt: ApiPrompt = {
    "1": node(
      "UNETLoader",
      { unet_name: s.wanUnet, weight_dtype: "fp8_e4m3fn" },
      "WAN UNET",
    ),
    "2": node("CLIPLoader", { clip_name: s.wanClip, type: "wan" }, "WAN CLIP"),
    "3": node("VAELoader", { vae_name: s.wanVae }, "WAN VAE"),
  };
  const chained = chainLoras(args.loras, ["1", 0], null);
  Object.assign(prompt, chained.nodes);
  const model = chained.model;
  prompt["10"] = node("CLIPTextEncode", { text: args.prompt, clip: ["2", 0] }, "Positive");
  prompt["11"] = node("CLIPTextEncode", { text: args.negative, clip: ["2", 0] }, "Negative");

  const needsImage = args.mode === "i2v" || args.mode === "ref2v";
  const needsVideo = args.mode === "v2v" || args.mode === "v2i";

  if (needsImage) {
    prompt["20"] = node("LoadImage", { image: "forge_input_0.png" }, "First frame");
    prompt["21"] = node(
      "WanImageToVideo",
      {
        width: w,
        height: h,
        length: s.videoFrames,
        batch_size: 1,
        positive: ["10", 0],
        negative: ["11", 0],
        vae: ["3", 0],
        start_image: ["20", 0],
      },
      "WAN image to video",
    );
  } else if (needsVideo) {
    prompt["20"] = node("LoadImage", { image: "forge_frame_0.png" }, "Source frame");
    prompt["21"] = node(
      "WanImageToVideo",
      {
        width: w,
        height: h,
        length: s.videoFrames,
        batch_size: 1,
        positive: ["10", 0],
        negative: ["11", 0],
        vae: ["3", 0],
        start_image: ["20", 0],
      },
      "WAN restyle from frame",
    );
  } else {
    prompt["21"] = node(
      "EmptyHunyuanLatentVideo",
      { width: w, height: h, length: s.videoFrames, batch_size: 1 },
      "Empty video latent",
    );
  }

  prompt["30"] = node(
    "KSampler",
    {
      seed: args.seed,
      steps: Math.max(s.steps, 20),
      cfg: 6,
      sampler_name: "uni_pc",
      scheduler: "simple",
      denoise: args.mode === "v2v" ? args.denoise : 1,
      model,
      positive: needsImage || needsVideo ? ["21", 0] : ["10", 0],
      negative: needsImage || needsVideo ? ["21", 1] : ["11", 0],
      latent_image: needsImage || needsVideo ? ["21", 2] : ["21", 0],
    },
    "Sampler",
  );
  prompt["31"] = node("VAEDecode", { samples: ["30", 0], vae: ["3", 0] }, "Decode");

  if (args.mode === "v2i") {
    prompt["32"] = node("SaveImage", { filename_prefix: "ForgeStill", images: ["31", 0] }, "Save still");
  } else {
    prompt["32"] = node(
      "CreateVideo",
      { images: ["31", 0], fps: s.videoFps },
      "Create video",
    );
    prompt["33"] = node(
      "SaveVideo",
      { filename_prefix: "Forge", video: ["32", 0], format: "mp4", codec: "h264" },
      "Save video",
    );
  }
  return prompt;
}

export function buildApiWorkflow(args: BuildArgs): ApiPrompt {
  if (args.mode === "t2v" || args.mode === "i2v" || args.mode === "ref2v" || args.mode === "v2v" || args.mode === "v2i") {
    return wanVideo(args);
  }
  if (args.settings.stillFamily === "sdxl") return sdxlStill(args);
  return fluxStill(args);
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

export function compatibleLoras(loras: LoraEntry[], mode: Mode, stillFamily: "flux" | "sdxl") {
  const videoOut = ["t2v", "i2v", "ref2v", "v2v"].includes(mode);
  const family = videoOut ? "wan" : stillFamily;
  const enabled = loras.filter((l) => l.enabled);
  const ok = enabled.filter((l) => l.family === family);
  const blocked = enabled.filter((l) => l.family !== family);
  return { ok, blocked, family };
}

export function triggerPrefix(loras: LoraEntry[], prompt: string) {
  const missing = loras
    .filter((l) => l.enabled && l.triggerWords.length)
    .flatMap((l) => l.triggerWords)
    .filter((w) => w && !prompt.toLowerCase().includes(w.toLowerCase()));
  if (!missing.length) return prompt;
  return `${missing.join(", ")}, ${prompt}`;
}

export function jobBasename(job: Job) {
  return `forge-${job.mode}-${job.id.slice(0, 8)}`;
}
