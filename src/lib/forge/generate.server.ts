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
import { applyArtWrap, applyQualityOffers, qualityWantsHires } from "./looks";
import { buildApiWorkflow, pickLorasForPrompt, rewireLoadImages, triggerPrefix, i2iDenoise } from "./workflows";
import { grokExpand, grokMotion } from "./wildcards";
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
  checkpoint?: string;
  settings?: Partial<ComfySettings>;
  images?: { filename: string; dataUrl: string }[];
  loras?: LoraEntry[];
};

export async function runGenerateIntent(intent: GenerateIntent) {
  const promptIn = (intent.prompt || "").trim();
  if (!promptIn) return { ok: false as const, message: "Type a prompt first." };

  const status = await probeComfy("http://127.0.0.1:8188");
  if (!status.ok) {
    return { ok: false as const, message: status.message || "Comfy is off on the PC. Start it, then tap Generate again." };
  }

  const ckpts = (status.checkpoints || []).filter(isRealCheckpoint);
  const ckpt =
    (intent.checkpoint && ckpts.includes(intent.checkpoint) && intent.checkpoint) ||
    (intent.settings?.checkpoint && ckpts.includes(intent.settings.checkpoint) && intent.settings.checkpoint) ||
    ckpts[0] ||
    "";
  if (!ckpt && intent.mode !== "t2v" && intent.mode !== "i2v" && intent.mode !== "ref2v" && intent.mode !== "v2v") {
    return { ok: false as const, message: "No checkpoints on the PC. Comfy must see models/checkpoints." };
  }

  const rec = ckpt ? settingsForCheckpoint(ckpt) : DEFAULT_COMFY;
  const settings: ComfySettings = {
    ...DEFAULT_COMFY,
    ...rec,
    ...intent.settings,
    checkpoint: ckpt || intent.settings?.checkpoint || "",
    baseUrl: "http://127.0.0.1:8188",
  };

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
  const wrapped = i2i
    ? promptIn
    : applyQualityOffers(applyArtWrap(promptIn, intent.artWrap || "none"), intent.quality || []);
  if (!i2i && qualityWantsHires(intent.quality || [])) settings.hires = true;
  const sent = video
    ? grokMotion(wrapped, intent.mode === "i2v" || intent.mode === "ref2v" ? "still-lock" : "invent")
    : i2i
      ? /same art style/i.test(promptIn)
        ? promptIn
        : `${promptIn}, same art style, same rendering, same lighting, same colors, same camera, do not restyle, only the requested edit`
      : grokExpand({
          typed: wrapped,
          files: [],
          seed: intent.seed || 1,
          checkpoint: settings.checkpoint,
          roll: intent.roll || "normal",
        });
  const loraCkpt = video ? settings.wanUnet || settings.checkpoint : settings.checkpoint;
  const stacked = pickLorasForPrompt(
    i2i ? "" : promptIn,
    intent.loras ?? [],
    guessArch(loraCkpt),
    loraCkpt,
  ).ok;
  const finalPrompt = triggerPrefix(stacked, sent);
  const neg = generateNegative(intent.negative || "", settings.checkpoint, finalPrompt, intent.negLocked);

  const images = intent.images ?? [];
  const denoise = i2i
    ? i2iDenoise(
        intent.denoise ?? 0.42,
        /\b(remove|undress|take off|strip|add |change |replace |delete |put on|clothes|shirt|dress|nude|naked)\b/i.test(
          promptIn,
        ),
      )
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
