import type { WildcardFile } from "./types";

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(options: string[], rng: () => number): string {
  const parsed = options.map((raw) => {
    const m = raw.match(/^(.*)::(\d+(?:\.\d+)?)$/);
    if (!m) return { text: raw, weight: 1 };
    return { text: m[1] ?? raw, weight: Number(m[2]) || 1 };
  });
  const total = parsed.reduce((s, p) => s + p.weight, 0) || 1;
  let roll = rng() * total;
  for (const p of parsed) {
    roll -= p.weight;
    if (roll <= 0) return p.text;
  }
  return parsed[parsed.length - 1]?.text ?? "";
}

function expandBraces(input: string, rng: () => number): string {
  const re = /\{([^{}]+)\}/;
  let out = input;
  for (let i = 0; i < 24; i++) {
    const m = re.exec(out);
    if (!m || m.index === undefined) break;
    const choice = pickWeighted(m[1].split("|").map((s) => s.trim()), rng);
    out = out.slice(0, m.index) + choice + out.slice(m.index + m[0].length);
  }
  return out;
}

function expandNames(
  input: string,
  files: WildcardFile[],
  rng: () => number,
  depth = 0,
): string {
  if (depth > 8) return input;
  const map = new Map(files.map((f) => [f.name.toLowerCase(), f.lines]));
  return input.replace(/__([a-zA-Z0-9_-]+)__/g, (_, name: string) => {
    const lines = map.get(name.toLowerCase())?.filter((l) => l.trim() && !l.startsWith("#"));
    if (!lines?.length) return `__${name}__`;
    const picked = lines[Math.floor(rng() * lines.length)] ?? "";
    return expandNames(expandBraces(picked, rng), files, rng, depth + 1);
  });
}

export type InlineLora = { name: string; unet: number; clip: number };

export function parseInlineLoras(prompt: string): { text: string; loras: InlineLora[] } {
  const loras: InlineLora[] = [];
  const text = prompt.replace(
    /<lora:([^:>]+)(?::([^:>]+))?(?::([^>]+))?>/gi,
    (_, name: string, a?: string, b?: string) => {
      const unet = a !== undefined && a !== "" ? Number(a) : 0.8;
      const clip = b !== undefined && b !== "" ? Number(b) : unet;
      loras.push({
        name: name.trim(),
        unet: Number.isFinite(unet) ? unet : 0.8,
        clip: Number.isFinite(clip) ? clip : 0.8,
      });
      return "";
    },
  );
  return { text: text.replace(/\s{2,}/g, " ").trim(), loras };
}

export function expandPrompt(
  prompt: string,
  files: WildcardFile[],
  seed: number,
): { expanded: string; loras: InlineLora[] } {
  const rng = mulberry32(seed);
  const named = expandNames(prompt, files, rng);
  const braced = expandBraces(named, rng);
  const parsed = parseInlineLoras(braced);
  return { expanded: parsed.text, loras: parsed.loras };
}

export const DEFAULT_WILDCARDS: WildcardFile[] = [
  {
    name: "color",
    lines: ["crimson", "ink black", "bone white", "sage", "navy", "rust", "ivory", "charcoal", "oxblood", "pale gold"],
  },
  {
    name: "hair",
    lines: ["short black hair", "long wavy hair", "silver crop", "braided hair", "wet hair", "shaved sides"],
  },
  {
    name: "lighting",
    lines: [
      "soft window light",
      "hard noon sun",
      "neon rim light",
      "candlelit",
      "overcast daylight",
      "golden hour",
      "moonlight",
      "practical lamps",
    ],
  },
  {
    name: "camera",
    lines: [
      "35mm",
      "50mm portrait",
      "85mm shallow depth",
      "anamorphic widescreen",
      "low angle",
      "over-the-shoulder",
      "macro detail",
    ],
  },
  {
    name: "style",
    lines: [
      "photoreal",
      "editorial fashion",
      "oil painting",
      "graphite sketch",
      "3d render",
      "film still",
      "documentary still",
    ],
  },
  {
    name: "clothing",
    lines: [
      "wool coat",
      "silk slip",
      "tailored suit",
      "worn denim",
      "armor plates",
      "linen shirt",
      "leather jacket",
      "nothing but a sheet",
    ],
  },
  {
    name: "setting",
    lines: [
      "rain-slick alley",
      "quiet kitchen at night",
      "pine forest",
      "rooftop at dusk",
      "hotel corridor",
      "sunlit studio",
      "abandoned theater",
    ],
  },
  {
    name: "shot",
    lines: ["close-up", "medium shot", "full body", "wide establishing", "detail crop"],
  },
  {
    name: "mood",
    lines: ["calm", "tense", "tender", "bleak", "euphoric", "lonely", "defiant"],
  },
];
