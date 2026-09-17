# Forge

Local cockpit for ComfyUI on the T1000. Ollama writer on Skynet. No cloud.

**Setup (read this):** [SETUP.md](SETUP.md)

**Code is on `main`.** `releases/latest/download/Forge-offline.zip` is still the old v219 zip until a Release named v233 exists with a zip attached. Clone ignores that zip and takes `main`.

Repo: https://github.com/OblivionKnight4209/forge-comfyui

```bash
pkill -f "vite|npm run dev" 2>/dev/null || true
rm -rf ~/forge
git clone --depth 1 https://github.com/OblivionKnight4209/forge-comfyui.git ~/forge
cd ~/forge && chmod +x start-forge.sh && ./start-forge.sh
```

Top-left and `start-forge.sh` should print **233**.
