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
    aspect: "3:4",
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

export function splitComicBeats(script: string, n: number): string[] {
  const raw = (script || "").trim();
  if (n <= 1) return [raw || "one splash of the scene"];
  const numbered = raw.split(/(?:^|\n)\s*(?:p(?:anel)?\s*\d+\s*[:.\-]|#\s*\d+\s*[:.\-])/i)
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

export function buildComicPrompt(script: string, layoutId: string, inkTags = ""): string {
  const layout = COMIC_LAYOUTS.find((l) => l.id === layoutId) || COMIC_LAYOUTS[1];
  const beats = splitComicBeats(script, layout.panels);
  const panels = beats.map((b, i) => `panel ${i + 1}: ${b}`).join(", ");
  return [
    layout.tags,
    "printed comic page, black gutters, sequential art, the SAME characters in every panel, readable page",
    panels,
    inkTags.trim(),
    "inked, on paper, not a photograph, not a photo collage, not 3d render",
  ]
    .filter(Boolean)
    .join(", ");
}
