#!/bin/bash
# Offline neural voices for Forge clips (Piper). Needs the net once.
set -euo pipefail
DIR="${PIPER_HOME:-$HOME/.local/share/piper}"
mkdir -p "$DIR/voices"
cd "$DIR"

if [ ! -x "$DIR/piper" ] || [ -d "$DIR/piper" ]; then
  echo "Downloading Piper (linux x86_64)…"
  curl -fL --retry 3 -o piper.tgz \
    https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
  rm -rf "$DIR/_piper_unpack"
  mkdir -p "$DIR/_piper_unpack"
  tar -xzf piper.tgz -C "$DIR/_piper_unpack"
  BIN=$(find "$DIR/_piper_unpack" -type f -name piper | head -1)
  if [ -z "$BIN" ]; then
    echo "piper binary missing from tarball"
    exit 1
  fi
  DATA=$(find "$DIR/_piper_unpack" -type d -name espeak-ng-data | head -1)
  install -m 755 "$BIN" "$DIR/piper"
  if [ -n "$DATA" ]; then
    rm -rf "$DIR/espeak-ng-data"
    cp -a "$DATA" "$DIR/espeak-ng-data"
  fi
  rm -rf piper.tgz "$DIR/_piper_unpack"
fi

download_voice() {
  local name="$1"
  local slug="$2"
  local base="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/${slug}/medium"
  if [ -f "$DIR/voices/${name}.onnx" ]; then
    echo "have $name"
    return
  fi
  echo "Downloading $name…"
  curl -fL --retry 3 -o "$DIR/voices/${name}.onnx" "${base}/${name}.onnx"
  curl -fL --retry 3 -o "$DIR/voices/${name}.onnx.json" "${base}/${name}.onnx.json"
}

download_voice "en_US-lessac-medium" "lessac"
download_voice "en_US-ryan-medium" "ryan"

echo
echo "Piper voices ready in $DIR"
ls -lh "$DIR/piper" "$DIR/voices"/*.onnx
echo
echo "Restart Forge, keep Sound on, generate a clip."
