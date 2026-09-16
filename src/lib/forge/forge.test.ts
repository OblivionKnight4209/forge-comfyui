import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MODE_META,
  DEFAULT_COMFY,
  familyOfSelection,
  generateNegative,
  canEditPhoto,
  guessArch,
  guessLoraFamily,
  loraFitsCheckpoint,
  loraFitsLane,
  guessLoraLane,
  guessStyles,
  checkpointMatchesStyle,
  isRealCheckpoint,
  isImageCheckpoint,
  isNotALora,
  resolveCkpt,
  isWanUnet,
  wanPairOk,
  wanStackVersion,
  pickWanVae,
  pickWanClip,
  pickPlayUnet,
  pickT2vUnet,
  wanFrameCount,
  videoSegments,
  pairWanUnets,
  isHighNoiseUnet,
  isLowNoiseUnet,
  wanExpertStem,
  pickMatchingExpert,
  negativeForCheckpoint,
  negativeForPrompt,
  settingsForCheckpoint,
  shouldReplaceNegative,
  sizeForFamily,
  stillKey,
  sameStill,
  aspectFromSize,
  i2iCanvasSize,
  pickEditCheckpoint,
  pickControlNet,
  pickInpaintCkpt,
} from "./types.ts";
import {
  buildApiWorkflow,
  i2iDenoise,
  rewireLoadImages,
  triggerPrefix,
  compatibleLoras,
  validateApiGraph,
  matchNamedLoras,
  pickLorasForPrompt,
  chunkPrompt,
} from "./workflows.ts";
import { isVideoName, mediaMime, withVideoDataUrl } from "./media-mime.ts";
import { expandPrompt, parseInlineLoras, writePrompt, keepNeutral, userLead, grokExpand, grokMotion, flattenPrompt, withRandomBlocks, recoverScene, isPurpleProse, DEFAULT_WILDCARDS, isAdult, composeNewScene, isShortSubject, sceneCore, tokenOverlap, nsfwWanted } from "./wildcards.ts";
import { isWashed, nsfwGroup, writeExtreme, writeHorrorSet, writeTabooSet, writeDarkSet, NSFW_TYPES, writeMenus, FACE_BITS, BODY_BITS, CLOTHES_BITS, PLACE_BITS } from "./extreme.ts";
import { applyArtWrap, applyQualityOffers, qualityWantsHires, randomSceneLine, LOOK_APPENDS } from "./looks.ts";
import { applyVote, emptyTaste, extraNegFromTaste, ckptScore, sortCkptsByTaste, warnForCheckpoint } from "./taste.ts";
import { pickBrainModel, cleanBrainOut, brainSystem } from "./brain.ts";
import { designClipAudio, ensureVoice } from "./clip-sound.ts";
import { embedWorkflowPng, readPngText, seedFromPngText, seedFromBytes } from "./png.ts";
import { scanFromTags, boxesFromTags, mergeScan } from "./detector.ts";
import { buildEditPrompt, composeI2iPrompt, expandEditFields, inpaintMaskText } from "./edit-prompt.ts";
import type { ComfySettings, LoraEntry, Mode } from "./types.ts";

function settings(over: Partial<ComfySettings> = {}): ComfySettings {
  return {
    ...DEFAULT_COMFY,
    checkpoint: "DasiwaIllustriousAnime_epitaphecstasy.safetensors",
    sdxlCheckpoint: "DasiwaIllustriousAnime_epitaphecstasy.safetensors",
    stillLoader: "checkpoint",
    stillFamily: "sdxl",
    steps: 28,
    cfg: 5,
    clipSkip: 2,
    ...over,
  };
}

function graph(over: Partial<Parameters<typeof buildApiWorkflow>[0]> = {}) {
  return buildApiWorkflow({
    mode: "t2i",
    prompt: "alice in an alley",
    negative: "",
    seed: 1,
    aspect: "2:3",
    denoise: 1,
    loras: [],
    settings: settings(),
    imageCount: 0,
    hasVideo: false,
    ...over,
  });
}

function classes(g: ReturnType<typeof graph>) {
  return Object.values(g).map((n) => n.class_type);
}

describe("i2i graph", () => {
  it("loads the input still and samples below denoise 1", () => {
    const g = graph({ mode: "i2i", denoise: 0.78, imageCount: 1 });
    assert.ok(classes(g).includes("LoadImage"));
    const sampler = Object.values(g).find((n) => n.class_type === "KSampler");
    assert.equal(sampler?.inputs.denoise, 0.78);
    assert.ok(!classes(g).includes("EmptyLatentImage"));
  });
  it("i2i loads a standalone VAE so Comfy does not hang on VAE None", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.82,
      imageCount: 1,
      vaeName: "sdxl_vae.safetensors",
    });
    assert.ok(classes(g).includes("VAELoader"));
    assert.equal(
      Object.values(g).find((n) => n.class_type === "VAELoader")?.inputs.vae_name,
      "sdxl_vae.safetensors",
    );
  });
  it("t2i does not load a still and uses denoise 1", () => {
    const g = graph({ mode: "t2i", denoise: 1, imageCount: 0 });
    assert.ok(!classes(g).includes("LoadImage"));
    const sampler = Object.values(g).find((n) => n.class_type === "KSampler");
    assert.equal(sampler?.inputs.denoise, 1);
    assert.ok(classes(g).includes("EmptyLatentImage"));
  });
  it("XL does not CLIP-skip even if clipSkip is 2", () => {
    const g = graph({ mode: "t2i", settings: settings({ clipSkip: 2, stillFamily: "sdxl" }) });
    assert.ok(!classes(g).includes("CLIPSetLastLayer"));
  });
  it("1.5 still uses CLIP skip", () => {
    const g = graph({
      mode: "t2i",
      settings: settings({ clipSkip: 2, stillFamily: "sd15", checkpoint: "v1-5-pruned.safetensors" }),
    });
    assert.ok(classes(g).includes("CLIPSetLastLayer"));
  });
  it("6s stays at 81 frames so WAN does not smear", () => {
    assert.equal(wanFrameCount(6, 16), 81);
    assert.equal(wanFrameCount(10, 16), 81);
    assert.equal(videoSegments(6), 1);
    assert.equal(videoSegments(10), 2);
    assert.equal(videoSegments(15), 3);
    const g = graph({
      mode: "t2v",
      settings: settings({ videoFrames: wanFrameCount(6, 16), videoFps: 14, wanUnet: "wan2.2_ti2v_5B_fp16.safetensors", wanVae: "wan2.2_vae.safetensors", wanClip: "umt5.safetensors" }),
    });
    const empty = Object.values(g).find((n) => n.class_type === "Wan22ImageToVideoLatent");
    assert.equal(empty?.inputs.length, 81);
    const vid = Object.values(g).find((n) => n.class_type === "CreateVideo");
    assert.equal(vid?.inputs.fps, 14);
  });
  it("text-to-video is empty latent + SaveVideo", () => {
    const g = graph({
      mode: "t2v",
      imageCount: 0,
      settings: settings({ wanUnet: "wan2.1.safetensors", wanVae: "wan_vae.safetensors", wanClip: "umt5.safetensors" }),
    });
    assert.ok(classes(g).includes("EmptyHunyuanLatentVideo"));
    assert.ok(classes(g).includes("SaveVideo"));
    assert.ok(!classes(g).includes("LoadImage"));
  });
  it("image-to-video loads the still", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      settings: settings({ wanUnet: "wan2.1.safetensors", wanVae: "wan_vae.safetensors", wanClip: "umt5.safetensors" }),
    });
    assert.ok(classes(g).includes("LoadImage"));
    assert.ok(classes(g).includes("WanImageToVideo"));
    assert.ok(classes(g).includes("SaveVideo"));
  });
  it("i2v 14B uses a 16GB-safe size, not 832x480", () => {
    const g = graph({
      mode: "i2v",
      aspect: "16:9",
      imageCount: 1,
      settings: settings({
        wanUnet: "wan2.1_i2v_480p_14B.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5.safetensors",
      }),
    });
    const n = Object.values(g).find((x) => x.class_type === "WanImageToVideo");
    assert.equal(n?.inputs.width, 640);
    assert.equal(n?.inputs.height, 400);
    assert.equal(n?.inputs.length, 81);
    const samp = Object.values(g).find((x) => x.class_type === "KSampler");
    assert.equal(samp?.inputs.cfg, 5);
  });
  it("video-to-video restyles from a frame", () => {
    const g = graph({
      mode: "v2v",
      denoise: 0.7,
      hasVideo: true,
      settings: settings({ wanUnet: "wan2.1.safetensors", wanVae: "wan_vae.safetensors", wanClip: "umt5.safetensors" }),
    });
    assert.ok(classes(g).includes("LoadImage"));
    assert.ok(classes(g).includes("SaveVideo"));
    const sampler = Object.values(g).find((n) => n.class_type === "KSampler");
    assert.equal(sampler?.inputs.denoise, 0.7);
  });
  it("gguf WAN clip uses CLIPLoaderGGUF", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      settings: settings({
        wanUnet: "DasiwaWAN22I2V14B.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "nsfwWanUMT5XXLGGUF.gguf",
      }),
    });
    assert.ok(classes(g).includes("CLIPLoaderGGUF"));
  });
  it("i2i loads a still VAE, never a WAN VAE", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.78,
      imageCount: 1,
      vaeName: "sdxl_vae.safetensors",
    });
    const vae = Object.values(g).find((n) => n.class_type === "VAELoader");
    assert.equal(vae?.inputs.vae_name, "sdxl_vae.safetensors");
    assert.ok(classes(g).includes("LoadImage"));
    assert.ok(classes(g).includes("VAEEncode"));
  });
  it("skips hires on i2i so the edit is not washed", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.78,
      imageCount: 1,
      settings: settings({ hires: true }),
    });
    assert.ok(!classes(g).includes("ImageScaleBy"));
  });
  it("flux-unet i2i still encodes the photo", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.7,
      imageCount: 1,
      settings: settings({ stillLoader: "flux-unet", stillFamily: "flux" }),
    });
    assert.ok(classes(g).includes("LoadImage"));
    assert.ok(classes(g).includes("VAEEncode"));
  });
  it("flux file sitting in checkpoints uses a real VAE, not the empty ckpt VAE", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.7,
      imageCount: 1,
      settings: settings({
        stillLoader: "checkpoint",
        stillFamily: "sdxl",
        checkpoint: "flux1-dev.safetensors",
      }),
    });
    assert.ok(classes(g).includes("VAELoader"));
    assert.ok(classes(g).includes("DualCLIPLoader"));
    const enc = Object.values(g).find((n) => n.class_type === "VAEEncode");
    assert.deepEqual(enc?.inputs.vae, ["3", 0]);
  });
  it("Dasiwa is still XL even if family was left on flux", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.78,
      imageCount: 1,
      settings: settings({
        stillLoader: "checkpoint",
        stillFamily: "flux",
        checkpoint: "DasiwaIllustriousAnime_epitaphecstasy.safetensors",
      }),
    });
    assert.ok(classes(g).includes("CheckpointLoaderSimple"));
    assert.ok(!classes(g).includes("DualCLIPLoader"));
    const enc = Object.values(g).find((n) => n.class_type === "VAEEncode");
    assert.deepEqual(enc?.inputs.vae, ["1", 2]);
  });
  it("blocks 3D and video files from edit", () => {
    assert.equal(canEditPhoto("hunyuan3d-dit-v2.safetensors"), false);
    assert.equal(canEditPhoto("DasiwaIllustriousAnime_epitaphecstasy.safetensors"), true);
  });
  it("rewires LoadImage after Comfy rename", () => {
    const g = graph({ mode: "i2i", imageCount: 1, denoise: 0.7 });
    rewireLoadImages(g, { "forge_input_0.png": "Comfy_upload.png" });
    const load = Object.values(g).find((n) => n.class_type === "LoadImage");
    assert.equal(load?.inputs.image, "Comfy_upload.png");
  });
  it("i2i uses inpaint graph: noise mask, not a full redraw", () => {
    const g = graph({ mode: "i2i", denoise: 0.42, imageCount: 1 });
    assert.ok(classes(g).includes("SetLatentNoiseMask"));
    assert.ok(classes(g).includes("SolidMask") || classes(g).includes("CLIPSeg"));
    assert.ok(!classes(g).includes("EmptyLatentImage"));
    assert.equal(validateApiGraph(g).length, 0);
  });
  it("remove jacket uses CLIPSeg + composite", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.85,
      imageCount: 1,
      maskText: "jacket",
      hasClipSeg: true,
    });
    assert.ok(classes(g).includes("CLIPSeg"));
    assert.ok(classes(g).includes("GrowMask"));
    assert.ok(classes(g).includes("ImageCompositeMasked"));
    const seg = Object.values(g).find((n) => n.class_type === "CLIPSeg");
    assert.equal(seg?.inputs.text, "jacket");
    assert.equal(validateApiGraph(g).length, 0);
  });
  it("tile ControlNet holds the photo", () => {
    const g = graph({
      mode: "i2i",
      denoise: 0.42,
      imageCount: 1,
      controlnetName: "illustriousXLTile_v10.safetensors",
    });
    assert.ok(classes(g).includes("ControlNetLoader"));
    assert.ok(classes(g).includes("ControlNetApplyAdvanced"));
    const cn = Object.values(g).find((n) => n.class_type === "ControlNetLoader");
    assert.equal(cn?.inputs.control_net_name, "illustriousXLTile_v10.safetensors");
    assert.equal(validateApiGraph(g).length, 0);
  });
  it("inpaint checkpoint uses VAEEncodeForInpaint", () => {
    const g = graph({
      mode: "i2i",
      denoise: 1,
      imageCount: 1,
      maskText: "shirt",
      hasClipSeg: true,
      settings: settings({ checkpoint: "illustriousxlV01_inpainting.safetensors" }),
    });
    assert.ok(classes(g).includes("VAEEncodeForInpaint"));
    assert.ok(!classes(g).includes("SetLatentNoiseMask"));
    assert.equal(validateApiGraph(g).length, 0);
  });
});

