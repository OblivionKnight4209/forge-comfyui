#!/bin/bash
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This folder is a zip dump. Clone the repo instead."
  exit 1
fi
git fetch origin --depth 120 || true
if ! git checkout b051a43b564e5bdeb4a3cea92b9dcdfbd5e5cedf -- src/components/forge/studio.tsx; then
  echo "Could not restore studio.tsx from git history."
  exit 1
fi
python3 - <<'PY'
from pathlib import Path
p = Path("src/components/forge/studio.tsx")
t = p.read_text()
t = t.replace("readOnly={negLocked}", "readOnly={false}")
if "expand-lock" not in t:
    t = t.replace(
        'from "@/lib/forge/wildcards";',
        'from "@/lib/forge/wildcards";\nimport { grokExpand as lockedExpand } from "@/lib/forge/expand-lock";',
        1,
    )
    t = t.replace("grokExpand(", "lockedExpand(")
p.write_text(t)
print("studio restored: Mixes tab + editable negative + lead-lock writer")
PY
