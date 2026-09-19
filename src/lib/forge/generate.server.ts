import {
  DEFAULT_COMFY,
  MODE_META,
  guessArch,
  generateNegative,
  isRealCheckpoint,
  isWanUnet,
  pickPlayUnet,
  pickT2vUnet,
  pickWanClip,
  pickWanVae,
  pairWanUnets,
  settingsForCheckpoint,
  type Aspect,
  type ComfySettings,
  type LoraEntry,
  type Mode,
} from "./types";
import { applyArtWrap, applyQualityOffers, qualityWantsHires, stripComicPageTalk } from "./looks";
import { buildApiWorkflow, pickLorasForPrompt, rewireLoadImages, triggerPrefix, i2iDenoise, combineDenoise } from "./workflows";
import { flattenPrompt, grokExpand, isShortSubject } from "./wildcards";
import { probeComfy, queuePrompt, uploadToComfy } from "./comfy.server";

export type GenerateIntent = {
  prompt: string;
  negative?: string;
  negLocked?: boolean;
  seed: number;
  mode: Mode;
  aspect?: Aspect;
  denoise?: number;
  artWrap?: string;
  quality?: string[];
  roll?: "normal" | "random";
  nsfwMode?: boolean;
  checkpoint?: string;
  settings?: Partial<ComfySettings>;
  images?: { filename: string; dataUrl: string }[];
  loras?: LoraEntry[];
  inputW?: number;
  inputH?: number;
};

/** Only files that never contain CLIP. Do not treat Illustrious / Pony / Anima / Krea XL as dead. */
export function stillHasClip(name: string) {
  const n = (name || "").toLowerCase().replace(/\\/g, "/");
  const base = n.split("/").pop() || n;
  if (!base) return false;
  if (!isRealCheckpoint(base) && !isRealCheckpoint(name)) return false;
  if (/hunyuan3d|triposr|lumina|nextdit|next-dit|svd_xt|\bsvd\b|dit-v2|qwen_image|text.?encoder|t5xxl|umt5|gemma4|gemma_/i.test(base))
    return false;
  if (/\.gguf$/i.test(base)) return false;
  if (/^(ae|clip_l|clip_g)\.safetensors$/i.test(base)) return false;
  if (/flux1[-_.]?(dev|schnell)|flux-unet|flux_unet/i.test(base) && !/xl|pony|illustrious|anima/i.test(base))
    return false;
  if (/_unet|unet_only|diffusion_pytorch/i.test(base) && !/xl|pony|illustrious|sd15|checkpoint/i.test(base))
    return false;
  return true;
}

function pickSafeCkpt(want: string, list: string[]) {
  if (want && list.includes(want) && stillHasClip(want)) return want;
  if (want && list.includes(want)) {
    /* user picked a known-dead file — fall through */
  } else if (want && list.includes(want)) {
    return want;
  }
  const safe = list.filter(stillHasClip);
  if (want) {
    const base = want.replace(/\\/g, "/").split("/").pop() || want;
    const hit = safe.find((n) => n === want || n.endsWith("/" + base) || n === base);
    if (hit) return hit;
  }
  return safe[0] || (list[0] ?? "");
}

