/** Storytime narrator — speaker lines + SFW/NSFW SFX cues. Offline. Unfiltered. */

export type VoiceRole = "narrator" | "female" | "male" | "creature";

export type SfxKind =
  | "rain" | "thunder" | "steel" | "steps" | "door" | "fire" | "wind" | "water"
  | "crowd" | "boom" | "punch" | "glass" | "cloth" | "magic" | "horse" | "birds"
  | "bells" | "whoosh" | "heartbeat" | "growl" | "roar" | "arrow" | "chain" | "stone"
  | "moan" | "gasp" | "slap" | "spank" | "kiss" | "scream" | "wet" | "squelch"
  | "thrust" | "bed" | "fabric" | "suck" | "whip" | "climax" | "breath" | "impact";

export type NarrationCue = {
  kind: "speak" | "sfx";
  speaker: string;
  role: VoiceRole;
  text: string;
  sfx?: SfxKind;
  beat: number;
};

export const SFW_SFX: SfxKind[] = [
  "rain","thunder","wind","water","fire","steel","steps","door","crowd","boom",
  "punch","glass","cloth","magic","horse","birds","bells","whoosh","heartbeat","growl","roar","arrow","chain","stone",
];

export const NSFW_SFX: SfxKind[] = [
  "moan","gasp","breath","kiss","slap","spank","whip","wet","squelch","thrust","bed","fabric","suck","climax","scream","impact",
];

const FEMALE_HINT = /\b(hestia|raphtalia|liliruca|\blili\b|ryuu|aiz|alice|filo|sadeena|anya|chloe|ishtar|she|her|hers|woman|girl|lady|queen|witch|maid|heroine|wife)\b/i;
const MALE_HINT = /\b(naofumi|bell|cranel|kazuma|\bhe\b|\bhim\b|\bhis\b|man|guy|dude|king|husband|knight|warrior|paladin|ninja)\b/i;
const CREATURE_HINT = /\b(goblin|orc|demon|monster|slime|tentacle|wolf|dragon|zombie|beast|dog|husky)\b/i;

const SFX_RULES: Array<{ kind: SfxKind; re: RegExp }> = [
  { kind: "thunder", re: /\b(thunder|lightning|thunderclap)\b/i },
  { kind: "rain", re: /\b(rain|storm|downpour|drizzle|sleet)\b/i },
  { kind: "wind", re: /\b(wind|gale|gust)\b/i },
  { kind: "water", re: /\b(wave|ocean|river|splash|puddle|drip)\b/i },
  { kind: "fire", re: /\b(fire|flame|torch|burning|crackle)\b/i },
  { kind: "steel", re: /\b(sword|steel|clash|blade|slash|shield bash)\b/i },
  { kind: "steps", re: /\b(footsteps?|boots? on|walks?|steps? on)\b/i },
  { kind: "door", re: /\b(door|gate|slam|latch|knock)\b/i },
  { kind: "crowd", re: /\b(crowd|tavern roar|market)\b/i },
  { kind: "boom", re: /\b(explod|blast|cannon|detonat)\b/i },
  { kind: "punch", re: /\b(punch|fist|hook|uppercut)\b/i },
  { kind: "glass", re: /\b(glass|shatter)\b/i },
  { kind: "cloth", re: /\b(cloak|fabric rustle|clothes shift)\b/i },
  { kind: "magic", re: /\b(spell|magic|hex|ward|mana)\b/i },
  { kind: "horse", re: /\b(horse|hoof|gallop|steed)\b/i },
  { kind: "birds", re: /\b(bird|crow|owl|wingbeat)\b/i },
  { kind: "bells", re: /\b(bell|chime|chapel)\b/i },
  { kind: "whoosh", re: /\b(whoosh|dash)\b/i },
  { kind: "heartbeat", re: /\b(heartbeat|pulse in)\b/i },
  { kind: "growl", re: /\b(growl|snarl)\b/i },
  { kind: "roar", re: /\b(roar|bellow)\b/i },
  { kind: "arrow", re: /\b(arrow|bowstring)\b/i },
  { kind: "chain", re: /\b(chain|shackle|manacle)\b/i },
  { kind: "stone", re: /\b(gravel|rubble|stone scrape)\b/i },
  { kind: "climax", re: /\b(orgasm|climax|cums?\b|coming hard|creampie)\b/i },
  { kind: "thrust", re: /\b(thrust|piston|pounding into|fucks?|rutting)\b/i },
  { kind: "wet", re: /\b(slick|dripping|soaked|pussy juice|precum|drool)\b/i },
  { kind: "squelch", re: /\b(squelch|schlick|wet slap of skin)\b/i },
  { kind: "suck", re: /\b(suck|blowjob|fellatio|gag on|throat|slurp)\b/i },
  { kind: "spank", re: /\b(spank|smack (her|his) ass|paddle)\b/i },
  { kind: "whip", re: /\b(whip|lash|crop|flog)\b/i },
  { kind: "slap", re: /\b(slap|smack)\b/i },
  { kind: "fabric", re: /\b(rip(s|ped|ping)? (her |his )?clothes|tear the dress|panties aside)\b/i },
  { kind: "bed", re: /\b(bed creak|mattress|headboard|springs)\b/i },
  { kind: "kiss", re: /\b(kiss|mouths meet|tongue in)\b/i },
  { kind: "moan", re: /\b(moan|whimper|groan|ah{2,}|unh)\b/i },
  { kind: "gasp", re: /\b(gasp|sharp breath)\b/i },
  { kind: "breath", re: /\b(heavy breath|panting|breath hitch)\b/i },
  { kind: "scream", re: /\b(scream|shout|yell|cry out)\b/i },
  { kind: "impact", re: /\b(body hit|slams (her|him) down|pins (her|him)|\brape\b)\b/i },
];

