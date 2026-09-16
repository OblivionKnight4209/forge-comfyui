import { LOOK_MORE } from "./write-bits";

export type ArtWrap = { id: string; label: string; wrap: string };

export const ART_WRAPS: ArtWrap[] = [
  { id: "none", label: "No wrap", wrap: "[p]" },
  { id: "anime", label: "Anime still", wrap: "anime still, [p], sharp lineart, cel shading, detailed eyes" },
  { id: "photo", label: "Photo", wrap: "photograph, [p], 35mm, natural light, sharp focus, real skin" },
  { id: "ghibli", label: "Ghibli", wrap: "Ghibli-style anime screencap, [p], painterly background, soft light" },
  { id: "comic", label: "Comic", wrap: "comic book panel, [p], ink, screentone, bold lines" },
  { id: "manga", label: "Manga", wrap: "manga page, [p], black and white, screentones, speed lines" },
  { id: "oil", label: "Oil paint", wrap: "oil painting, [p], visible brushstrokes, gallery lighting" },
  { id: "pixel", label: "Pixel", wrap: "pixel art, [p], 32-bit, limited palette, crisp pixels" },
  { id: "noir", label: "Noir", wrap: "film noir still, [p], hard shadows, grain, venetian blinds" },
  { id: "cyber", label: "Cyberpunk", wrap: "cyberpunk still, [p], neon rain, wet asphalt, chromatic aberration" },
  { id: "horror", label: "Horror", wrap: "horror still, [p], practical gore, grim, unlit corners" },
  { id: "hentai", label: "Hentai", wrap: "uncensored hentai still, [p], explicit, detailed anatomy" },
  { id: "tarot", label: "Tarot", wrap: "tarot card illustration, [p], ornate border, symbolic" },
  { id: "mtg", label: "MTG card", wrap: "magic the gathering card art, [p], painted, epic lighting" },
];

export function applyArtWrap(prompt: string, wrapId: string) {
  const p = prompt.trim();
  if (!p) return p;
  const wrap = ART_WRAPS.find((w) => w.id === wrapId && w.id !== "none" && w.id !== "none2");
  if (!wrap) return p;
  if (p.includes(wrap.label.toLowerCase()) || new RegExp(wrap.wrap.split(",")[0]!, "i").test(p)) return p;
  return wrap.wrap.replace("[p]", p);
}

export const LOOK_APPENDS: { id: string; label: string; tags: string }[] = [
  { id: "kaleido", label: "Kaleidoscope", tags: "as seen through a kaleidoscope" },
  { id: "amber", label: "Trapped in amber", tags: "trapped in amber" },
  { id: "snow", label: "Snow globe", tags: "inside a snow globe" },
  { id: "lego", label: "LEGO", tags: "built from LEGO bricks" },
  { id: "tarotc", label: "Tarot card", tags: "tarot card" },
  { id: "xray", label: "X-ray", tags: "X-ray vision view" },
  { id: "diorama", label: "Diorama", tags: "diorama miniature model scene" },
  { id: "plush", label: "Plush toy", tags: "subject is a plush toy" },
  { id: "crayon", label: "Crayon", tags: "as a child's crayon drawing" },
  { id: "constel", label: "Constellation", tags: "reimagined as a constellation" },
  { id: "ukiyo", label: "Ukiyo-e", tags: "Japanese Ukiyo-e print" },
  { id: "ghib", label: "Ghibli bg", tags: "Ghibli-style anime screencap, painterly background" },
  { id: "disney", label: "Classic Disney", tags: "Classic Disney golden age" },
  { id: "burton", label: "Burton", tags: "Tim Burtonesque spooky style" },
  { id: "ps1", label: "PS1", tags: "PS1 style, PlayStation 1 graphics" },
  { id: "vhs", label: "VHS", tags: "VHS box art, tracking lines, grain" },
  { id: "polaroid", label: "Polaroid", tags: "instant Polaroid photo, white frame" },
  { id: "natgeo", label: "NatGeo", tags: "vintage national geographic photo, rich colors" },
  { id: "hopper", label: "Hopper", tags: "in the style of Edward Hopper's lonely scenes" },
  { id: "giger", label: "Giger", tags: "in the style of H.R. Giger" },
  { id: "frazetta", label: "Frazetta", tags: "in the style of Frank Frazetta's fantasy art" },
  { id: "miyazaki", label: "Miyazaki", tags: "in the style of Hayao Miyazaki's backgrounds" },
  { id: "caravaggio", label: "Caravaggio", tags: "in the style of Caravaggio's tenebrism" },
  { id: "mucha", label: "Mucha", tags: "in the style of Alphonse Mucha's Art Nouveau" },
  { id: "wes", label: "Wes Anderson", tags: "Accidentally Wes Anderson symmetrical photo" },
  { id: "ufotable", label: "Ufotable", tags: "Ufotable animation style, dynamic action" },
  { id: "90scel", label: "90s cel", tags: "Anime screenshot, 1990s cel animation aesthetic, slight grain" },
  { id: "liminal", label: "Liminal", tags: "liminal space photography, empty, fluorescent" },
  { id: "found", label: "Found footage", tags: "found footage still, shaky, night vision" },
  { id: "security", label: "Security cam", tags: "security camera footage, timestamp, grain" },
  { id: "macro", label: "Macro", tags: "macro photography, extreme detail" },
  { id: "silhouette", label: "Silhouette", tags: "silhouette against a sunset" },
  { id: "double", label: "Double exposure", tags: "double exposure photography, ghostly overlay" },
  { id: "stained", label: "Stained glass", tags: "rendered in stained glass, lead cames" },
  { id: "blueprint", label: "Blueprint", tags: "blueprint technical drawing" },
  { id: "riso", label: "Risograph", tags: "risograph print, limited color palette, grain" },
  { id: "sumie", label: "Sumi-e", tags: "sumi-e ink wash painting" },
  { id: "neo-noir", label: "Neo-noir", tags: "gritty neo-noir comic book art" },
  { id: "splash", label: "Splash page", tags: "comic book splash page, dynamic composition" },
  { id: "portra", label: "Portra 400", tags: "Kodak Portra 400 film look, warm grain" },
  ...LOOK_MORE,
];

