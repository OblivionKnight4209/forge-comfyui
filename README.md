# Forge v250

Offline studio on your Linux Mint PC. **Forge is the cockpit. ComfyUI is the engine.** Nothing is sent to Grok or any cloud for generate / write / video.

Repo: [OblivionKnight4209/forge-comfyui](https://github.com/OblivionKnight4209/forge-comfyui)

---

## What it does

Forge talks to **your** ComfyUI at `http://127.0.0.1:8188`. You pick a mix (checkpoint), type a scene, tap Generate. Forge builds a real Comfy graph (checkpoint + CLIP skip + LoRAs + sampler + save) and queues it. The still or clip lands in the middle of the page. Files live in Comfy’s `output` / `input` folders.

Same Wi-Fi phone or laptop can open Forge and tap Generate — the **T1000 GPU** still does the work. Prompts stay on the device you typed on unless you tap Generate.

Unfiltered. No account. No live-preview site.

---

## Install / update (every new version)

On the T1000. Always `cd "$HOME"` first so you are not inside a deleted folder.

```bash
cd "$HOME"
pkill -f "vite|npm run dev" 2>/dev/null || true
rm -rf "$HOME/forge"
mkdir -p "$HOME/forge"
cd "$HOME/Downloads"
wget -O Forge-offline.zip https://github.com/OblivionKnight4209/forge-comfyui/releases/download/v250/Forge-offline.zip
unzip -o Forge-offline.zip -d "$HOME/forge"
cd "$HOME/forge"
chmod +x start-forge.sh
./start-forge.sh
```

The script must print **Forge v250**. Top-left corner of the page must say **250**. Hard refresh (`Ctrl+Shift+R`). If it still says 219, you unzipped an old zip.

Keep Comfy running in another terminal:

```bash
cd ~/comfy/ComfyUI
source .venv/bin/activate
python main.py --listen 0.0.0.0 --port 8188
```

- This PC: http://127.0.0.1:8080
- Phone / laptop (same Wi-Fi): http://192.168.1.7:8080  (not 127.0.0.1)
- Display-only: http://127.0.0.1:8080/stage
- Clip sound: `sudo apt install -y ffmpeg espeak-ng`

First launch runs `npm install` once (needs the net). After that Forge is offline.

---

## Tabs (they do not share the stage)

| Tab | What you see | What Generate does |
|---|---|---|
| **Image** | One still in the **center** (or a batch grid) | Text → photo. Drop a photo first = edit that photo. |
| **Video** | Clip in the center | Text → clip, or Play on a still → animate it. Sound muxed after. |
| **Combine** | 2–5 slots | Tap a library still to **preview**. Mix adds it. **Two photos = first photo is the canvas** (Grok-style). 3+ still grids. Never loads a 1.5 VAE on XL (that was the rainbow melt). |
| **People** | Character LoRAs by show | Tap a name. The box gets **canon look** (hair, eyes, clothes, show). Creator / Write keep that person, not a generic girl. |
| **Comic** | Layout + ink chips | One **page** with panels. Image tab never uses this. |
| **Library** | Comfy input + output | Tap to enlarge. Edit / Mix / Play send it to that tab. Shred deletes. |
| **Mixes** | Checkpoint list | Same prompt + locked seed on every mix you tick. Each result has **Redo** (queue that mix again) and **Remake** (load mix + seed to tweak). |

Switching Image ↔ Comic **clears the other tab’s picture**. Comic builder stays on Comic. Photos stay on Image.

---

## Buttons under the prompt

- **Write** — fills the box. Short subject (`goblin fights a knight`) becomes a full scene: who, body, clothes, place, camera, light. Ticks you pick (Sex, BDSM, Who…) get added. Does **not** queue Comfy.
- **Creator** — new takes / comic beats / Ollama if it is running. Tap a take to put it in the box.
- **Generate** — queues Comfy. Does not rewrite the prompt. If the box is empty, it will not invent a random scene.
- **Hires** — extra upscale pass on text→image (sharper, slower).
- **Batch** — 1 → 2 → 4 stills from one prompt (cycles).
- **Look** — art wrap (anime / real / toon) + quality chips. Neutral until you pick one.
- **People** — person / show-character LoRAs that **fit this mix** (Hestia, Raphtalia, Alice…). Tap one: name goes in the box, LoRA turns on. Not sex-act LoRAs. Image first for XL people; WAN video ignores them.
- **Mic** — Chrome / Edge / Safari. Firefox has no speech API.

**Seed:** lock it to retry the same noise. Unlock for a new roll. Mixes locks the seed so you can compare checkpoints.

**Neg:** locked stays what you typed. Unlocked, Forge picks a mix-aware negative (deformed hands, extra limbs, etc.).

---

## Image

1. Pick a mix in Settings (or Mixes).
2. Type a subject. Write if you want it expanded.
3. Generate. The still appears **centered**.
4. Click the still to enlarge (arrows to move). Thumbs up / down teach taste.
5. **Play** on the still → Video tab, that frame locked.

**Edit a photo:** drop it (or Library → Edit). Type only the change (`remove the jacket`). Write/Creator fill the change, they do not replace the photo. Generate runs img2img / inpaint at low denoise so the rest of the picture stays.

---

## Combine (v238)

Was blurry because it shrunk the photos, cropped the collage, then ran a *light* edit. That kept a split and smeared faces.

Now:
1. Combine tab. Slot 1, then a **different** second photo (Library or drop). Up to 5.
2. Type the new scene: who is together, where.
3. Generate. Photos stay large, stitched, then **rewritten** at high denoise (~0.82) into **one** photograph, then a sharpen pass.

You should get one sharp picture, not a diptych. Comic is a different tab — Combine does not make a comic page.

---

## Video

Needs a **WAN 2.1** unet in Settings (16 channels). WAN 2.2 (48 channels) will error.

- No still → text to clip.
- Still dropped or Play → image to clip (the frame stays).
- Type the **move** (`she turns, rain, they clash`), not a still prompt.
- 6s / 10s / 15s stitches segments.
- Sound: ffmpeg + espeak-ng after the clip (not a talking movie — WAN has no speech model). “MM” / wind-only was a bad default; v233+ drops that.

---

## Mixes

Tick the checkpoints you want. Prompt + **locked seed**. Generate queues them one after another. On each still: **Redo** = same mix, same seed, queue again. **Remake** = load that mix + seed + prompt so you can tweak, then Generate.

---

## Mixes, LoRAs, characters

- **Checkpoint** = the art style / base. Pick one that matches (Illustrious/Anima for anime, Pony, 1.5, Flux).
- **LoRA** = extra (a person, an act, a detail). Forge only stacks LoRAs that **fit that mix** (no XL LoRA on a 1.5 mix).
- **Characters** = LoRAs named like a person / show character. Tap one; the trigger stays in the box. WAN video ignores XL people LoRAs.

Corrupt files (`safetensors header is incomplete`) must be deleted from `models/loras`. Incomplete `.part` downloads are not models.

---

## Scan / detector

After a still, WD14 tags what is in it (if the Impact/WD14 node is installed). First run downloads an onnx model — wait, then Scan again. Boxes are optional.

---

## Settings that actually change the picture

| Control | When to touch it |
|---|---|
| Mix / checkpoint | Always. Wrong mix = garbage. |
| Steps / CFG / sampler | Auto from the mix. Leave unless you know. |
| CLIP skip | XL/Pony often −2. Flux/1.5 leave. |
| Hires | Sharper stills, more VRAM/time. |
| Denoise | Edit photo: low (~0.35). Combine: Forge forces ~0.82. |
| SFW / NSFW | NSFW off = no sex chips. On = uncensored writer. |

---

## LAN (phone / laptop)

Same Wi-Fi. Open `http://192.168.1.7:8080`. Generate hits the T1000, not the phone GPU. If Generate does nothing, Comfy is off or you used `127.0.0.1` on the phone.

Forge does not store thumbnails on the phone’s disk as Comfy files. Browser cache can keep a preview — use private mode or clear site data if you care.

---

## Files Forge does **not** move

Comfy models stay where they are:

```
~/comfy/ComfyUI/models/checkpoints
~/comfy/ComfyUI/models/loras
~/comfy/ComfyUI/models/vae
~/comfy/ComfyUI/models/diffusion_models
~/comfy/ComfyUI/models/text_encoders
~/comfy/ComfyUI/models/controlnet
~/comfy/ComfyUI/models/upscale_models
~/comfy/ComfyUI/output
~/comfy/ComfyUI/input
```

Forge only **reads** those lists and **queues** graphs.

---

## Version

`VERSION` in the zip is the number. The start script prints it. The corner paints it. If they disagree, you have a mixed install — run the update command above, do not copy files by hand on top of an old `~/forge`.
