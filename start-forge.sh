#!/bin/bash
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First launch: installing local packages (needs the net once). After this, Forge is offline."
  npm install
fi
echo
echo "Forge v269 — local only"
echo "Keep ComfyUI running:"
echo "  cd ~/comfy/ComfyUI && source .venv/bin/activate && python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header"
echo "This PC: http://127.0.0.1:8080"
echo "Laptop / phone: http://$(hostname -I | awk '{print $1}'):8080"
echo "Corner must say 269."
echo
npm run dev