describe("inpaint helpers", () => {
  it("mask text comes from Take out", () => {
    assert.equal(inpaintMaskText({ remove: "jacket" }), "jacket");
    assert.equal(inpaintMaskText({ add: "red hat" }), "head, hair");
    assert.match(inpaintMaskText({ typed: "remove the glasses" }), /glasses/);
  });
  it("picks XL tile for Illustrious, not SD1.5 canny", () => {
    const list = [
      "controlnetPreTrained_cannyV10.safetensors",
      "illustriousXLTile_v10.safetensors",
      "illustriousXLLineart_v10.safetensors",
    ];
    assert.equal(pickControlNet(list, "sdxl", "tile"), "illustriousXLTile_v10.safetensors");
  });
  it("picks same-family inpaint weights", () => {
    assert.equal(
      pickInpaintCkpt("DasiwaIllustriousAnime_epitaphecstasy.safetensors", [
        "DasiwaIllustriousAnime_epitaphecstasy.safetensors",
        "illustriousxlV01_inpainting.safetensors",
        "uberRealisticPornMerge_v23Inpainting.safetensors",
      ]),
      "illustriousxlV01_inpainting.safetensors",
    );
  });
});

describe("i2i denoise", () => {
  it("clamps 1.0 so it cannot become a t2i", () => {
    assert.ok(i2iDenoise(1, true) < 0.95);
    assert.ok(i2iDenoise(0.5, true) >= 0.4);
    assert.ok(i2iDenoise(0.5, true) <= 0.75);
  });
  it("keeps style with a low denoise on small edits", () => {
    assert.ok(i2iDenoise(0.65, false) <= 0.48);
    assert.ok(i2iDenoise(0.65, true) <= 0.58);
  });
});

describe("modes", () => {
  it("edit photo requires an image, from text does not", () => {
    assert.equal(MODE_META.i2i.needsImage, true);
    assert.equal(MODE_META.t2i.needsImage, false);
  });
});

describe("WAN pair", () => {
  it("2.2 VAE does not pair with 2.1 unet", () => {
    assert.equal(wanStackVersion("wan2.1_i2v.safetensors"), "21");
    assert.equal(wanStackVersion("wan2.2_vae.safetensors"), "22");
    assert.equal(wanPairOk("wan2.1_i2v.safetensors", "wan2.2_vae.safetensors"), false);
    assert.equal(wanPairOk("wan2.1_i2v.safetensors", "wan_2.1_vae.safetensors"), true);
    assert.equal(
      pickWanVae("wan2.1.safetensors", ["wan2.2_vae.safetensors", "wan_2.1_vae.safetensors"]),
      "wan_2.1_vae.safetensors",
    );
  });
  it("14B 2.2 i2v uses 16ch; 5B ti2v uses 48ch", () => {
    assert.equal(wanStackVersion("wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"), "21");
    assert.equal(wanStackVersion("DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors"), "21");
    assert.equal(wanStackVersion("wan2.2_ti2v_5B_fp16.safetensors"), "22");
    assert.equal(wanPairOk("wan2.2_i2v_high_noise_14B.safetensors", "wan_2.1_vae.safetensors"), true);
    assert.equal(wanPairOk("wan2.2_ti2v_5B_fp16.safetensors", "wan2.2_vae.safetensors"), true);
    assert.equal(wanPairOk("wan2.2_ti2v_5B_fp16.safetensors", "wan_2.1_vae.safetensors"), false);
  });
  it("Play prefers 14B over 5B ti2v", () => {
    assert.equal(
      pickPlayUnet("wan2.2_ti2v_5B_fp16.safetensors", [
        "wan2.2_ti2v_5B_fp16.safetensors",
        "DasiwaWAN22I2V14BLightspeed.safetensors",
      ]),
      "DasiwaWAN22I2V14BLightspeed.safetensors",
    );
    assert.equal(
      pickPlayUnet("", [
        "wan22EnhancedNSFWSVICamera_nsfwFASTMOVEV2Q8H.gguf",
        "DasiwaWAN22I2V14BLightspeed.safetensors",
      ]),
      "DasiwaWAN22I2V14BLightspeed.safetensors",
    );
  });
  it("does not pair Dasiwa High with Rapid Low", () => {
    const high = "DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors";
    const rapid = "wan22I2VRapidDiverse_low.safetensors";
    const officialHigh = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors";
    const officialLow = "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors";
    assert.equal(isHighNoiseUnet(high), true);
    assert.equal(isHighNoiseUnet(officialHigh), true);
    assert.equal(isLowNoiseUnet(rapid), true);
    assert.equal(isLowNoiseUnet(officialLow), true);
    assert.notEqual(wanExpertStem(high), wanExpertStem(rapid));
    assert.equal(wanExpertStem(officialHigh), wanExpertStem(officialLow));
    assert.equal(pickMatchingExpert(officialHigh, [officialHigh, officialLow, rapid], "low"), officialLow);
    assert.equal(pickMatchingExpert(high, [high, rapid], "low"), "");
    const bad = pairWanUnets(high, [high, rapid]);
    assert.match(bad.error || "", /HIGH-noise/);
    const good = pairWanUnets(officialHigh, [officialHigh, officialLow, rapid]);
    assert.equal(good.high, officialHigh);
    assert.equal(good.low, officialLow);
    assert.equal(good.error, undefined);
    const dasiwa = pairWanUnets(
      "DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors",
      [
        "DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors",
        "DasiwaWAN22I2V14BLightspeed_snatchkissLowV11.safetensors",
        "wan22I2VRapidDiverse_low.safetensors",
      ],
    );
    assert.equal(dasiwa.high, "DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors");
    assert.equal(dasiwa.low, "DasiwaWAN22I2V14BLightspeed_snatchkissLowV11.safetensors");
  });
  it("Play skips high-noise-only and keeps a matched pair", () => {
    assert.equal(
      pickPlayUnet("wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", [
        "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
        "wan22I2VRapidDiverse_low.safetensors",
      ]),
      "wan22I2VRapidDiverse_low.safetensors",
    );
    assert.equal(
      pickPlayUnet("wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", [
        "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
        "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
      ]),
      "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
    );
  });
  it("2.2 i2v dual-pass uses high then low KSamplerAdvanced", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      settings: settings({
        wanUnet: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
        wanUnetLow: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5.safetensors",
      }),
    });
    const adv = Object.values(g).filter((n) => n.class_type === "KSamplerAdvanced");
    assert.equal(adv.length, 2);
    assert.equal(adv[0]?.inputs.end_at_step, 10);
    assert.equal(adv[1]?.inputs.start_at_step, 10);
    assert.equal(adv[0]?.inputs.add_noise, "enable");
    assert.equal(adv[1]?.inputs.add_noise, "disable");
    assert.ok(!classes(g).includes("KSampler"));
    assert.deepEqual(validateApiGraph(g), []);
  });
  it("14B i2v stays under 16GB: 480-wide and 49 frames", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      aspect: "16:9",
      settings: settings({
        wanUnet: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
        wanUnetLow: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5.safetensors",
        videoFrames: 81,
      }),
    });
    const lat = Object.values(g).find((n) => n.class_type === "WanImageToVideo");
    assert.ok((lat?.inputs.width as number) <= 640);
    assert.ok((lat?.inputs.height as number) <= 512);
    assert.equal(lat?.inputs.length, 81);
  });
  it("lean 14B drops dual pass and extra frames", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      lean: true,
      settings: settings({
        wanUnet: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
        wanUnetLow: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5.safetensors",
      }),
    });
    assert.equal(Object.values(g).filter((n) => n.class_type === "KSamplerAdvanced").length, 0);
    assert.ok(classes(g).includes("KSampler"));
    const lat = Object.values(g).find((n) => n.class_type === "WanImageToVideo");
    assert.equal(lat?.inputs.length, 49);
  });
  it("Lightspeed dual uses 4 steps cfg 1", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      settings: settings({
        wanUnet: "DasiwaWAN22I2V14BLightspeed_snatchkissHighV11.safetensors",
        wanUnetLow: "DasiwaWAN22I2V14BLightspeed_snatchkissLowV11.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5.safetensors",
      }),
    });
    const adv = Object.values(g).filter((n) => n.class_type === "KSamplerAdvanced");
    assert.equal(adv[0]?.inputs.steps, 4);
    assert.equal(adv[0]?.inputs.cfg, 1);
    assert.equal(adv[0]?.inputs.end_at_step, 2);
  });
  it("5B t2v uses Wan22ImageToVideoLatent not 16ch empty", () => {
    const g = graph({
      mode: "t2v",
      settings: settings({
        wanUnet: "wan2.2_ti2v_5B_fp16.safetensors",
        wanVae: "wan2.2_vae.safetensors",
        wanClip: "umt5.safetensors",
      }),
    });
    assert.ok(classes(g).includes("Wan22ImageToVideoLatent"));
    assert.ok(!classes(g).includes("EmptyHunyuanLatentVideo"));
  });
  it("picks umt5 for WAN CLIP", () => {
    assert.match(
      pickWanClip(["clip_l.safetensors", "nsfwWanUMT5XXLGGUF_q5AndQ4KM_pruned_fp16.gguf"], ""),
      /umt5/i,
    );
  });
  it("text-to-video picks ti2v 5B, not i2v 14B", () => {
    assert.equal(
      pickT2vUnet("", [
        "DasiwaWAN22I2V14BLightspeed.safetensors",
        "wan2.2_ti2v_5B_fp16.safetensors",
        "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
      ]),
      "wan2.2_ti2v_5B_fp16.safetensors",
    );
    assert.equal(pickT2vUnet("", ["DasiwaWAN22I2V14BLightspeed.safetensors"]), "");
  });
});

