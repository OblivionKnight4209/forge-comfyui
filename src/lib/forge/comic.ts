export type ComicLayout = {
  id: string;
  label: string;
  hint: string;
  panels: number;
  aspect: "2:3" | "3:4" | "9:16" | "1:1";
  tags: string;
};

export const COMIC_LAYOUTS: ComicLayout[] = [
  {
    id: "splash",
    label: "Splash",
    hint: "One full page",
    panels: 1,
    aspect: "2:3",
    tags: "comic splash page, full bleed, title box, single huge panel, printed ink",
  },
  {
    id: "4koma",
    label: "4koma",
    hint: "Four stacked gags",
    panels: 4,
    aspect: "9:16",
    tags: "4koma manga, four equal stacked panels, thin gutters, punchline in the last panel",
  },
  {
    id: "2x2",
    label: "2×2",
    hint: "Four-panel page",
    panels: 4,
    aspect: "2:3",
    tags: "comic book page, 2 by 2 panels, even black gutters, sequential left to right then down",
  },
  {
    id: "splash3",
    label: "Splash+3",
    hint: "Big top, three under",
    panels: 4,
    aspect: "2:3",
    tags: "comic page, large splash panel on the top half, three smaller panels along the bottom, gutters",
  },
  {
    id: "six",
    label: "6-panel",
    hint: "Western grid",
    panels: 6,
    aspect: "2:3",
    tags: "american comic book page, six panels in three rows of two, thick gutters, sequential art",
  },
  {
    id: "webtoon",
    label: "Webtoon",
    hint: "Tall vertical strip",
    panels: 3,
    aspect: "9:16",
    tags: "full color webtoon, vertical scroll, stacked full-width panels, no side gutters",
  },
  {
    id: "widescreen",
    label: "Cinematic 3",
    hint: "Three wide beats",
    panels: 3,
    aspect: "3:4",
    tags: "widescreen comic page, three stacked cinematic panels, film still framing, gutters",
  },
];

