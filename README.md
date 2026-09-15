# Forge

Local cockpit for ComfyUI on the T1000. Ollama writer on Skynet. No cloud.

**Setup (read this):** [SETUP.md](SETUP.md)

**Latest zip:** [Releases](https://github.com/OblivionKnight4209/forge-comfyui/releases)

```bash
cd ~/Downloads
wget -O Forge-offline.zip https://github.com/OblivionKnight4209/forge-comfyui/releases/latest/download/Forge-offline.zip
rm -rf ~/forge && mkdir -p ~/forge
unzip -o Forge-offline.zip -d ~/forge
cd ~/forge && chmod +x start-forge.sh && ./start-forge.sh
```
