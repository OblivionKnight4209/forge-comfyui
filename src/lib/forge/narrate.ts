/** Storytime narrator — split beats into speaker lines + SFX cues. Offline. */

export type VoiceRole = "narrator" | "female" | "male" | "creature";
export type SfxKind =
  | "rain"
  | "thunder"
  | "steel"
  | "steps"
  | "door"
  | "fire"
  | "wind"
  | "water"
  | "moan"
  | "slap"
  | "kiss"
  | "crowd"
  | "scream"
  | "boom";

export type NarrationCue = {
  kind: "speak" | "sfx";
  speaker: string;
  role: VoiceRole;
  text: string;
  sfx?: SfxKind;
  beat: number;
};

const FEMALE_HINT =
  /\b(hestia|raphtalia|liliruca|\blili\b|ryuu|aiz|alice|filo|sadeena|anya|chloe|ishtar|mikoto|moka|shion|shuna|sylphie|syr|atla|wydia|therese|marina|silk|nene|osen|jamie|eris|shalltear|papi|tifa|aerith|\brem\b|lynga|fran|\bsuu\b|shiro|luminous|velzard|suphia|myulan|she|her|hers|woman|girl|lady|queen|witch|maid|heroine|wife)\b/i;

const MALE_HINT =
  /\b(naofumi|bell|cranel|kazuma|soma|\bhe\b|\bhim\b|\bhis\b|man|guy|dude|king|husband|knight|warrior|paladin|ninja)\b/i;

const CREATURE_HINT =
  /\b(goblin|orc|demon|monster|slime|tentacle|wolf|dragon|zombie|xenomorph|beast|dog|husky)\b/i;

const SFX_RULES: Array<{ kind: SfxKind; re: RegExp }> = [
  { kind: "thunder", re: /\b(thunder|lightning|boom of the sky)\b/i },
  { kind: "rain", re: /\b(rain|storm|downpour|drizzle)\b/i },
  { kind: "steel", re: /\b(sword|steel|clash|blade|slash|shield bash|metal)\b/i },
  { kind: "steps", re: /\b(footsteps?|boots? on|walks?|steps? on|scrabble)\b/i },
  { kind: "door", re: /\b(door|gate|slam|latch)\b/i },
  { kind: "fire", re: /\b(fire|flame|torch|burning)\b/i },
  { kind: "wind", re: /\b(wind|howl|gale)\b/i },
  { kind: "water", re: /\b(wave|ocean|river|splash|puddle)\b/i },
  { kind: "moan", re: /\b(moan|gasp|groan|whimper|ah+|mm+)\b/i },
  { kind: "slap", re: /\b(slap|smack|spank|crack of a palm)\b/i },
  { kind: "kiss", re: /\b(kiss|mouths meet)\b/i },
  { kind: "crowd", re: /\b(crowd|tavern roar|voices overlap)\b/i },
  { kind: "scream", re: /\b(scream|shout|yell|cry out)\b/i },
  { kind: "boom", re: /\b(explod|blast|cannon|impact)\b/i },
];

export function detectSfx(text: string): SfxKind[] {
  const hits: SfxKind[] = [];
  for (const r of SFX_RULES) {
    if (r.re.test(text) && !hits.includes(r.kind)) hits.push(r.kind);
  }
  return hits.slice(0, 3);
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
  if (role === "female") return { rate: 0.96, pitch: 1.12, prefer: /female|woman|samantha|zira|aria|jenny|amy|emma|victoria|karen|moira|tessa|fiona|susan|linda|hazel/i };
  if (role === "male") return { rate: 0.92, pitch: 0.78, prefer: /male|man|david|mark|daniel|george|alex|fred|ralph|guy/i };
  if (role === "creature") return { rate: 0.78, pitch: 0.55, prefer: /male|man|david|daniel|fred/i };
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
  for (const sfx of detectSfx(line)) {
    out.push({ kind: "sfx", speaker: titleCase(speaker || "Narrator"), role, text: sfx, sfx, beat });
  }
}

function pushExplicitSfx(out: NarrationCue[], beat: number, raw: string) {
  const kinds = detectSfx(raw);
  const fallback = kinds[0] || "boom";
  out.push({
    kind: "sfx",
    speaker: "SFX",
    role: "narrator",
    text: fallback,
    sfx: fallback,
    beat,
  });
}

