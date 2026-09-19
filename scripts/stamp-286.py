#!/usr/bin/env python3
"""Force the on-screen badge to 286 so you can see the pull landed."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
(root / "VERSION").write_text("286\n", encoding="utf-8")
hits = []
for p in list(root.rglob("*.tsx")) + list(root.rglob("*.ts")) + [root / "start-forge.sh"]:
    if not p.exists() or "node_modules" in p.parts:
        continue
    t = p.read_text(encoding="utf-8")
    n = re.sub(r"(text-subtle\">)2\d{2}(<)", r"\g<1>286\2", t)
    n = n.replace("Forge v285", "Forge v286").replace("not say 285", "not say 286")
    n = n.replace("Forge v284", "Forge v286").replace("Forge v283", "Forge v286").replace("Forge v282", "Forge v286")
    if n != t:
        p.write_text(n, encoding="utf-8")
        hits.append(str(p.relative_to(root)))
print("VERSION 286")
print("patched:", hits or "already 286")