const ALIAS: Record<string, SfxKind> = {
  thunder:"thunder",rain:"rain",storm:"rain",wind:"wind",water:"water",fire:"fire",
  steel:"steel",sword:"steel",steps:"steps",door:"door",crowd:"crowd",boom:"boom",
  punch:"punch",glass:"glass",magic:"magic",horse:"horse",moan:"moan",gasp:"gasp",
  slap:"slap",spank:"spank",kiss:"kiss",scream:"scream",wet:"wet",squelch:"squelch",
  thrust:"thrust",fuck:"thrust",sex:"thrust",bed:"bed",fabric:"fabric",rip:"fabric",
  suck:"suck",blowjob:"suck",whip:"whip",climax:"climax",orgasm:"climax",cum:"climax",
  breath:"breath",impact:"impact",rape:"impact",
};

export function sfxFromTag(raw: string): SfxKind | undefined {
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return undefined;
  return ALIAS[k] || detectSfx(raw)[0];
}

export function detectSfx(text: string): SfxKind[] {
  const hits: SfxKind[] = [];
  for (const r of SFX_RULES) {
    if (r.re.test(text) && !hits.includes(r.kind)) hits.push(r.kind);
  }
  return hits.slice(0, 4);
}

export function guessRole(speaker: string, text = ""): VoiceRole {
  const blob = `${speaker} ${text}`;
  if (/^narrator$/i.test(speaker.trim())) return "narrator";
  if (CREATURE_HINT.test(speaker) || (CREATURE_HINT.test(blob) && !FEMALE_HINT.test(speaker))) return "creature";
  if (FEMALE_HINT.test(speaker) || (FEMALE_HINT.test(blob) && !MALE_HINT.test(speaker))) return "female";
  if (MALE_HINT.test(speaker) || MALE_HINT.test(blob)) return "male";
  return "narrator";
}

export function voiceHint(role: VoiceRole): { rate: number; pitch: number; prefer: RegExp } {
  if (role === "female") return { rate: 0.96, pitch: 1.12, prefer: /female|woman|samantha|zira|aria|jenny|amy|emma|moira|hazel/i };
  if (role === "male") return { rate: 0.92, pitch: 0.78, prefer: /male|man|david|mark|daniel|george|alex|fred/i };
  if (role === "creature") return { rate: 0.78, pitch: 0.55, prefer: /male|man|david|fred/i };
  return { rate: 0.88, pitch: 0.86, prefer: /female|woman|samantha|zira|aria|jenny|amy|emma|moira|hazel/i };
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").trim();
}
function titleCase(s: string): string {
  const t = clean(s);
  if (!t) return "Narrator";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}