export const RANDOM_SCENES = [
  "{enigmatic|mysterious} {demon|angel|ghost} {queen|king|prince|princess} {sitting on|standing beside} {their throne|a cosmic altar}",
  "portrait of a {wolf|fox|crow|serpent}-{man|woman}, {priest|warrior|keeper} of {the underworld|blue fire|the deep heart}",
  "{cyborg|steampunk|magical} {mermaid|merman} exploring {a coral reef|an underwater city}",
  "{neon|sunset|moonlit} cityscape during {a rainstorm|a snowfall|a meteor shower}",
  "{haunted|abandoned} mansion inhabited by {quirky|creepy} spirits",
  "{masked|armored} vigilante perched {on a skyscraper|atop a cliff}",
  "{succubus|demoness}, {crimson|obsidian} hair, black wings, in a gothic castle, flickering candles",
  "{attractive|alluring} vampire, pale skin, red eyes, in a medieval castle, full moon, close up",
  "{viking|norse} warrior, spear, fur cloak, longboat, icy fjord, northern lights, close up",
  "{fairy|pixie}, iridescent wings, mushroom ring, forest glade, fireflies, close up",
  "{mermaid|siren}, shimmering tail, red hair, on a rock, azure sea, close up",
  "{elven} ranger, longbow, green cloak, dense forest, ancient trees, close up",
  "{cybernetic} samurai, katana, neo-Tokyo, neon signs, rain-soaked streets, close up",
  "{sorceress|witch}, staff, enchanted tower, floating books, arcane symbols, close up",
  "ninja, masked, shuriken on belt, bamboo forest, full moon, close up",
  "woman at a {market|cafe}, {choosing fruit|laptop open}, close-up, candid",
  "{beautiful |}{japanese|korean|norwegian} woman, bedroom mirror selfie, casual wear",
  "mountain vista, {sunrise|sunset}, mist, forested ridges",
  "cityscape, night, skyscrapers, wet streets, neon",
  "{warrior|queen} riding a {mythical|giant} beast",
];

export function randomSceneLine(seed: number) {
  const i = Math.abs(seed) % RANDOM_SCENES.length;
  return RANDOM_SCENES[i] ?? RANDOM_SCENES[0]!;
}

/** Grok-style "want it 4K / realistic?" — applied on Generate, not just labels. */
export const QUALITY_OFFERS: { id: string; label: string; tags: string; hires?: boolean; wrap?: string }[] = [
  {
    id: "real",
    label: "Realistic",
    tags: "photoreal, DSLR photo, real skin texture, natural pores, 35mm, natural light, sharp focus",
    wrap: "photo",
  },
  {
    id: "4k",
    label: "4K",
    tags: "4k UHD, ultra detailed, crisp, high resolution, sharp focus",
    hires: true,
  },
  {
    id: "cinema",
    label: "Cinematic",
    tags: "cinematic lighting, anamorphic, shallow depth of field, film grain, color graded",
  },
  {
    id: "sharp",
    label: "Sharper",
    tags: "razor sharp, micro detail, defined edges, no blur",
  },
];

export function applyQualityOffers(prompt: string, ids: string[]) {
  let p = (prompt || "").trim();
  if (!p || !ids.length) return p;
  for (const id of ids) {
    const o = QUALITY_OFFERS.find((x) => x.id === id);
    if (!o) continue;
    const already = o.tags.split(",")[0]?.trim() || "";
    if (already && new RegExp(already.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(p)) continue;
    p = `${p}, ${o.tags}`;
  }
  return p;
}

export function qualityWantsHires(ids: string[]) {
  return ids.some((id) => QUALITY_OFFERS.find((o) => o.id === id)?.hires);
}
