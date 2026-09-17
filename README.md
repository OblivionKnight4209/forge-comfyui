# Forge v255

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
wget -O Forge-offline.zip https://github.com/OblivionKnight4209/forge-comfyui/releases/download/v255/Forge-offline.zip
unzip -o Forge-offline.zip -d "$HOME/forge"
cd "$HOME/forge"
chmod +x start-forge.sh
./start-forge.sh
```

The script must print **Forge v255**. Top-left corner of the page must say **255**. Hard refresh (`Ctrl+Shift+R`). If it still says 219, you unzipped the old zip.

## Storytime
Top tab **Storytime**. Paste a full scene or type a short idea.
- A long paragraph or numbered scenes stay yours — Auto story / Creator split that text. They do not replace it with a canned plot.
- A short idea gets a 6-beat arc that still repeats the idea in every beat.
- **Split what I wrote** only slices the box.
- Tap a beat chip, then **Generate** for one shot. After a beat finishes it steps to the next chip.
- **Lock cast on** (default): after a beat finishes, the still becomes the next source so faces hold (img2img).
- **Next chapter** writes one more beat that follows the last line.
- SFW / NSFW in Settings applies to every beat.
Comic tab is still one page. Storytime is one still per beat, in order.

Keep Comfy running in another terminal:

```bash
cd ~/comfy/ComfyUI
source .venv/bin/activate
python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header
```