export const COMIC_INK: { id: string; label: string; tags: string }[] = [
  { id: "manga-ink", label: "Manga ink", tags: "manga ink, screentones, speed lines, crisp blacks" },
  { id: "western-ink", label: "Western ink", tags: "bold american comic ink, halftone dots, saturated print colors" },
  { id: "ligne", label: "Ligne claire", tags: "ligne claire, even line weight, flat color, no hatching" },
  { id: "gekiga", label: "Gekiga", tags: "gekiga, heavy blacks, grit, realistic proportions" },
  { id: "hentai-page", label: "Hentai page", tags: "hentai manga page, uncensored, explicit anatomy, 18+" },
  { id: "doujin", label: "Doujin", tags: "doujinshi, xerox grain, cheap print, explicit" },
  { id: "noir", label: "Noir", tags: "noir comic, high contrast ink, rain, no grey" },
  { id: "webtoon-color", label: "Webtoon color", tags: "full color webtoon painting, clean digital, soft shade" },
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(xs: T[], rng: () => number): T {
  return xs[Math.floor(rng() * xs.length)] ?? xs[0]!;
}

/** Looks for a short name so each panel draws the same people. */
export function comicCast(name: string): string {
  const t = (name || "").trim();
  const l = t.toLowerCase();
  if (/magical girl|mahou shoujo|henshin/.test(l))
    return "adult magical girl, twin tails, frilly minidress, sailor collar, chest bow, wand, transformation brooch, 18+";
  if (/goblin/.test(l))
    return "short wiry adult goblin, long hooked nose, huge pointed ears, yellow slit eyes, needle teeth, olive warty skin, filthy loincloth";
  if (/\borc\b/.test(l))
    return "hulking adult orc, tusks, green-grey hide, iron pauldron, thick neck";
  if (/warrior|knight|paladin/.test(l))
    return "adult warrior, dented breastplate, mud on the greaves, sword or shield, fierce eyes, 18+";
  if (/ninja/.test(l)) return "adult ninja, dark wraps, mask, short blade, 18+";
  if (/witch|sorcer/.test(l)) return "adult witch, long hair, dark robe, glowing hands, 18+";
  if (/demon|devil/.test(l)) return "adult demon, horns, marked skin, claws, 18+";
  if (/monster|beast/.test(l))
    return "hulking monster, too-long arms, maw of teeth, hide and bone ridges";
  if (/\bcat\b/.test(l)) return "small compact tabby cat, yellow eyes, white whiskers, claws out, hackles up";
  if (/\bdog\b|husky/.test(l)) return "stocky dog, bristled coat, bared teeth, torn ear";
  if (/\bwolf\b/.test(l)) return "lean wolf, grey ruff, yellow eyes, bared fangs";
  if (/girl|woman|female|her\b/.test(l))
    return `${t}, adult woman, real proportions, clear face, 18+`;
  if (/man|male|guy|him\b/.test(l)) return `${t}, adult man, stubble, real proportions, 18+`;
  return t || "the same lead";
}

function splitSides(script: string): { a: string; b: string; rest: string } {
  const t = script.replace(/\s+/g, " ").trim();
  const m = t.split(/\b(?:vs\.?|versus|against|fights?|fighting|after|vs)\b/i);
  if (m.length >= 2) {
    return { a: m[0]!.trim(), b: m[1]!.trim(), rest: t };
  }
  const and = t.split(/\b(?:and|&)\b/i);
  if (and.length >= 2 && and[0]!.trim().split(/\s+/).length <= 5) {
    return { a: and[0]!.trim(), b: and[1]!.trim(), rest: t };
  }
  return { a: t, b: "", rest: t };
}

export function isPanelScript(script: string): boolean {
  const t = (script || "").trim();
  if (!t) return false;
  if (/\b(?:p(?:anel)?\s*\d+|panel\s*\d+\s*:)/i.test(t)) return true;
  if (t.split(/\n/).filter((l) => l.trim()).length >= 2) return true;
  return false;
}

export function inventComicBeats(
  script: string,
  n: number,
  opts?: { nsfw?: boolean; seed?: number },
): string[] {
  const raw = (script || "").trim() || "two people in a scene";
  const rng = mulberry32((opts?.seed ?? 1) >>> 0);
  const { a, b } = splitSides(raw);
  const looksA = comicCast(a);
  const looksB = b ? comicCast(b) : "";
  const aName = a.trim() || "the lead";
  const bName = b.trim();
  const nsfw = !!opts?.nsfw || /\b(sex|fuck|rape|nude|nsfw|hentai|pussy|cock)\b/i.test(raw);
  const fight = /\b(vs|versus|fight|battle|war|clash|after|ninja|warrior|goblin|orc)\b/i.test(raw);
  const chase = /\b(chase|run|flee|hunt|after)\b/i.test(raw);
  const horror = /\b(horror|gore|kill|stab|blood|undead|zombie)\b/i.test(raw);
  const place = fight
    ? pick(
        [
          "torch-lit keep yard",
          "wet alley at night",
          "forest clearing, moon",
          "castle steps",
        ],
        rng,
      )
    : chase
      ? pick(["narrow alley", "rooftops", "crowded market"], rng)
      : horror
        ? pick(["abandoned hallway", "graveyard fog", "locked cellar"], rng)
        : pick(["rooftop at dusk", "rainy street", "small lamp-lit room"], rng);

  const setup = looksB
    ? `${looksA} faces ${looksB}, wide establishing, ${place}, before the hit`
    : `${looksA}, establishing shot, ${place}`;
  const approach = bName
    ? `${aName} closes in, ${bName} waiting, ${place}`
    : `${aName} steps forward, ${place}`;
  const clash = bName
    ? fight
      ? `${aName} and ${bName} clash, impact lines, ${place}`
      : chase
        ? `${aName} chases ${bName}, motion lines, ${place}`
        : `${aName} meets ${bName}, ${place}`
    : `${aName}, the action starts, motion lines, ${place}`;
  const turn = bName
    ? nsfw && fight
      ? `${aName} pinned by ${bName}, clothes tearing, explicit, ${place}`
      : fight
        ? `${bName} lands a blow, ${aName} staggered, close-up, ${place}`
        : `${aName} and ${bName}, the turn, shock, ${place}`
    : nsfw
      ? `${aName}, clothes off, explicit, ${place}`
      : `${aName}, something goes wrong, ${place}`;
  const second = bName
    ? `${aName} and ${bName} second clash, dirt, low angle, ${place}`
    : `${aName} pushes through, ${place}`;
  const finish = bName
    ? nsfw
      ? `${aName} and ${bName}, last panel, explicit finish, ${place}`
      : fight
        ? `${aName} and ${bName}, last panel, finishing blow, ${place}`
        : `${aName} and ${bName}, last panel, the beat lands, ${place}`
    : nsfw
      ? `${aName}, last panel, explicit, ${place}`
      : `${aName}, last panel, punchline, ${place}`;

  const pool =
    n <= 1
      ? [finish.replace("last panel, ", "splash page, ")]
      : n === 3
        ? [setup, clash, finish]
        : n === 6
          ? [setup, approach, clash, turn, second, finish]
          : [setup, clash, turn, finish];
  while (pool.length < n) pool.push(finish);
  return pool.slice(0, n);
}

export function splitComicBeats(script: string, n: number): string[] {
  const raw = (script || "").trim();
  if (n <= 1) return [raw || "one splash of the scene"];
  const numbered = raw
    .split(/(?:^|\n)\s*(?:p(?:anel)?\s*\d+\s*[:.\-]|#\s*\d+\s*[:.\-])/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length >= 2) {
    const beats = numbered.slice(0, n);
    while (beats.length < n) beats.push("same characters, next beat");
    return beats;
  }
  const paras = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (paras.length >= 2) {
    const beats = paras.slice(0, n);
    while (beats.length < n) beats.push("same characters, next beat");
    return beats;
  }
  const bits = raw
    .split(/(?<=[.!?])\s+|\n+|,\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[,.\s]+|[.\s]+$/g, "").trim())
    .filter((s) => s.length > 8);
  if (bits.length >= n) return bits.slice(0, n);
  if (bits.length === 0) {
    return Array.from({ length: n }, (_, i) =>
      i === 0 ? raw || "the scene starts" : `beat ${i + 1}, same characters, continues`,
    );
  }
  const out = [...bits];
  while (out.length < n) out.push("same characters, the action continues");
  return out.slice(0, n);
}

export function comicBeats(
  script: string,
  n: number,
  opts?: { nsfw?: boolean; seed?: number },
): string[] {
  if (n <= 1) {
    if (isPanelScript(script)) return splitComicBeats(script, 1);
    return inventComicBeats(script, 1, opts);
  }
  if (isPanelScript(script)) return splitComicBeats(script, n);
  return inventComicBeats(script, n, opts);
}

export function buildComicPrompt(
  script: string,
  layoutId: string,
  inkTags = "",
  opts?: { nsfw?: boolean; seed?: number },
): string {
  const layout = COMIC_LAYOUTS.find((l) => l.id === layoutId) || COMIC_LAYOUTS[1];
  const beats = comicBeats(script, layout.panels, opts);
  const panels = beats.map((b, i) => `panel ${i + 1}: ${b}`).join("; ");
  const page = [
    layout.tags,
    "printed comic page, black gutters, sequential art, SAME faces, same characters in every panel, readable",
    panels,
    inkTags.trim(),
    "inked on paper, not a photograph, not a 3d render",
  ]
    .filter(Boolean)
    .join(", ");
  return page.length > 1800 ? `${page.slice(0, 1790).replace(/[,;]\s*[^,;]*$/, "")}, readable comic page` : page;
}

export function formatComicScript(script: string, layoutId: string, opts?: { nsfw?: boolean; seed?: number }): string {
  const layout = COMIC_LAYOUTS.find((l) => l.id === layoutId) || COMIC_LAYOUTS[1];
  return comicBeats(script, layout.panels, opts)
    .map((b, i) => `P${i + 1}: ${b}`)
    .join("\n");
}
