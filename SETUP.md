# Forge + ComfyUI — your machines

Offline studio. Comfy generates. Forge is the cockpit. Ollama on Skynet writes prompts. Nothing is sent to Grok or the internet for gen/write.

| Machine | Role | LAN |
|---|---|---|
| **T1000** (Mint 22.3, i9-13900K, 64 GB, RTX 4080 16 GB) | ComfyUI + Forge | `192.168.1.7` |
| **skynet** (Debian 13, Alienware X51 R3, i5-6400, 8 GB, iGPU only) | Ollama writer | `192.168.1.165` |

Do **not** port-forward `8188`, `8080`, or `11434` on the router.

---

## After a reboot

### T1000

```bash
cd ~/comfy/ComfyUI
source .venv/bin/activate
python main.py --listen 0.0.0.0 --port 8188
```

Leave that terminal open. Then:

```bash
cd ~/forge
./start-forge.sh
```

Open http://127.0.0.1:8080  
Phone/laptop on same Wi-Fi: http://192.168.1.7:8080

### skynet (writer)

Ollama is a systemd service. It should come back by itself.

```bash
systemctl status ollama --no-pager
ss -lptn | grep 11434
curl -s http://127.0.0.1:11434/api/tags
```

If it is dead:

```bash
systemctl start ollama
# if systemd bus is broken:
OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve >/var/log/ollama.log 2>&1 &
```

LAN bind (already in `/etc/systemd/system/ollama.service.d/host.conf`):

```
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

From T1000:

```bash
curl -sS -m 5 http://192.168.1.165:11434/api/tags
```

---

## Forge settings (T1000, in the app)

| Setting | Value |
|---|---|
| ComfyUI address | `http://127.0.0.1:8188` |
| Local writer URL | `http://127.0.0.1:11434` (T1000 CPU Ollama) |
| Writer model | `huihui_ai/qwen2.5-abliterate:7b` (backup: `dolphin3:8b`) |

Keep Ollama **off the 4080**. On T1000, `/etc/systemd/system/ollama.service.d/cpu.conf` sets `OLLAMA_NUM_GPU=0`. Comfy holds the VRAM. Writer uses RAM + the i9.

Skynet (`192.168.1.165:11434`) is a spare 3B if T1000 Ollama is down.

---

## Folders on T1000

```
~/comfy/ComfyUI/                    Comfy install
  models/checkpoints/               SD1.5 / SDXL / Pony / Illustrious / Flux ckpt
  models/loras/                     LoRAs (not checkpoints)
  models/diffusion_models/          UNET / 3D / WAN weights
  models/text_encoders/             T5 / CLIP / Gemma encoder
  models/vae/
  wildcards/                        __name__ lists (thousands of .txt)
  custom_nodes/                     WD14, Impact, Easy-Use, VHS, …
  user/default/workflows/           saved graphs (Forge writes here too)

~/forge/                            this app (unzip each new zip here)
```

LoRAs that sat in Downloads belong in `models/loras/`. Junk (`.pth` pip files) does **not**.

Pose gallery zip (`galleryForComfyuiEasy_poseGyllery.zip`) goes in Comfy Easy-Use, not Forge:

```bash
EASY="$HOME/comfy/ComfyUI/custom_nodes/comfyui-easy-use/styles"
mkdir -p "$EASY/samples"
unzip -o ~/Downloads/galleryForComfyuiEasy_poseGyllery.zip -d /tmp/pose-gal
cp "/tmp/pose-gal/Krea2-Pose-Library-for-EasyUse/krea2_Pose-Library_姿势库.json" "$EASY/"
cp /tmp/pose-gal/Krea2-Pose-Library-for-EasyUse/samples/*.webp "$EASY/samples/"
```

---

## How to use Forge

1. Comfy running, Forge v173+, header **LLM** green, **ckpt** count not “No ComfyUI”.
2. Pick a checkpoint that matches the LoRA (Illustrious LoRA → Dasiwa / novaAnime XL, not CuteKittenMix).
3. Type a scene. **Write prompt** (or **Sex**) asks Skynet for 3 graphic ideas. Click one.
4. **Generate** sends your box as-is to Comfy (does not rewrite).
5. Drop a photo → **Edit photo** (img2img). Strength slider = how hard it overwrites.
6. `__hair__` chips insert a wildcard. **Roll** picks a line from `wildcards/`.
7. After a still: detector is **WD14** (booru tags), not the old color guess. Tap **Scan** if it is empty.
8. **Comfy graphs…** runs a saved json from `user/default/workflows` (API format). UI-only graphs open in Comfy.
9. **Play / video:** WAN 2.2 14B is two files (HIGH then LOW, same mix). High-only is pink static. Do not pair Dasiwa High with Rapid Low. Sound needs `sudo apt install -y ffmpeg espeak-ng` and **Sound on**.

---

## Update Forge

https://github.com/OblivionKnight4209/forge-comfyui/releases

```bash
pkill -f "vite|npm run dev" 2>/dev/null || true
rm -rf ~/forge && mkdir -p ~/forge
cd ~/Downloads
wget -O Forge-offline.zip https://github.com/OblivionKnight4209/forge-comfyui/releases/download/v206/Forge-offline.zip
unzip -o Forge-offline.zip -d ~/forge
cd ~/forge && chmod +x start-forge.sh && ./start-forge.sh
```

Top-left must match the zip version.

---

## First-time Skynet Ollama (already done once)

```bash
apt-get install -y curl
curl -fsSL https://ollama.com/install.sh | sh
mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' > /etc/systemd/system/ollama.service.d/host.conf
systemctl daemon-reload
systemctl enable --now ollama
unset OLLAMA_HOST
ollama pull dolphin-phi
ollama pull huihui_ai/qwen2.5-abliterate:3b
```

8 GB RAM: stay on a **3B** model. An 8B will swap.

---

## Ports

| Port | What | Bind |
|---|---|---|
| 8188 | ComfyUI | T1000 `0.0.0.0` |
| 8080 | Forge | T1000 `0.0.0.0` |
| 11434 | Ollama | Skynet `0.0.0.0` |

---

## GitHub

Repo: https://github.com/OblivionKnight4209/forge-comfyui  
Releases: zip per version (`Forge-offline.zip`).
