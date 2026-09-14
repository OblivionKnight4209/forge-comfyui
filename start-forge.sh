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
echo "Forge is local. Keep ComfyUI running:"
echo "  cd ~/comfy/ComfyUI && source .venv/bin/activate && python main.py --listen 0.0.0.0 --port 8188"
echo
echo "This PC:     http://127.0.0.1:8080"
echo "Phone/laptop: same Wi-Fi — use the LAN QR inside Forge"
echo

npm run dev