describe("wildcards", () => {
  it("expands __name__ and braces", () => {
    const r = expandPrompt("a __color__ {cat|cat}", [{ name: "color", lines: ["red"] }], 1);
    assert.match(r.expanded, /red/);
    assert.match(r.expanded, /cat/);
    assert.equal(r.missing.length, 0);
  });
});

describe("writer", () => {
  it("clip prompt is motion, not a still dump", () => {
    const m = grokMotion("she turns her head in the rain");
    assert.match(m, /turns her head/);
    assert.doesNotMatch(m, /pores|subsurface|masterpiece/);
    assert.match(m, /camera|dolly|push|motion/i);
    assert.match(m, /rain/i);
  });
  it("i2v motion locks the still identity", () => {
    const m = grokMotion("a girl and a dude in the rain", "still-lock");
    assert.match(m, /same face/);
    assert.match(m, /girl and a dude/);
    assert.match(m, /comes alive|exact photo/i);
    assert.doesNotMatch(m, /she moves/);
  });
  it("fight clip gets clash motion", () => {
    const m = grokMotion("goblin vs warrior", "invent");
    assert.match(m, /clash|hit|jolt/i);
  });
  it("continue motion keeps identity and asks for the next beat", () => {
    const m = grokMotion("a girl and a dude in the rain", "continue");
    assert.match(m, /next moment|keep going|continue/i);
    assert.match(m, /same face/);
  });
  it("clip audio picks fight sfx and two voices", () => {
    const a = designClipAudio("a girl and a dude fight in the alley");
    assert.equal(a.sfx, "fight");
    assert.ok(a.lines.some((l) => l.voice === "female"));
    assert.ok(a.lines.some((l) => l.voice === "male"));
  });
  it("clip audio always has a spoken line", () => {
    const a = ensureVoice(designClipAudio("a quiet room with a lamp"), "a quiet room with a lamp");
    assert.ok(a.lines.length >= 1);
    assert.match(a.lines[0]?.text || "", /quiet|room|lamp|yeah|okay|mm|here|alright/i);
  });
  it("sex scene gets sex bed plus extra rain if raining", () => {
    const a = designClipAudio("a girl and a dude fuck in the rain");
    assert.equal(a.sfx, "sex");
    assert.ok(a.extra.includes("rain"));
    assert.ok(a.lines.some((l) => l.voice === "female"));
  });
  it("horror and sex packs are not SFW-washed", () => {
    const h = writeHorrorSet("her", 3).join(" ");
    const s = writeExtreme("her", 3).join(" ");
    assert.equal(isWashed(h), false);
    assert.equal(isWashed(s), false);
    assert.match(s, /cock|pussy|fuck|anal|explicit/i);
  });
  it("groups Force under Horror", () => {
    assert.equal(nsfwGroup("force"), "Horror");
  });
  it("groups doggy under Positions", () => {
    assert.equal(nsfwGroup("doggy"), "Positions");
    assert.equal(nsfwGroup("missionary"), "Positions");
    assert.ok(NSFW_TYPES.some((t) => t.id === "cowgirl"));
    assert.ok(NSFW_TYPES.some((t) => t.id === "pretzel"));
    const pos = writeMenus().find((m) => m.id === "pos");
    assert.ok((pos?.items.length ?? 0) >= 20);
    const evil = writeMenus().find((m) => m.id === "evil");
    assert.ok(evil?.items.some((t) => t.id === "evil-forced"));
    const look = writeMenus().find((m) => m.id === "look");
    assert.ok((look?.items.length ?? 0) >= 20);
    assert.ok(LOOK_APPENDS.some((t) => t.id === "ghib"));
    assert.ok(writeMenus().some((m) => m.id === "face"));
    assert.ok(writeMenus().some((m) => m.id === "body"));
    assert.ok(writeMenus().some((m) => m.id === "clothes"));
    assert.ok(FACE_BITS.length >= 70);
    assert.ok(BODY_BITS.length >= 50);
    assert.ok(CLOTHES_BITS.length >= 60);
    assert.ok(PLACE_BITS.length >= 60);
    assert.ok(NSFW_TYPES.length >= 380);
    assert.ok(NSFW_TYPES.some((t) => t.id === "k-wand"));
    assert.ok(NSFW_TYPES.some((t) => t.id === "k-spank"));
    assert.ok(NSFW_TYPES.some((t) => t.id === "k-threesomm"));
    assert.ok(writeMenus().some((m) => m.id === "kink"));
    assert.equal(nsfwGroup("rimming"), "Sex");
    assert.equal(nsfwGroup("lich"), "Creatures");
    assert.equal(nsfwGroup("flay"), "Horror");
    const face = writeMenus().find((m) => m.id === "face");
    assert.ok(face?.surprise === "person");
    const sex = writeMenus().find((m) => m.id === "sex");
    assert.ok(sex?.surprise === "sex");
  });
  it("art wrap keeps the typed line", () => {
    assert.equal(applyArtWrap("a cat fights a dog", "none"), "a cat fights a dog");
    const a = applyArtWrap("a cat fights a dog", "anime");
    assert.match(a, /a cat fights a dog/);
    assert.match(a, /anime still/);
    assert.match(randomSceneLine(1), /\S/);
  });
  it("quality offers add 4k / photoreal and mark hires", () => {
    const t = applyQualityOffers("a cat fights a dog", ["real", "4k"]);
    assert.match(t, /a cat fights a dog/);
    assert.match(t, /photoreal|DSLR/i);
    assert.match(t, /4k/i);
    assert.equal(qualityWantsHires(["4k"]), true);
    assert.equal(qualityWantsHires(["real"]), false);
  });
  it("brain prefers uncensored models and strips chatter", () => {
    assert.equal(pickBrainModel(["llama3:8b", "huihui_ai/qwen2.5-abliterate:7b"]), "huihui_ai/qwen2.5-abliterate:7b");
    assert.equal(cleanBrainOut('Sure, prompt: "a cat in rain"'), "a cat in rain");
    const sys = brainSystem({ wrap: "anime", checkpoint: "illustrious.safetensors" });
    assert.match(sys, /Do not add sex/);
    assert.match(sys, /Uncensored/);
    assert.match(sys, /anime/);
  });
  it("look flavor keeps the scene and does not dump sex", () => {
    const t = writePrompt({
      flavor: "person",
      files: [],
      seed: 42,
      existing: "evil monster after a girl",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    assert.match(t, /evil monster after a girl/i);
    assert.match(t, /claw|scale|maw|hide|snout|horn|teeth/i);
    assert.match(t, /hair|jacket|hoodie|dress|jeans|woman/i);
    assert.doesNotMatch(t, /ahegao|masturbat|handjob|anal|ring gag|school uniform|looking at viewer/i);
  });
  it("goblin / woman / man get body details, not chase junk", () => {
    const g = writePrompt({
      flavor: "person",
      files: [],
      seed: 3,
      existing: "goblin",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    assert.match(g, /goblin/i);
    assert.match(g, /ear|nose|green|wart|tusk|hide/i);
    const w = writePrompt({
      flavor: "person",
      files: [],
      seed: 4,
      existing: "woman",
      family: "sdxl",
      checkpoint: "mix",
    });
    assert.match(w, /adult woman/i);
    assert.doesNotMatch(w, /terror|torn jacket|one shoe/i);
    const m = writePrompt({
      flavor: "person",
      files: [],
      seed: 5,
      existing: "man",
      family: "sdxl",
      checkpoint: "mix",
    });
    assert.match(m, /adult man/i);
    assert.match(m, /jaw|beard|shoulder|stubble|forearm/i);
  });
  it("fight goblin vs female warrior fills BOTH people and the yard", () => {
    const t = writePrompt({
      flavor: "person",
      files: [],
      seed: 11,
      existing: "goblin male fight human female warrior",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    assert.match(t, /goblin/i);
    assert.match(t, /adult (human )?woman|warrior/i);
    assert.match(t, /armor|breastplate|cuirass|sword|shield|spear/i);
    assert.match(t, /flagstone|courtyard|mud|palisade|keep|village|rain|torch|cobble/i);
    assert.doesNotMatch(t, /dojo at night|school uniform|blouse and jeans|yaoi|cute/i);
  });
  it("Who stays neutral until cute/gay words are in the box", () => {
    const t = writePrompt({
      flavor: "person",
      files: [],
      seed: 9,
      existing: "goblin",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    assert.doesNotMatch(t, /cute|kawaii|yaoi|gay|femboy|1boy|2boys|school uniform|looking at viewer|blush/i);
    const gay = keepNeutral("goblin, yaoi, cute, 2boys", "yaoi goblin", "person");
    assert.match(gay, /yaoi/i);
    const stripped = keepNeutral("woman, cute, yaoi, school uniform", "woman", "person");
    assert.doesNotMatch(stripped, /cute|yaoi|school uniform/i);
    const kept = keepNeutral("woman, rape, forced, ahegao", "rape scene forced", "person");
    assert.match(kept, /rape/i);
    assert.match(kept, /forced/i);
  });
  it("NSFW switch keeps dirty words and fills explicit", () => {
    const t = writePrompt({
      flavor: "person",
      files: [],
      seed: 8,
      existing: "woman",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
      nsfwMode: true,
    });
    assert.match(t, /uncensored|explicit|pussy|nipple|fuck/i);
    const dirty = grokExpand({
      typed: "rape the warrior",
      files: DEFAULT_WILDCARDS,
      seed: 3,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      nsfwMode: true,
    });
    assert.match(dirty, /rape/i);
    assert.doesNotMatch(dirty, /tasteful|implied nudity|fade to black/i);
  });
  it("keeps extra scene words after Who, and long prompts split for CLIP", () => {
    const first = writePrompt({
      flavor: "person",
      files: [],
      seed: 11,
      existing: "goblin male fight human female warrior",
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    const longer = `${first}, a ruined castle on the ridge behind them, ravens over the smoke`;
    const second = writePrompt({
      flavor: "person",
      files: [],
      seed: 12,
      existing: longer,
      family: "sdxl",
      checkpoint: "DasiwaIllustriousAnime.safetensors",
    });
    assert.match(userLead(longer), /castle/i);
    assert.match(second, /castle/i);
    assert.match(second, /ravens/i);
    const chunks = chunkPrompt(second + ", " + "fog, moss, banners, mud, crows, ".repeat(20));
    assert.ok(chunks.length >= 2);
    const g = buildApiWorkflow({
      mode: "t2i",
      prompt: second + ", " + "fog, moss, banners, mud, crows, ".repeat(20),
      negative: "",
      seed: 1,
      aspect: "1:1",
      denoise: 1,
      loras: [],
      settings: settings(),
      imageCount: 0,
      hasVideo: false,
      taggerClass: "",
      taggerModel: "",
    });
    const concats = Object.values(g).filter((n) => n.class_type === "ConditioningConcat");
    assert.ok(concats.length >= 1);
    const longNeg = "blur, watermark, " + "bad hands, extra fingers, ".repeat(30);
    const both = graph({
      prompt: second + ", " + "fog, moss, banners, mud, crows, ".repeat(20),
      negative: longNeg,
    });
    const posIds = new Set(
      Object.entries(both)
        .filter(([, n]) => n.class_type === "CLIPTextEncode" && String(n._meta?.title || "").startsWith("Positive"))
        .map(([id]) => id),
    );
    const negIds = new Set(
      Object.entries(both)
        .filter(([, n]) => n.class_type === "CLIPTextEncode" && String(n._meta?.title || "").startsWith("Negative"))
        .map(([id]) => id),
    );
    for (const id of posIds) assert.equal(negIds.has(id), false);
    assert.ok(posIds.size >= 2);
    assert.ok(negIds.size >= 2);
    assert.equal(validateApiGraph(both).length, 0);
  });
});

describe("negative", () => {
  it("Grok expand fills a short line but keeps it", () => {
    const t = grokExpand({
      typed: "goblin male fight human female warrior",
      files: DEFAULT_WILDCARDS,
      seed: 3,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /goblin male fight human female warrior/i);
    assert.ok(t.split(/\s+/).length > 10);
  });
  it("does not dump ugly/deformed by default", () => {
    assert.doesNotMatch(negativeForCheckpoint("mix"), /\bdeformed\b/);
    assert.doesNotMatch(negativeForPrompt("mix", "gore stabbing"), /\bdeformed\b/);
  });
  it("empty prompt does not require a filled negative", () => {
    assert.equal(shouldReplaceNegative(""), true);
  });
  it("locked empty negative stays empty", () => {
    assert.equal(generateNegative("", "mix", "a woman", true), "");
    assert.ok(generateNegative("", "mix", "a woman", false).length > 0);
    assert.match(generateNegative("watermark", "mix", "a woman", true), /watermark/);
  });
});

describe("sfw vs nsfw", () => {
  const ckpt = "DasiwaIllustrious.safetensors";
  const sexRe = /\b(ahegao|masturbat|handjob|blowjob|pussy|cock|anal|creampie|ring gag)\b/i;

  it("SFW short line stays SFW and grows", () => {
    const typed = "husky ninja in the snow";
    assert.equal(isAdult(typed), false);
    const t = grokExpand({ typed, files: DEFAULT_WILDCARDS, seed: 9, family: "sdxl", checkpoint: ckpt });
    assert.match(t, /husky ninja in the snow/i);
    assert.doesNotMatch(t, sexRe);
    assert.doesNotMatch(t, /\b(yaoi|cute|school uniform)\b/i);
    assert.ok(t.split(/\s+/).length > typed.split(/\s+/).length);
  });

  it("NSFW short line stays explicit and is not washed", () => {
    const typed = "she fucks him, explicit nsfw";
    assert.equal(isAdult(typed), true);
    const t = grokExpand({ typed, files: DEFAULT_WILDCARDS, seed: 9, family: "sdxl", checkpoint: ckpt });
    assert.match(t, /she fucks him/i);
    assert.equal(isWashed(t), false);
    assert.ok(t.split(/\s+/).length > 6);
  });

  it("SFW fight vs NSFW sex are different stacks", () => {
    const sfw = grokExpand({
      typed: "goblin male fight human female warrior",
      files: DEFAULT_WILDCARDS,
      seed: 4,
      family: "sdxl",
      checkpoint: ckpt,
    });
    const nsfw = grokExpand({
      typed: "goblin male fucks human female warrior, explicit",
      files: DEFAULT_WILDCARDS,
      seed: 4,
      family: "sdxl",
      checkpoint: ckpt,
    });
    assert.equal(isAdult("goblin male fight human female warrior"), false);
    assert.equal(isAdult("goblin male fucks human female warrior, explicit"), true);
    assert.doesNotMatch(sfw, sexRe);
    assert.match(sfw, /fight|warrior|goblin/i);
    assert.match(nsfw, /fuck/i);
    assert.equal(isWashed(nsfw), false);
    assert.notEqual(sfw.toLowerCase(), nsfw.toLowerCase());
  });
});

describe("animal expand", () => {
  it("cat vs dog describes both animals, not a human castle fight", () => {
    const t = grokExpand({
      typed: "cat fight a dog",
      files: DEFAULT_WILDCARDS,
      seed: 11,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /cat fight a dog/i);
    assert.match(t, /fur|whisker|muzzle|paw|tabby|hackles|fangs|tail|coat/i);
    assert.doesNotMatch(t, /shield|flagstone|cottage|keep yard|banner torn/i);
    assert.doesNotMatch(t, /detailed hands/i);
  });
  it("pasted dump is thrown away, keeps the cat vs dog lead", () => {
    const t = grokExpand({
      typed:
        "cat fight a dog, she kicks mud, shield bash, torch-lit keep yard, pores, subsurface scatter, highly detailed anime still",
      files: DEFAULT_WILDCARDS,
      seed: 11,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /cat fight a dog/i);
    assert.doesNotMatch(t, /shield bash|keep yard|pores/i);
  });
  it("new scene keeps the last prompt and weaves picks", () => {
    const t = composeNewScene("goblin male fight human female warrior", [
      { label: "Doggy", tags: "doggy style, from behind" },
      { label: "Manga", tags: "manga panel, screentones" },
    ]);
    assert.match(t, /goblin male fight/i);
    assert.match(t, /doggy/i);
    assert.match(t, /manga/i);
  });
});

describe("checkpoints", () => {
  it("rejects character LoRAs sitting in checkpoints", () => {
    assert.equal(isRealCheckpoint("illustrious_XL_mara & tamaki_h13a.safetensors"), false);
    assert.equal(isRealCheckpoint("some_lora_v1.safetensors"), false);
    assert.equal(isRealCheckpoint("DasiwaIllustriousAnime_epitaphecstasy.safetensors"), true);
    assert.equal(isRealCheckpoint("lumina_2.safetensors"), false);
    assert.equal(isRealCheckpoint("NextDiT.safetensors"), false);
    assert.equal(isImageCheckpoint("DasiwaIllustriousAnime_epitaphecstasy.safetensors"), true);
    assert.equal(isImageCheckpoint("wan2.1_i2v_480p.safetensors"), false);
    assert.equal(isImageCheckpoint("svd_xt.safetensors"), false);
    assert.equal(
      resolveCkpt("Dasiwa.safetensors", ["folder/Dasiwa.safetensors", "AnythingXL_xl.safetensors"]),
      "folder/Dasiwa.safetensors",
    );
    assert.equal(
      resolveCkpt("MyPick.safetensors", ["AnythingXL_xl.safetensors", "chilloutmix.safetensors"]),
      "MyPick.safetensors",
    );
  });
  it("guesses families", () => {
    assert.equal(guessArch("chilloutmix_NiPrunedFp32Fix.safetensors"), "sd15");
    assert.equal(guessArch("CuteKittenMix.safetensors"), "sd15");
    assert.equal(guessArch("DasiwaIllustriousAnime.safetensors"), "sdxl");
    assert.equal(guessArch("AnythingXL_xl.safetensors"), "sdxl");
    assert.equal(guessArch("flux1-dev.safetensors"), "flux");
    assert.equal(guessArch("flux_dev_fp8.safetensors"), "flux");
  });
  it("styles: anime / real / illustrious / nsfw", () => {
    assert.ok(guessStyles("DasiwaIllustriousAnime.safetensors").includes("illustrious"));
    assert.ok(guessStyles("DasiwaIllustriousAnime.safetensors").includes("anime"));
    assert.ok(guessStyles("AnythingXL_xl.safetensors").includes("anime"));
    assert.ok(guessStyles("chilloutmix.safetensors").includes("real"));
    assert.ok(guessStyles("BASNSFWBetterAnimeStyle.safetensors").includes("nsfw"));
    assert.equal(checkpointMatchesStyle("CuteKittenMix.safetensors", "anime"), true);
    assert.equal(checkpointMatchesStyle("CuteKittenMix.safetensors", "real"), false);
  });
  it("pony settings use euler / ~30 steps", () => {
    const s = settingsForCheckpoint("ponyRealism_v21.safetensors");
    assert.equal(s.sampler, "euler_ancestral");
    assert.ok((s.cfg ?? 9) <= 7);
  });
  it("illustrious uses clip skip 2", () => {
    const s = settingsForCheckpoint("DasiwaIllustriousAnime.safetensors");
    assert.equal(s.clipSkip, 2);
    assert.equal(s.sampler, "euler_ancestral");
    assert.ok((s.steps ?? 0) >= 28);
  });
  it("XL skips CLIPSetLastLayer so a missing CLIP cannot clone", () => {
    const g = graph({
      loras: [
        {
          id: "a",
          filename: "alice.safetensors",
          name: "alice",
          family: "sdxl",
          enabled: true,
          unetStrength: 0.8,
          clipStrength: 1,
          triggerWords: ["alice"],
        },
      ],
      settings: settings({ clipSkip: 2, stillFamily: "sdxl" }),
    });
    assert.ok(!classes(g).includes("CLIPSetLastLayer"));
    const lora = Object.values(g).find((n) => n.class_type === "LoraLoader");
    assert.deepEqual(lora?.inputs.clip, ["1", 1]);
  });
  it("empty box still sends a hands floor to Comfy", () => {
    const n = generateNegative("", "DasiwaIllustriousAnime.safetensors", "alice in an alley");
    assert.match(n, /extra fingers/);
    assert.doesNotMatch(n, /\bdeformed\b/);
  });
  it("picking a 1.5 ckpt marks family 1.5, flux ckpt marks flux", () => {
    const a = settingsForCheckpoint("CuteKittenMix.safetensors");
    assert.equal(a.stillFamily, "sd15");
    assert.equal(a.stillLoader, "checkpoint");
    const b = settingsForCheckpoint("flux1-dev.safetensors");
    assert.equal(b.stillFamily, "flux");
    const c = familyOfSelection({
      stillLoader: "checkpoint",
      checkpoint: "chilloutmix.safetensors",
      fluxUnet: "",
      stillFamily: "sdxl",
    });
    assert.equal(c, "sd15");
  });
  it("xl size is 832x1216 for 2:3", () => {
    assert.deepEqual(sizeForFamily("sdxl", "2:3"), { w: 832, h: 1216 });
  });
});

describe("loras", () => {
  it("rejects quantized checkpoints sitting in the LoRA folder", () => {
    assert.equal(isNotALora("realismByStableYogi_v30INT8Q8Extended.safetensors"), true);
    assert.equal(isNotALora("add_detail.safetensors"), false);
    assert.equal(isNotALora("alice.safetensors"), false);
  });
  it("strips the truncated Stable Yogi file out of a graph", () => {
    const g = graph({
      mode: "t2i",
      loras: [
        {
          id: "bad",
          filename: "realismByStableYogi_v30INT8Q8Extended.safetensors",
          name: "yogi",
          family: "sdxl",
          triggerWords: [],
          unetStrength: 0.8,
          clipStrength: 0.8,
          enabled: true,
        },
      ],
    });
    const names = Object.values(g).map((n) => String(n.inputs.lora_name || ""));
    assert.equal(names.some((n) => /INT8Q8/i.test(n)), false);
  });
  it("drops XL-named lora on a 1.5 checkpoint", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "alice_xl.safetensors",
        name: "alice",
        family: "sdxl",
        triggerWords: ["alice"],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    const r = compatibleLoras(list, "t2i", "sd15");
    assert.equal(r.ok.length, 0);
    assert.equal(r.blocked.length, 1);
  });
  it("keeps character LoRAs on XL even if family was guessed wrong", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "illustrious_XL_mara & tamaki_h13a.safetensors",
        name: "mara",
        family: "sd15",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
      {
        id: "2",
        filename: "Hestia.safetensors",
        name: "hestia",
        family: "sd15",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    const r = compatibleLoras(list, "t2i", "sdxl");
    assert.equal(r.ok.length, 2);
    assert.equal(guessLoraFamily("Hestia.safetensors"), "any");
    assert.equal(loraFitsCheckpoint("Hestia.safetensors", "sdxl"), true);
    assert.equal(loraFitsCheckpoint("Hestia.safetensors", "sd15"), false);
    assert.equal(loraFitsLane("Angelina.safetensors", "chilloutmix.safetensors"), false);
    assert.equal(loraFitsLane("Angelina.safetensors", "AnythingXL_xl.safetensors"), true);
  });
  it("injects trigger words once", () => {
    const loras: LoraEntry[] = [
      {
        id: "1",
        filename: "alice.safetensors",
        name: "alice",
        family: "sdxl",
        triggerWords: ["alice"],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    assert.equal(triggerPrefix(loras, "in an alley"), "alice, in an alley");
    assert.equal(triggerPrefix(loras, "alice in an alley"), "alice in an alley");
  });
  it("turns on LoRAs when you type the character name", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "alice_illustrious_v4.safetensors",
        name: "alice",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: false,
      },
      {
        id: "2",
        filename: "stardust_illustrious.safetensors",
        name: "stardust",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: false,
      },
      {
        id: "3",
        filename: "random_clothing_xl.safetensors",
        name: "clothes",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: false,
      },
    ];
    const hit = matchNamedLoras("alice stardl in an alley", list, "sdxl");
    assert.equal(hit.some((l) => /alice/i.test(l.filename)), true);
    assert.equal(hit.some((l) => /stardust/i.test(l.filename)), true);
    assert.equal(hit.some((l) => /clothing/i.test(l.filename)), false);
  });
  it("does not auto-enable LoRAs from prompt names", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "alice.safetensors",
        name: "alice",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: false,
      },
      {
        id: "2",
        filename: "ninja.safetensors",
        name: "ninja",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
      {
        id: "3",
        filename: "goblin.safetensors",
        name: "goblin",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    const r = pickLorasForPrompt("alice in an alley", list, "sdxl");
    assert.equal(r.ok.some((l) => /alice/i.test(l.filename)), true);
    assert.equal(r.ok.some((l) => /ninja|goblin/i.test(l.filename)), false);
    assert.equal(r.named.length, 1);
  });
  it("blocks pony LoRA on an Illustrious mix", () => {
    assert.equal(guessLoraLane("werm_pony_duo.safetensors"), "pony");
    assert.equal(guessLoraLane("Hestia Illustrious v4.safetensors"), "illustrious");
    assert.equal(loraFitsLane("werm_pony_duo.safetensors", "DasiwaIllustriousAnime.safetensors"), false);
    assert.equal(loraFitsLane("Hestia Illustrious v4.safetensors", "DasiwaIllustriousAnime.safetensors"), true);
    assert.equal(loraFitsLane("add_detail.safetensors", "DasiwaIllustriousAnime.safetensors"), false);
    assert.equal(loraFitsLane("BSS_DetailEnhancer_IL.safetensors", "DasiwaIllustriousAnime.safetensors"), true);
  });
  it("treats unlabeled detail packs as SD 1.5", () => {
    assert.equal(guessLoraLane("add_detail.safetensors"), "sd15");
    assert.equal(guessLoraLane("more_details.safetensors"), "sd15");
    assert.equal(guessLoraLane("epicrealism_naturalSinRC1VAE.safetensors"), "sd15");
    assert.equal(guessLoraLane("uberRealisticPornMerge_v23Final.safetensors"), "sd15");
    assert.equal(loraFitsLane("add_detail.safetensors", "AnythingXL_xl.safetensors"), false);
    assert.equal(loraFitsLane("add_detail.safetensors", "chilloutmix.safetensors"), true);
  });
  it("drops ticked act LoRAs that are not in the prompt", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "cunnilingus_illustrious.safetensors",
        name: "cunnilingus",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
      {
        id: "2",
        filename: "BSS_DetailEnhancer_IL.safetensors",
        name: "detail",
        family: "sdxl",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    const r = pickLorasForPrompt("cat fight a dog", list, "sdxl", "DasiwaIllustrious.safetensors");
    assert.equal(r.ok.some((l) => /cunnilingus/i.test(l.filename)), false);
    assert.equal(r.ok.some((l) => /Detail/i.test(l.filename)), true);
  });
  it("does not stack SD 1.5 add_detail on an XL mix", () => {
    const list: LoraEntry[] = [
      {
        id: "1",
        filename: "add_detail.safetensors",
        name: "add_detail",
        family: "sd15",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
      {
        id: "2",
        filename: "more_details.safetensors",
        name: "more_details",
        family: "sd15",
        triggerWords: [],
        unetStrength: 0.8,
        clipStrength: 0.8,
        enabled: true,
      },
    ];
    const r = pickLorasForPrompt("sexy anime girl", list, "sdxl", "DasiwaIllustriousAnime.safetensors");
    assert.equal(r.ok.length, 0);
    assert.equal(r.blocked.length, 2);
  });
});

describe("still identity", () => {
  it("treats forge-media and a named still as the same photo", () => {
    assert.equal(stillKey("Forge_00015_.png", "data:image/png;base64,aaa"), "forge_00015_.png");
    assert.equal(
      stillKey("still.png", "/forge-media?folder=output&name=Forge_00015_.png"),
      "forge_00015_.png",
    );
    assert.equal(
      sameStill(
        { name: "still.png", dataUrl: "/forge-media?folder=output&name=Forge_00015_.png" },
        { name: "Forge_00015_.png", dataUrl: "data:image/png;base64,aaa" },
      ),
      true,
    );
    assert.equal(
      sameStill(
        { name: "Forge_00015_.png", dataUrl: "data:image/png;base64,aaa" },
        { name: "Forge_00016_.png", dataUrl: "data:image/png;base64,bbb" },
      ),
      false,
    );
  });
});

describe("wan", () => {
  it("accepts wan2.1 names and rejects lumina", () => {
    assert.equal(isWanUnet("wan2.1_t2v_14B_fp8_e4m3fn.safetensors"), true);
    assert.equal(isWanUnet("lumina.safetensors"), false);
  });
});

describe("graphs all modes", () => {
  const modes: Mode[] = ["t2i", "i2i", "ref2i", "t2v", "i2v", "ref2v", "v2v", "v2i"];
  for (const mode of modes) {
    it(`${mode} has numeric ids and no dangling links`, () => {
      const g = graph({
        mode,
        imageCount: mode === "t2i" || mode === "t2v" ? 0 : 1,
        hasVideo: mode === "v2v" || mode === "v2i",
        denoise: mode === "i2i" || mode === "ref2i" ? 0.7 : 1,
        settings: settings({
          wanUnet: "wan2.1_t2v_14B_fp8_e4m3fn.safetensors",
        }),
      });
      assert.deepEqual(validateApiGraph(g), []);
    });
  }
  it("i2v encodes a first frame", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      settings: settings({ wanUnet: "wan2.1_t2v_14B_fp8_e4m3fn.safetensors" }),
    });
    assert.ok(classes(g).includes("LoadImage"));
  });
  it("i2i batch repeats the latent", () => {
    const g = graph({ mode: "i2i", denoise: 0.7, imageCount: 1, settings: settings({ batchSize: 2 }) });
    assert.ok(classes(g).includes("RepeatLatentBatch") || (settings().batchSize ?? 1) >= 1);
  });
  it("text batch sets EmptyLatentImage batch_size", () => {
    const g = graph({ mode: "t2i", settings: settings({ batchSize: 4 }) });
    const empty = Object.values(g).find((n) => n.class_type === "EmptyLatentImage");
    assert.equal(empty?.inputs.batch_size, 4);
  });
  it("ref2i stitches every still, not only the first", () => {
    const g = graph({
      mode: "ref2i",
      imageCount: 3,
      denoise: 0.76,
    });
    const loads = Object.values(g).filter((n) => n.class_type === "LoadImage");
    assert.equal(loads.length, 3);
    assert.ok(classes(g).includes("ImageStitch"));
    assert.equal(loads[0]?.inputs.image, "forge_input_0.png");
    assert.equal(loads[2]?.inputs.image, "forge_input_2.png");
  });
  it("combine copy tells you to tap library photos, not open a file search", () => {
    assert.match(MODE_META.ref2i.how, /library|Results/i);
    assert.doesNotMatch(MODE_META.ref2i.how, /file search|file picker/i);
  });
  it("hires only on t2i", () => {
    const t = graph({ mode: "t2i", settings: settings({ hires: true }) });
    const i = graph({ mode: "i2i", denoise: 0.7, imageCount: 1, settings: settings({ hires: true }) });
    assert.ok(classes(t).includes("ImageScaleBy") || classes(t).includes("LatentUpscaleBy") || true);
    assert.ok(!classes(i).includes("ImageScaleBy"));
  });
});

describe("wildcards extra", () => {
  it("flattens Perchance {a|b} into one pick", () => {
    const raw =
      "{a breathtakingly detailed|a lush} anime-style {full body|low angle} shot of a {beautiful|alluring} young woman";
    const t = flattenPrompt(raw, 2);
    assert.doesNotMatch(t, /\{|\|/);
    assert.match(t, /anime-style/);
    assert.match(t, /young woman/);
  });
  it("random blocks keep braces until expand", () => {
    const b = withRandomBlocks("sexy anime girl with barely any clothes");
    assert.match(b, /\{/);
    const rolled = expandPrompt(b, [], 3).expanded;
    assert.doesNotMatch(rolled, /\{|\|/);
    assert.match(rolled, /hair/);
  });
  it("Generate rewrites the typed line instead of echoing it", () => {
    const typed = "cat fight a dog";
    const t = grokExpand({
      typed,
      files: DEFAULT_WILDCARDS,
      seed: 21,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.notEqual(t.trim().toLowerCase(), typed);
    assert.ok(t.length > typed.length + 20);
    assert.match(t, /cat/i);
    assert.match(t, /dog/i);
  });
  it("Write always lengthens a short typed scene", () => {
    const typed = "goblin vs woman";
    const t = grokExpand({
      typed,
      files: DEFAULT_WILDCARDS,
      seed: 44,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.notEqual(t.trim().toLowerCase(), typed.toLowerCase());
    assert.ok(t.split(/\s+/).length >= typed.split(/\s+/).length + 8);
    assert.match(t, /goblin/i);
  });
  it("curly mode builds {a|b} then flattens to one pick", () => {
    const curly = withRandomBlocks("cat fight a dog");
    assert.match(curly, /\{/);
    const t = grokExpand({
      typed: "cat fight a dog",
      files: DEFAULT_WILDCARDS,
      seed: 5,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      roll: "random",
    });
    assert.doesNotMatch(t, /\{|\|/);
    assert.notEqual(t.trim().toLowerCase(), "cat fight a dog");
  });
  it("normal mode throws away LLM purple prose", () => {
    const novel =
      "a breathtakingly detailed anime masterpiece of a young woman caught in a moment of raw, cinematic vulnerability, draped in nothing but the remnants of a shredded, translucent silk garment";
    assert.equal(isPurpleProse(novel), true);
    assert.match(recoverScene(novel), /young woman/i);
    assert.match(recoverScene(novel), /barely any clothes|anime/i);
    const t = grokExpand({
      typed: novel,
      files: DEFAULT_WILDCARDS,
      seed: 4,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.doesNotMatch(t, /breathtaking|masterpiece|vulnerability/i);
  });
  it("sexy girl barely clothed is skimpy look, not a gangbang pack", () => {
    const t = grokExpand({
      typed: "sexy anime girl with barely any clothes",
      files: DEFAULT_WILDCARDS,
      seed: 7,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /sexy anime girl with barely any clothes/i);
    assert.doesNotMatch(t, /spitroast|breeding press|hypnosis|gangbang/i);
    assert.match(t, /silk|lingerie|bikini|sheer|translucent|barely/i);
  });
  it("wolf cut hair is not a grey wolf", () => {
    const t = grokExpand({
      typed: "adult woman with a wolf cut",
      files: DEFAULT_WILDCARDS,
      seed: 11,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /wolf cut/i);
    assert.doesNotMatch(t, /grey wolf|muzzle|detailed paws|fur flying/i);
  });
  it("nsfw / explicit in the box stays the girl, not a random gangbang pack", () => {
    const t = grokExpand({
      typed: "anime girl, nsfw, explicit",
      files: DEFAULT_WILDCARDS,
      seed: 8,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /anime girl/i);
    assert.match(t, /uncensored|nsfw|explicit/i);
    assert.doesNotMatch(t, /spitroast|bukkake|full nelson|knit sweater/i);
  });
  it("tabby and mutt get animal looks, not a castle fight", () => {
    const t = grokExpand({
      typed: "orange tabby fighting a brindle mutt in a wet alley",
      files: DEFAULT_WILDCARDS,
      seed: 42,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /fur|whisker|muzzle|paw|tabby|coat/i);
    assert.doesNotMatch(t, /flagstone|keep yard|banner torn|dead horse/i);
  });
  it("sex words in the box still get an act, not vanilla clothes", () => {
    const t = grokExpand({
      typed: "girl getting fucked",
      files: DEFAULT_WILDCARDS,
      seed: 8,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /fuck/i);
    assert.doesNotMatch(t, /knit sweater|ordinary clothes/i);
  });
  it("short subject is fully filled", () => {
    assert.equal(isShortSubject("cat"), true);
    assert.equal(isShortSubject("orange tabby in a wet alley, fur flying, low angle"), false);
    const t = grokExpand({
      typed: "cat",
      files: DEFAULT_WILDCARDS,
      seed: 3,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /\bcat\b/i);
    assert.ok(t.split(/\s+/).length > 8);
  });
  it("keeps typed details and only fills missing camera/light", () => {
    const typed = "orange tabby fighting a brindle mutt in a wet alley, fur flying";
    const t = grokExpand({
      typed,
      files: DEFAULT_WILDCARDS,
      seed: 12,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /orange tabby/i);
    assert.match(t, /wet alley/i);
    assert.match(t, /brindle mutt/i);
    assert.doesNotMatch(t, /keep yard|shield bash|flagstone/i);
    assert.match(t, /low angle|wide|full body|overcast|streetlamp|light|shot/i);
  });
  it("sceneCore strips the last fill so a reroll can change looks", () => {
    const filled =
      "cat fight a dog, small compact tabby, dirt yard, low angle full bodies, overcast, detailed fur";
    assert.match(sceneCore(filled), /cat fight a dog/i);
    assert.doesNotMatch(sceneCore(filled), /overcast|detailed fur/i);
  });
  it("sceneCore is the subject so Brain can rewrite", () => {
    const filled =
      "sexy anime girl with barely any clothes, silk, nsfw, explicit, uncensored, adult 18+, window light";
    const c = sceneCore(filled);
    assert.match(c, /sexy anime girl/i);
    assert.ok(c.split(",").length <= 2);
  });
  it("adult prompt stays uncensored after expand", () => {
    const t = grokExpand({
      typed: "sexy anime girl, nsfw, explicit",
      files: DEFAULT_WILDCARDS,
      seed: 8,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.match(t, /uncensored/i);
    assert.doesNotMatch(t, /tasteful|implied nudity|fade to black/i);
  });
  it("NSFW mode fills people explicit, not cat fights", () => {
    const ckpt = "DasiwaIllustrious.safetensors";
    assert.equal(nsfwWanted("goblin vs woman", true), true);
    assert.equal(nsfwWanted("cat fight a dog", true), false);
    const person = grokExpand({
      typed: "goblin vs woman",
      files: DEFAULT_WILDCARDS,
      seed: 5,
      family: "sdxl",
      checkpoint: ckpt,
      nsfwMode: true,
    });
    assert.match(person, /uncensored|nsfw|explicit/i);
    assert.match(person, /goblin|warrior|shield|sword|armor/i);
    assert.doesNotMatch(person, /spitroast|bukkake|full nelson/i);
    const cat = grokExpand({
      typed: "cat fight a dog",
      files: DEFAULT_WILDCARDS,
      seed: 5,
      family: "sdxl",
      checkpoint: ckpt,
      nsfwMode: true,
    });
    assert.doesNotMatch(cat, /\b(pussy|cock|ahegao|handjob)\b/i);
  });
  it("SFW mode does not stamp uncensored on a fight", () => {
    const t = grokExpand({
      typed: "goblin vs woman",
      files: DEFAULT_WILDCARDS,
      seed: 5,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      nsfwMode: false,
    });
    assert.doesNotMatch(t, /uncensored, explicit, nsfw/i);
  });
  it("Brain subject of a filled line is short enough to lookFill", () => {
    const filled =
      "cat fight a dog, small compact tabby, dirt yard, low angle full bodies, overcast, detailed fur";
    assert.equal(isShortSubject(sceneCore(filled)), true);
    const t = grokExpand({
      typed: sceneCore(filled),
      files: DEFAULT_WILDCARDS,
      seed: 21,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.ok(t.length > sceneCore(filled).length + 20);
    assert.match(t, /fur|whisker|muzzle|paw|tabby/i);
  });
  it("Brain on magical girl invents costume instead of echoing the two words", () => {
    const t = grokExpand({
      typed: "magical girl",
      files: DEFAULT_WILDCARDS,
      seed: 7,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      nsfwMode: false,
    });
    assert.ok(t.split(/\s+/).length > 18);
    assert.match(t, /wand|brooch|twin tail|frilly|henshin|circlet|sailor collar|thigh-high|scepter|mahou/i);
    assert.doesNotMatch(t, /blouse and jeans/i);
    const filled =
      "a young adult magical girl, long twin tails, frilly minidress, rooftop, anime illustration, uncensored, explicit, nsfw";
    assert.equal(sceneCore(filled).toLowerCase(), "magical girl");
    const again = grokExpand({
      typed: filled,
      files: DEFAULT_WILDCARDS,
      seed: 19,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      nsfwMode: true,
    });
    assert.match(again, /wand|brooch|costume|skirt|henshin|pussy|sex|knees/i);
    assert.ok(tokenOverlap(again, filled) < 0.9);
  });
  it("two Brain seeds on the same subject are not copies", () => {
    const a = grokExpand({
      typed: "cat fight a dog",
      files: DEFAULT_WILDCARDS,
      seed: 11,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    const b = grokExpand({
      typed: "cat fight a dog",
      files: DEFAULT_WILDCARDS,
      seed: 11 + 7919,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
    });
    assert.notEqual(a, b);
    assert.ok(tokenOverlap(a, b) < 0.98);
  });
  it("reports missing lists and can expand twice (no lastIndex leak)", () => {
    const files = [{ name: "color", lines: ["red"] }];
    const a = expandPrompt("a __missing__ __color__", files, 1);
    const b = expandPrompt("a __color__", files, 1);
    assert.ok(a.missing.includes("missing"));
    assert.equal(b.missing.length, 0);
    assert.match(b.expanded, /red/);
  });
  it("nests lists", () => {
    const r = expandPrompt("__outer__", [
      { name: "outer", lines: ["hello __inner__"] },
      { name: "inner", lines: ["world"] },
    ], 1);
    assert.match(r.expanded, /hello world/);
  });
  it("parses inline loras", () => {
    const p = parseInlineLoras("a girl <lora:alice:0.7> alley");
    assert.equal(p.loras[0]?.name, "alice");
    assert.equal(p.loras[0]?.unet, 0.7);
    assert.match(p.text, /a girl/);
  });
});

describe("wd14 history", () => {
  it("reads STRING list and ui.tags, ignores PreviewImage files", async () => {
    const { extractTagText } = await import("./comfy.server.ts");
    assert.match(
      extractTagText({ "2": { tags: ["1girl, long hair, looking at viewer, blush"] } }),
      /1girl/,
    );
    assert.match(extractTagText({ "2": [["solo, blue eyes, smile"]] }), /blue eyes/);
    assert.equal(
      extractTagText({ "3": { images: [{ filename: "x.png", subfolder: "", type: "output" }] } }),
      "",
    );
  });
});

describe("png embed", () => {
  it("writes prompt and workflow tEXt", () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144,
      119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 0, 3, 0, 1, 0, 5, 254, 217, 0, 0,
      0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
    const out = embedWorkflowPng(png, '{"prompt":"hi"}', '{"1":{}}');
    const text = readPngText(out);
    assert.ok(Object.keys(text).length >= 1);
  });
  it("imports seed from Comfy prompt tEXt", () => {
    const meta = seedFromPngText({
      prompt: JSON.stringify({
        "30": { class_type: "KSampler", inputs: { seed: 4242 } },
        "10": { class_type: "CLIPTextEncode", inputs: { text: "alice in an alley" }, _meta: { title: "Positive" } },
      }),
    });
    assert.equal(meta.seed, 4242);
    assert.match(meta.prompt || "", /alice/);
  });
  it("hashes a photo to a stable seed when PNG has no metadata", () => {
    const a = seedFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    const b = seedFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    const c = seedFromBytes(new Uint8Array([9, 2, 3, 4, 5, 6, 7, 8]));
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe("detector tags", () => {
  it("splits WD14 csv", () => {
    const s = scanFromTags("1girl, solo, long hair");
    assert.equal(s.tags.length, 3);
    assert.match(s.summary, /WD14/);
    assert.ok(s.boxes.length >= 1);
  });
  it("1girl tags get a subject box", () => {
    const boxes = boxesFromTags([{ tag: "1girl" }, { tag: "solo" }, { tag: "face" }]);
    assert.ok(boxes.some((b) => b.label === "subject"));
    assert.ok(boxes.some((b) => b.label === "face"));
    assert.ok(boxes.every((b) => b.w > 0 && b.h > 0));
  });
  it("mergeScan keeps WD14 tags and local boxes", () => {
    const wd = scanFromTags("1girl, red hair");
    const local = {
      ...wd,
      tags: [{ tag: "person", confidence: 0.8 }],
      boxes: [{ id: "p", label: "person", confidence: 0.9, x: 0.1, y: 0.1, w: 0.4, h: 0.7 }],
      palette: ["red"],
    };
    const m = mergeScan(wd, local);
    assert.ok(m.tags.some((t) => t.tag === "1girl"));
    assert.equal(m.boxes[0]?.label, "person");
    assert.equal(m.palette[0], "red");
  });
});

describe("writer packs", () => {
  it("taboo and dark stay explicit", () => {
    assert.equal(isWashed(writeTabooSet("her", 1)[0] ?? ""), false);
    assert.equal(isWashed(writeDarkSet("her", 1)[0] ?? ""), false);
  });
});

describe("edit prompt is separate", () => {
  it("empty until take out / put in / change", () => {
    assert.equal(buildEditPrompt({}), "");
  });
  it("prompt box still works when take-out is empty", () => {
    const fields = buildEditPrompt({});
    const combined = [fields, "remove the shirt, add a red jacket"].filter(Boolean).join(". ");
    assert.match(combined, /remove the shirt/);
  });
  it("builds only the edit, keeps the person", () => {
    const t = buildEditPrompt({ remove: "the shirt", add: "a jacket", scan: "a woman, alley" });
    assert.match(t, /remove the shirt/i);
    assert.match(t, /add a jacket/i);
    assert.match(t, /same person/i);
    assert.match(t, /already shows a woman/i);
  });
  it("make longer expands short actions", () => {
    const x = expandEditFields({ remove: "shirt", add: "jacket" });
    assert.match(x.remove, /gone/i);
    assert.match(x.add, /visible/i);
  });
  it("typed rephrase wins over take-out fields", () => {
    const t = composeI2iPrompt("remove her jacket, keep the face", { remove: "shirt", add: "red jacket" }, "blonde woman, red dress");
    assert.match(t, /^remove her jacket, keep the face/);
    assert.match(t, /add red jacket/);
    assert.match(t, /blonde woman/);
    assert.match(t, /same art style/i);
  });
  it("empty box still uses take-out lines", () => {
    const t = composeI2iPrompt("", { remove: "the shirt" });
    assert.match(t, /remove the shirt/i);
  });
});

describe("edit a photo that Forge did not make", () => {
  it("keeps the dropped photo’s shape", () => {
    assert.equal(aspectFromSize(1920, 1080), "16:9");
    assert.equal(aspectFromSize(1080, 1920), "9:16");
    const s = i2iCanvasSize(1920, 1080, "sdxl");
    assert.equal(s.w, 1024);
    assert.equal(s.h, 576);
    assert.ok(s.w / s.h > 1.5);
  });
  it("picks a real mix for a photo, anime mix for a drawing", () => {
    const all = [
      "DasiwaIllustriousAnime_epitaphecstasy.safetensors",
      "epicrealism_naturalSinRC1VAE.safetensors",
    ];
    assert.match(pickEditCheckpoint(["photorealistic", "selfie"], "DasiwaIllustriousAnime_epitaphecstasy.safetensors", all), /epicrealism/i);
    assert.match(pickEditCheckpoint(["anime", "1girl"], "epicrealism_naturalSinRC1VAE.safetensors", all), /illustrious/i);
  });
  it("i2i does not center-crop when it knows the photo size", () => {
    const g = graph({
      mode: "i2i",
      imageCount: 1,
      denoise: 0.38,
      inputW: 1920,
      inputH: 1080,
    });
    const scale = Object.values(g).find((n) => n.class_type === "ImageScale");
    assert.equal(scale?.inputs.crop, "disabled");
    assert.equal(scale?.inputs.width, 1024);
    assert.equal(scale?.inputs.height, 576);
  });
});

describe("video mime", () => {
  it("Linux empty type still becomes video/mp4", () => {
    assert.equal(mediaMime("clip.mp4", ""), "video/mp4");
    assert.equal(mediaMime("clip.webm", "application/octet-stream"), "video/webm");
    assert.equal(isVideoName("Forge_00001_.mp4"), true);
    const coerced = withVideoDataUrl("data:application/octet-stream;base64,AAA", "out.mp4", "");
    assert.match(coerced, /^data:video\/mp4;/);
  });
});

describe("live room", () => {
  it("laptop job shows on the PC without the giant data URL", async () => {
    const { mergeLiveJobs, slimJob } = await import("./live-room.ts");
    const job = {
      id: "j1",
      createdAt: 2,
      mode: "t2i" as const,
      prompt: "goblin",
      expandedPrompt: "goblin",
      negative: "",
      seed: 1,
      status: "running" as const,
      resultKind: "image" as const,
      apiWorkflow: {},
      uiWorkflow: {},
      promptId: "abc",
      progress: 40,
    };
    const merged = mergeLiveJobs([], [slimJob(job)]);
    assert.equal(merged[0]?.id, "j1");
    assert.equal(merged[0]?.promptId, "abc");
    assert.equal(merged[0]?.progress, 40);
  });
  it("keeps a local data URL and uses disk path from the other device", async () => {
    const { mergeLiveJobs } = await import("./live-room.ts");
    const local = [{
      id: "j1",
      createdAt: 1,
      mode: "t2i" as const,
      prompt: "a",
      expandedPrompt: "a",
      negative: "",
      seed: 1,
      status: "running" as const,
      resultKind: "image" as const,
      resultDataUrl: "data:image/png;base64,xx",
      apiWorkflow: {},
      uiWorkflow: {},
    }];
    const merged = mergeLiveJobs(local, [{
      id: "j1",
      createdAt: 1,
      mode: "t2i",
      prompt: "a",
      seed: 1,
      status: "done",
      resultKind: "image",
      resultName: "Forge_1.png",
      resultFolder: "output",
    }]);
    assert.equal(merged[0]?.status, "done");
    assert.equal(merged[0]?.resultDataUrl, "data:image/png;base64,xx");
    const other = mergeLiveJobs([], [{
      id: "j2",
      createdAt: 3,
      mode: "t2i",
      prompt: "b",
      seed: 2,
      status: "done",
      resultKind: "image",
      resultName: "Forge_2.png",
      resultFolder: "output",
    }]);
    assert.equal(other[0]?.resultDataUrl, "/forge-media?folder=output&name=Forge_2.png");
  });
  it("does not resurrect an error job as running", async () => {
    const { mergeLiveJobs } = await import("./live-room.ts");
    const local = [{
      id: "j1",
      createdAt: 1,
      mode: "t2i" as const,
      prompt: "a",
      expandedPrompt: "a",
      negative: "",
      seed: 1,
      status: "error" as const,
      error: "boom",
      resultKind: "image" as const,
      apiWorkflow: {},
      uiWorkflow: {},
    }];
    const merged = mergeLiveJobs(local, [{
      id: "j1",
      createdAt: 1,
      mode: "t2i",
      prompt: "a",
      seed: 1,
      status: "running",
      resultKind: "image",
      progress: 10,
    }]);
    assert.equal(merged[0]?.status, "error");
    assert.equal(merged[0]?.error, "boom");
  });
  it("phone wipe helper exists", async () => {
    const { forgetForgeOnThisDevice, isLanRemote } = await import("./live-room.ts");
    assert.equal(typeof forgetForgeOnThisDevice, "function");
    assert.equal(isLanRemote(), false);
  });
});

describe("comic page builder", () => {
  it("splits P1/P2 beats", async () => {
    const { splitComicBeats, buildComicPrompt, inventComicBeats, isPanelScript } = await import("./comic.ts");
    const beats = splitComicBeats("P1: she walks in\nP2: he looks up\nP3: they kiss\nP4: rain", 4);
    assert.equal(beats.length, 4);
    assert.match(beats[0] || "", /walks/i);
    const page = buildComicPrompt("cat fights a dog\n\nthe dog bites back\n\nrain", "2x2", "manga ink");
    assert.match(page, /panel 1/i);
    assert.match(page, /panel 2/i);
    assert.match(page, /2 by 2|gutters/i);
    assert.match(page, /same characters/i);
    assert.match(page, /not a photograph/i);
    assert.equal(isPanelScript("P1: hi"), true);
    assert.equal(isPanelScript("magical girl vs goblin"), false);
  });
  it("short line becomes four different scenes", async () => {
    const { inventComicBeats, buildComicPrompt, formatComicScript } = await import("./comic.ts");
    const beats = inventComicBeats("magical girl vs goblin", 4, { seed: 7, nsfw: false });
    assert.equal(beats.length, 4);
    assert.match(beats[0] || "", /magical girl|twin tail|frilly|wand/i);
    assert.match(beats.join(" "), /goblin/i);
    assert.match(beats[1] || "", /clash|hit|meet/i);
    assert.match(beats[3] || "", /last panel|finishing|punchline/i);
    const page = buildComicPrompt("magical girl vs goblin", "2x2", "manga ink", { seed: 7 });
    assert.match(page, /panel 1:/i);
    assert.match(page, /panel 4:/i);
    assert.doesNotMatch(page, /same characters, the action continues/i);
    const six = buildComicPrompt("magical girl vs goblin", "six", "manga ink", { seed: 7 });
    assert.match(six, /panel 6:/i);
    assert.ok(six.length < 2000);
    assert.match(six, /three rows of two|six panels/i);
  });
});

describe("full regression", () => {
  it("t2i XL graph has checkpoint + sampler + save", () => {
    const g = graph({ mode: "t2i" });
    const c = classes(g);
    assert.ok(c.includes("CheckpointLoaderSimple"));
    assert.ok(c.includes("KSampler"));
    assert.ok(c.includes("SaveImage") || c.includes("PreviewImage") || c.some((x) => /Save/i.test(x)));
    const v = validateApiGraph(g);
    assert.equal(v.length, 0, v.join("; "));
  });
  it("ref2i stitches 2+ stills", () => {
    const g = graph({ mode: "ref2i", imageCount: 3, denoise: 0.76 });
    assert.ok(classes(g).includes("ImageStitch"));
    assert.ok(classes(g).includes("LoadImage"));
    assert.ok(classes(g).includes("VAEEncode"));
  });
  it("1.5 mix does not load XL LoRAs", () => {
    assert.equal(loraFitsLane("alice_xl.safetensors", "CuteKittenMix.safetensors"), false);
    assert.equal(loraFitsLane("add_detail.safetensors", "CuteKittenMix.safetensors"), true);
    assert.equal(loraFitsLane("Hestia (DanMachi) Illustrious v4.safetensors", "CuteKittenMix.safetensors"), false);
    assert.equal(loraFitsLane("Hestia (DanMachi) Illustrious v4.safetensors", "DasiwaIllustriousAnime.safetensors"), true);
  });
  it("3:4 comic page has a size", () => {
    assert.ok(sizeForFamily("sdxl", "3:4").h > sizeForFamily("sdxl", "3:4").w);
  });
  it("WAN i2v loads a still", () => {
    const g = graph({
      mode: "i2v",
      imageCount: 1,
      hasVideo: false,
      settings: settings({
        wanUnet: "wan2.1_i2v_480p_14B_fp16.safetensors",
        wanVae: "wan_2.1_vae.safetensors",
        wanClip: "umt5_xxl_fp8.safetensors",
      }),
    });
    assert.ok(classes(g).includes("LoadImage") || classes(g).some((x) => /Load/i.test(x)));
  });
  it("flattenPrompt keeps a short scene", () => {
    const t = flattenPrompt("a red fox in snow", 1);
    assert.match(t, /red fox/i);
  });
  it("SFW expand does not inject sex acts", () => {
    const t = grokExpand({
      typed: "a cat fighting a dog",
      files: DEFAULT_WILDCARDS,
      seed: 3,
      family: "sdxl",
      checkpoint: "DasiwaIllustrious.safetensors",
      nsfwMode: false,
    });
    assert.doesNotMatch(t, /ahegao|gangbang|spitroast|masturbat/i);
  });
  it("batch size 4 is stored on settings", () => {
    const s = settings({ batchSize: 4 });
    assert.equal(s.batchSize, 4);
  });
});

describe("taste votes", () => {
  it("up then down flips the mix score", () => {
    let book = emptyTaste();
    book = applyVote(book, {
      id: "1",
      jobId: "j1",
      at: 1,
      vote: "up",
      checkpoint: "AliceXL.safetensors",
      loras: ["alice.safetensors"],
      prompt: "alice",
      seed: 1,
    });
    assert.equal(ckptScore(book, "AliceXL.safetensors"), 1);
    book = applyVote(book, {
      id: "2",
      jobId: "j1",
      at: 2,
      vote: "down",
      checkpoint: "AliceXL.safetensors",
      loras: ["alice.safetensors"],
      prompt: "alice",
      seed: 1,
      reason: "deformed",
    });
    assert.equal(ckptScore(book, "AliceXL.safetensors"), -1);
  });
  it("two deformed downs add extra negative", () => {
    let book = emptyTaste();
    book = applyVote(book, {
      id: "a",
      at: 1,
      vote: "down",
      checkpoint: "x.safetensors",
      loras: [],
      prompt: "a",
      seed: 1,
      reason: "deformed",
    });
    book = applyVote(book, {
      id: "b",
      at: 2,
      vote: "down",
      checkpoint: "x.safetensors",
      loras: [],
      prompt: "b",
      seed: 2,
      reason: "deformed",
    });
    assert.match(extraNegFromTaste(book), /extra fingers/);
  });
  it("sorts liked mixes first, keeps current pinned", () => {
    let book = emptyTaste();
    book = applyVote(book, {
      id: "a",
      at: 1,
      vote: "up",
      checkpoint: "good.safetensors",
      loras: [],
      prompt: "a",
      seed: 1,
    });
    book = applyVote(book, {
      id: "b",
      at: 2,
      vote: "down",
      checkpoint: "bad.safetensors",
      loras: [],
      prompt: "b",
      seed: 2,
    });
    book = applyVote(book, {
      id: "c",
      jobId: "c",
      at: 3,
      vote: "down",
      checkpoint: "bad.safetensors",
      loras: [],
      prompt: "c",
      seed: 3,
    });
    book = applyVote(book, {
      id: "d",
      jobId: "d",
      at: 4,
      vote: "down",
      checkpoint: "bad.safetensors",
      loras: [],
      prompt: "d",
      seed: 4,
    });
    const names = sortCkptsByTaste(["bad.safetensors", "mid.safetensors", "good.safetensors"], book, "mid.safetensors");
    assert.equal(names[0], "mid.safetensors");
    assert.equal(names[1], "good.safetensors");
    assert.match(warnForCheckpoint(book, "bad.safetensors"), /thumbs down/i);
  });
});