export async function runGenerateIntent(intent: GenerateIntent) {
  const promptIn = (intent.prompt || "").trim();
  if (!promptIn) return { ok: false as const, message: "Type a prompt first." };

  const status = await probeComfy("http://127.0.0.1:8188");
  if (!status.ok) {
    return { ok: false as const, message: status.message || "Comfy is off on the PC. Start it, then tap Generate again." };
  }

  const ckpts = (status.checkpoints || []).filter(isRealCheckpoint);
  const asked = intent.checkpoint || intent.settings?.checkpoint || "";
  const archAsked = asked ? guessArch(asked) : "sdxl";
  let ckpt = "";
  if (asked && ckpts.includes(asked) && stillHasClip(asked)) {
    ckpt = asked;
  } else if (archAsked === "flux" && asked && ckpts.includes(asked)) {
    ckpt = asked;
  } else {
    ckpt = pickSafeCkpt(asked, ckpts);
  }
  if (!ckpt && intent.mode !== "t2v" && intent.mode !== "i2v" && intent.mode !== "ref2v" && intent.mode !== "v2v") {
    return {
      ok: false as const,
      message:
        asked && !stillHasClip(asked)
          ? `${asked.split("/").pop()} has no CLIP. Pick a full XL / Pony / Illustrious / 1.5 mix.`
          : "No usable image checkpoint on the PC.",
    };
  }

  const rec = ckpt ? settingsForCheckpoint(ckpt) : DEFAULT_COMFY;
  const settings: ComfySettings = {
    ...DEFAULT_COMFY,
    ...rec,
    ...intent.settings,
    checkpoint: ckpt,
    baseUrl: "http://127.0.0.1:8188",
  };
  if (guessArch(ckpt) === "flux") {
    settings.stillLoader = /unet|diffusion/.test(ckpt.toLowerCase()) ? "flux-unet" : settings.stillLoader;
    settings.stillFamily = "flux";
    settings.fluxUnet = ckpt;
  }

  const video = MODE_META[intent.mode]?.video;
  if (video) {
    const unets = status.unets || [];
    const wan =
      intent.mode === "t2v"
        ? pickT2vUnet(settings.wanUnet, unets)
        : pickPlayUnet(settings.wanUnet, unets);
    if (!wan || !isWanUnet(wan)) {
      return { ok: false as const, message: "No WAN video model on the PC. Put wan2.1*.safetensors in models/diffusion_models." };
    }
    const pair = pairWanUnets(wan, unets);
    if (pair.error) return { ok: false as const, message: pair.error };
    settings.wanUnet = pair.high || pair.single || wan;
    settings.wanUnetLow = pair.low;
    settings.wanVae = pickWanVae(settings.wanUnet, status.vaes || [], settings.wanVae);
    settings.wanClip = pickWanClip(status.clips || [], settings.wanClip);
    if (!settings.wanVae) return { ok: false as const, message: "No WAN VAE on the PC." };
    if (!settings.wanClip) return { ok: false as const, message: "No umt5 / WAN CLIP on the PC." };
  }

  const i2i = intent.mode === "i2i";
  const combining = intent.mode === "ref2i";
  const comicJob = /\bpanel 1\b/i.test(promptIn);
  const wrapped = i2i
    ? promptIn
    : applyQualityOffers(
        applyArtWrap(promptIn, intent.artWrap === "comic" || intent.artWrap === "manga" ? "none" : intent.artWrap || "none"),
        (intent.quality || []).filter((id) => id !== "splash"),
      );
  if (!i2i && !combining && qualityWantsHires(intent.quality || [])) settings.hires = true;
  const stillPrompt = comicJob ? wrapped : stripComicPageTalk(wrapped);
  const sent = combining
    ? /\bsame person\b|one character/i.test(promptIn)
      ? stripComicPageTalk(promptIn)
      : `one photograph, the people from every reference photo together in the same place, keep their faces, sharp focus, detailed faces, not a collage, not a split screen, not a grid, ${stripComicPageTalk(promptIn)}`
    : i2i
    ? /same art style/i.test(promptIn)
      ? promptIn
      : `${promptIn}, same art style, same rendering, same lighting, same colors, same camera, do not restyle, only the requested edit`
    : flattenPrompt(
        isShortSubject(stillPrompt) && !/\{[^{}|]+\|/.test(stillPrompt)
          ? grokExpand({
              typed: stillPrompt,
              files: [],
              seed: intent.seed || 1,
              checkpoint: ckpt,
              nsfwMode: intent.nsfwMode,
              roll: intent.roll,
            })
          : stillPrompt,
        intent.seed || 1,
      );
  const loraCkpt = video ? settings.wanUnet || settings.checkpoint : settings.checkpoint;
  const picked = pickLorasForPrompt(
    promptIn,
    intent.loras ?? [],
    guessArch(loraCkpt),
    loraCkpt,
  );
  const stacked = i2i ? picked.named.slice(0, 2) : picked.ok;
  const finalPrompt = triggerPrefix(stacked, sent);
  const negBase = generateNegative(intent.negative || "", settings.checkpoint, finalPrompt, intent.negLocked);
  const neg =
    i2i && !intent.negLocked
      ? `${negBase}, different person, different face, restyle, different art style, extra people, extra limbs`.replace(/^, /, "")
      : negBase;

  const images = intent.images ?? [];
  const denoise = i2i
    ? i2iDenoise(
        intent.denoise ?? 0.38,
        /\b(remove|undress|take off|strip|add |change |replace |delete |put on|clothes|shirt|dress|nude|naked)\b/i.test(
          promptIn,
        ),
      )
    : combining
      ? combineDenoise(intent.denoise ?? 0.58, intent.images?.length || 2, settings.lockFaces)
      : (intent.denoise ?? 0.65);
  const api = buildApiWorkflow({
    mode: intent.mode,
    prompt: finalPrompt,
    negative: neg,
    seed: intent.seed || Math.floor(Math.random() * 1_000_000_000),
    aspect: intent.aspect || "1:1",
    denoise,
    loras: stacked,
    settings,
    imageCount: images.length,
    hasVideo: false,
    inputW: intent.inputW,
    inputH: intent.inputH,
  });

  for (const img of images) {
    const name = await uploadToComfy("http://127.0.0.1:8188", img.dataUrl, img.filename);
    rewireLoadImages(api, { [img.filename]: name });
  }

  const { promptId } = await queuePrompt("http://127.0.0.1:8188", api, "forge-phone");
  return {
    ok: true as const,
    promptId,
    checkpoint: settings.checkpoint,
    prompt: finalPrompt,
    negative: neg,
    seed: intent.seed,
    workflow: api,
  };
}
