#!/bin/bash
# Forge — run on the same Linux Mint PC as ComfyUI. Offline after the first npm install.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Linux Mint: Software Manager → search Node.js (22 or newer), install, then run this again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First launch: installing local packages (needs the net once). After this, Forge is offline."
  npm install
fi

echo
echo "Forge v180 — local only"
echo "Keep ComfyUI running:"
echo "  cd ~/comfy/ComfyUI && source .venv/bin/activate && python main.py --listen 0.0.0.0 --port 8188"
echo
echo "This PC (controls):  http://127.0.0.1:8080"
echo "This PC (display):   http://127.0.0.1:8080/stage"
echo "Laptop / phone:      http://$(hostname -I | awk '{print $1}'):8080"
echo "If the top-left does not say 180, you unzipped the old zip."
echo "Sound on clips needs:  sudo apt install -y ffmpeg espeak-ng"
echo "Laptop: same Wi-Fi, http://$(hostname -I | awk '{print $1}'):8080  (not 127.0.0.1)"
echo

npm run dev