function pushSpeak(out: NarrationCue[], beat: number, speaker: string, text: string) {
  const line = clean(text);
  if (line.length < 2) return;
  const role = guessRole(speaker, line);
  out.push({ kind: "speak", speaker: titleCase(speaker || "Narrator"), role, text: line, beat });
  for (const sfx of detectSfx(line)) out.push({ kind: "sfx", speaker: titleCase(speaker || "Narrator"), role, text: sfx, sfx, beat });
}
function pushExplicitSfx(out: NarrationCue[], beat: number, raw: string) {
  const kind = sfxFromTag(raw) || detectSfx(raw)[0] || "boom";
  out.push({ kind: "sfx", speaker: "SFX", role: "narrator", text: kind, sfx: kind, beat });
}

export function parseBeatNarration(prose: string, beat = 1): NarrationCue[] {
  const out: NarrationCue[] = [];
  const raw = (prose || "").replace(/\r/g, "").trim();
  if (!raw) return out;
  const chunks = raw.split(/(?=\[[^\]]{2,28}\]|\([^)]{2,28}\))/g);
  for (const chunk of chunks) {
    const tagged = chunk.match(/^\[([^\]]{2,28})\]|^\(([^)]{2,28})\)/);
    if (tagged) {
      pushExplicitSfx(out, beat, tagged[1] || tagged[2] || chunk);
      const rest = chunk.slice(tagged[0].length).trim();
      if (rest) parsePlain(rest, beat, out);
    } else parsePlain(chunk, beat, out);
  }
  if (!out.some((c) => c.kind === "speak")) pushSpeak(out, beat, "Narrator", raw.replace(/\[[^\]]+\]/g, " "));
  return out;
}

function parsePlain(text: string, beat: number, out: NarrationCue[]) {
  const t = text.trim();
  if (!t) return;
  const STOP = /^(the|they|then|this|that|there|she|he|her|his|a|an|and|but|when|after|before|someone|inside|morning|night|setup|rise|clash|turn|peak|fallout)$/i;
  const nameQuote = /(?:^|\n)\s*([A-Z][A-Za-z][A-Za-z .'-]{0,28})\s*:\s*[“"']?([^"”\n]{2,280})[”"']?/g;
  let cursor = 0;
  for (const m of t.matchAll(nameQuote)) {
    const idx = m.index ?? 0;
    if (idx > cursor) {
      const before = t.slice(cursor, idx).trim();
      if (before) splitQuotes(before, beat, out);
    }
    const who = (m[1] || "").trim();
    if (!STOP.test(who)) pushSpeak(out, beat, who || "Narrator", m[2] || "");
    cursor = idx + m[0].length;
  }
  const tail = t.slice(cursor).trim();
  if (tail) splitQuotes(tail, beat, out);
}

function splitQuotes(text: string, beat: number, out: NarrationCue[]) {
  const t = text.trim();
  if (!t) return;
  pushSpeak(out, beat, "Narrator", t);
}

export function parseStoryNarration(beats: Array<{ n: number; prose: string }>): NarrationCue[] {
  return beats.flatMap((b) => parseBeatNarration(b.prose, b.n));
}

export function parseAnyText(text: string): NarrationCue[] {
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:beat|scene|panel|p)?\s*(\d+)\s*[:.\-–]\s*(.+)/gi)];
  if (numbered.length >= 2) return numbered.flatMap((m, i) => parseBeatNarration(m[2] || "", i + 1));
  return parseBeatNarration(text, 1);
}

export function cueLabel(c: NarrationCue): string {
  return c.kind === "sfx" ? `SFX · ${c.sfx || c.text}` : c.speaker;
}
