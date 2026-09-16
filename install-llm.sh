#!/bin/bash
# Local uncensored writer for Forge. Run on the T1000 OR on your other server.
# Nobody outside your LAN gets this unless you port-forward (don't).
set -euo pipefail

if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama…"
  curl -fsSL https://ollama.com/install.sh | sh
fi

# LAN access (phone/laptop on same Wi-Fi). For this-PC-only, skip these two lines.
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' | sudo tee /etc/systemd/system/ollama.service.d/host.conf >/dev/null
sudo systemctl daemon-reload || true
sudo systemctl enable --now ollama || true
sudo systemctl restart ollama || true

echo "Pulling dolphin-llama3 (uncensored-ish 8B). First time is a few GB."
ollama pull dolphin-llama3

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "Ollama is local."
echo "  This machine:  http://127.0.0.1:11434"
echo "  LAN:           http://${IP:-YOUR-IP}:11434"
echo
echo "In Forge Settings → Local writer:"
echo "  URL   = http://127.0.0.1:11434     (if Ollama is on the T1000)"
echo "  URL   = http://${IP:-SERVER-IP}:11434  (if Ollama is on this server)"
echo "  Model = dolphin-llama3"
echo
echo "Do NOT port-forward 11434 on the router."
