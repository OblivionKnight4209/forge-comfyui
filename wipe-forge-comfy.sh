#!/bin/bash
# Wipe Forge leftover graphs + Comfy prompt history.
# Does NOT delete models, LoRAs, custom_nodes, or output images.
set -euo pipefail

COMFY="${COMFY_ROOT:-$HOME/comfy/ComfyUI}"
if [ ! -d "$COMFY" ]; then
  if [ -d "$HOME/ComfyUI" ]; then
    COMFY="$HOME/ComfyUI"
  fi
fi

echo "Comfy root: $COMFY"
echo "This deletes Forge-made workflow json + Comfy queue history."
echo "Models / LoRAs / custom_nodes / output pictures stay."
echo
read -r -p "Type YES to wipe: " ok
[ "$ok" = "YES" ] || { echo "Aborted."; exit 1; }

pkill -f "ComfyUI/main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

deleted=0
for dir in \
  "$COMFY/user/default/workflows" \
  "$COMFY/user/workflows" \
  "$COMFY/workflows"
do
  [ -d "$dir" ] || continue
  echo "-- $dir"
  count=$(find "$dir" -maxdepth 1 -type f \( -iname 'forge*.json' -o -iname 'Forge*.json' \) | wc -l)
  find "$dir" -maxdepth 1 -type f \( -iname 'forge*.json' -o -iname 'Forge*.json' \) -print -delete
  deleted=$((deleted + count))
done

rm -f "$COMFY/user/default/comfy.db" "$COMFY/user/comfy.db" "$COMFY/comfy.db" 2>/dev/null || true
rm -rf "$COMFY/user/default/history" "$COMFY/user/history" "$COMFY/temp" "$COMFY/user/default/.cache" 2>/dev/null || true

curl -sS -X POST "http://127.0.0.1:8188/history" -H "content-type: application/json" -d '{"clear":true}' >/dev/null 2>&1 || true
curl -sS -X POST "http://127.0.0.1:8188/queue" -H "content-type: application/json" -d '{"clear":true}' >/dev/null 2>&1 || true

echo
echo "Deleted $deleted Forge workflow json files."
echo "Next: start Comfy, then ./start-forge.sh, then Ctrl+Shift+R."