/** One beat → ordered speak/sfx cues. Understands Name: "line", quotes, [thunder]. */
export function parseBeatNarration(prose: string, beat = 1): NarrationCue[] {
  const out: NarrationCue[] = [];
  const raw = (prose || "").replace(/\r/g, "").trim();
  if (!raw) return out;

  const chunks = raw.split(/(?=\[[^\]]{2,24}\]|\([^)]{2,28}\))/g);
  for (const chunk of chunks) {
    const tagged = chunk.match(/^\[([^\]]{2,24})\]|^\(([^)]{2,28})\)/);
    if (tagged) {
      pushExplicitSfx(out, beat, tagged[1] || tagged[2] || chunk);
      const rest = chunk.slice(tagged[0].length).trim();
      if (rest) parsePlain(rest, beat, out);
    } else {
      parsePlain(chunk, beat, out);
    }
  }
  if (!out.some((c) => c.kind === "speak")) {
    pushSpeak(out, beat, "Narrator", raw.replace(/\[[^\]]+\]/g, " "));
  }
  return out;
}

function parsePlain(text: string, beat: number, out: NarrationCue[]) {
  const t = text.trim();
  if (!t) return;

  const STOP = /^(the|they|then|this|that|there|she|he|her|his|a|an|and|but|when|after|before|someone|inside|morning|night|setup|rise|clash|turn|peak|fallout)$/i;
  const nameQuote = /(?:^|\n)\s*([A-Z][A-Za-z][A-Za-z .'-]{0,28})\s*:\s*[“"']?([^"”\n]{2,280})[”"']?/g;
  let cursor = 0;
  let hit = false;
  for (const m of t.matchAll(nameQuote)) {
    const idx = m.index ?? 0;
    if (idx > cursor) {
      const before = t.slice(cursor, idx).trim();
      if (before) splitQuotes(before, beat, out);
    }
    const who = (m[1] || "").trim();
    if (STOP.test(who)) continue;
    pushSpeak(out, beat, who || "Narrator", m[2] || "");
    cursor = idx + m[0].length;
    hit = true;
  }
  const tail = t.slice(cursor).trim();
  if (tail) splitQuotes(tail, beat, out);
  if (!hit && !tail && !out.length) splitQuotes(t, beat, out);
}

function splitQuotes(text: string, beat: number, out: NarrationCue[]) {
  const t = text.trim();
  if (!t) return;
  const re =
    /[“"]([^"”]{2,280})[”"](?:\s*,?\s*)(?:([A-Za-z][A-Za-z .'-]{1,28})\s+)?(?:said|asks?|snarls?|whispers?|moans?|yells?|shouts?)(?:\s+([A-Za-z][A-Za-z .'-]{1,28}))?/gi;
  let cursor = 0;
  let any = false;
  for (const m of t.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > cursor) {
      const before = t.slice(cursor, idx).trim();
      if (before) pushSpeak(out, beat, speakerFromAside(before) || "Narrator", stripSaid(before));
    }
    const whoRaw = (m[2] || m[3] || speakerFromAside(t.slice(Math.max(0, idx - 40), idx)) || "").trim();
    const who =
      /^she$/i.test(whoRaw) ? "She" : /^he$/i.test(whoRaw) ? "He" : whoRaw || "Speaker";
    pushSpeak(out, beat, who, m[1] || "");
    cursor = idx + m[0].length;
    any = true;
  }
  const rest = t.slice(cursor).trim();
  if (rest) pushSpeak(out, beat, speakerFromAside(rest) || "Narrator", stripSaid(rest));
  if (!any && !rest) pushSpeak(out, beat, "Narrator", t);
}

function speakerFromAside(s: string): string {
  const m = s.match(/([A-Z][A-Za-z][A-Za-z .'-]{1,24})\s+(?:said|asks?|snarls?|whispers?|moans?)/i);
  return m?.[1] || "";
}

function stripSaid(s: string): string {
  return clean(s.replace(/\b(said|asks?|snarls?|whispers?|moans?|yells?|shouts?)\s+[A-Za-z][A-Za-z .'-]{1,24}\.?$/i, ""));
}

export function parseStoryNarration(beats: Array<{ n: number; prose: string }>): NarrationCue[] {
  const all: NarrationCue[] = [];
  for (const b of beats) all.push(...parseBeatNarration(b.prose, b.n));
  return all;
}

export function cueLabel(c: NarrationCue): string {
  if (c.kind === "sfx") return `SFX · ${c.sfx || c.text}`;
  return `${c.speaker}`;
}
