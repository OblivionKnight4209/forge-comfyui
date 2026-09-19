#!/usr/bin/env python3
"""Patch ~/forge writer so hentai stays hentai, fights stay fights, one sex act."""
from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
path = root / "src/lib/forge/wildcards.ts"
if not path.exists():
    sys.exit(f"No {path}. Run this from ~/forge")

text = path.read_text(encoding="utf-8")
if "DEMON_ANGEL_BEAT" in text and "wantsAnime" in text and "ACT_RE" in text:
    print("Writer fix already in this copy.")
    sys.exit(0)

marker = "export function wantsSexAct"
if marker not in text and "function wantsSexAct" not in text:
    sys.exit("wildcards.ts does not look like Forge writer. Abort.")
if marker not in text:
    marker = "function wantsSexAct"

inject = """
export function wantsAnime(text: string) {
  return /\\b(hentai|anime|manga|2d|toon|cel[- ]?shad|illustration|illustrious|noobai|nai|pony)\\b/i.test(text || "");
}
export function wantsPhoto(text: string) {
  return /\\b(photo(?:graph|real)?|35mm|photoreal|real skin|live[- ]action)\\b/i.test(text || "");
}
const ACT_RE =
  /\\b(fuck(?:s|ed|ing)?|penetrat(?:e|es|ed|ion)?|blowjob|handjob|cowgirl|doggy|missionary|prone|oral|lick(?:s|ing)?|thrust(?:s|ing)?|pound(?:s|ing)?|grind(?:s|ing)?|rides?|riding|drops?|standing|rape(?:d|s)?|sex|strip(?:s|ping)?|undress(?:es|ing)?)\\b/i;
"""

if "export function wantsAnime" not in text:
    text = text.replace(marker, inject + "\n" + marker, 1)

replacements = [
    (
        'if (!/\\b(fuck|penetrat|blowjob|rides?|doggy|missionary|oral|lick|thrust|pound|grind|rape|raped|sex|strip|undress)\\b/i.test(`${lead} ${o}`)) extra.push(pickFrom(HARDCORE_ACT, rng));',
        'if (!ACT_RE.test(`${lead} ${o}`)) extra.push(pickFrom(HARDCORE_ACT, rng));',
    ),
    (
        "`adult woman, ${pickFrom(WOMAN_LOOK.body, rng)}, ${pickFrom(WOMAN_LOOK.face, rng)}, ${pickFrom(WOMAN_LOOK.hair, rng)}, wearing ${pickFrom(SKIMPY_LOOK, rng)}`",
        "`${pickFrom(WOMAN_LOOK.body, rng)}, ${pickFrom(WOMAN_LOOK.face, rng)}, ${pickFrom(WOMAN_LOOK.hair, rng)}, wearing ${pickFrom(SKIMPY_LOOK, rng)}`",
    ),
    (
        'const src = `${lead} ${out}`;\n  const c = lookCast(src);',
        'const c = lookCast(lead);',
    ),
]

n = 0
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        n += 1

old_anime = """  const anime =
    opts.family === \"sd15\" ||
    (/mix|anime|kitten|illustrious|noob|nai|pony/.test(ckpt) && !ckpt.includes(\"flux\"));"""
new_anime = """  const anime =
    (typeof wantsAnime === \"function\" && wantsAnime(raw || lead0 || \"\")) ||
    opts.family === \"sd15\" ||
    (/mix|anime|kitten|illustrious|noob|nai|pony/.test(ckpt) && !ckpt.includes(\"flux\"));"""
if old_anime in text:
    text = text.replace(old_anime, new_anime)
    n += 1

path.write_text(text, encoding="utf-8")
print(f"Patched {path} ({n} replacements). Restart Forge, Ctrl+Shift+R.")
