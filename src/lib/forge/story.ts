/** Storytime — a full scene becomes numbered beats you generate in order. */

export type StoryBeat = {
  n: number;
  title: string;
  prose: string;
  prompt: string;
};

const BEAT_TITLES = ["Setup", "Rise", "Clash", "Turn", "Peak", "Fallout", "After", "Next"];

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

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").trim();
}

/** Pull a short name/role so every beat draws the same people. */
export function storyCast(text: string): string {
  const t = clean(text);
  const l = t.toLowerCase();
  const hits: string[] = [];
  const add = (re: RegExp, line: string) => {
    if (re.test(l) && !hits.includes(line)) hits.push(line);
  };
  add(/hestia/, "Hestia, short black hair, blue ribbon, white dress, small gold pauldron, adult");
  add(/raphtalia/, "Raphtalia, raccoon ears, long brown hair, tan cloak, adult");
  add(/liliruca|lili\b/, "Liliruca Arde, petite pallum, brown hair, backpack, adult");
  add(/ryuu|aiz\b|wallenstein/, "Aiz Wallenstein, long blonde hair, pale armor, adult swordswoman");
  add(/alice/, "Alice, long blonde hair, blue dress or armor as written, adult");
  add(/magical girl|mahou shoujo/, "adult magical girl, twin tails, frilly minidress, sailor collar, wand, 18+");
  add(/goblin/, "short wiry adult goblin, hooked nose, huge pointed ears, yellow slit eyes, olive warty skin");
  add(/\borc\b/, "hulking adult orc, tusks, green-grey hide, iron pauldron");
  add(/warrior|knight|paladin/, "adult warrior, dented breastplate, mud on the greaves, sword or shield");
  add(/ninja/, "adult ninja, dark wraps, mask, short blade");
  add(/witch|sorcer/, "adult witch, long hair, dark robe, glowing hands");
  add(/demon|devil/, "adult demon, horns, marked skin, claws");
  add(/wolf/, "lean wolf, grey ruff, yellow eyes, bared fangs");
  add(/\bcat\b/, "small compact tabby cat, yellow eyes, white whiskers");
  add(/\bdog\b|husky/, "stocky dog, bristled coat, bared teeth, torn ear");
  add(/girl|woman|female/, "adult woman, real proportions, clear face, 18+");
  add(/man|male|guy|him\b/, "adult man, stubble, real proportions, 18+");
  return hits.slice(0, 3).join(" and ") || t.slice(0, 80) || "the same lead, adult";
}

function sentences(text: string): string[] {
  const raw = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of raw) {
    const bits = p.split(/(?<=[.!?])\s+(?=[A-Z"\u201c])|(?<=\.)\s+(?=\d+\.)/);
    for (const b of bits) {
      const c = clean(b.replace(/^(beat|scene|panel|p)\s*\d+\s*[:.\-\u2013]\s*/i, ""));
      if (c.length >= 12) out.push(c);
    }
  }
  return out;
}

/** True when the box already is a scene, not a three-word idea. */
export function looksLikeFullStory(text: string): boolean {
  const t = clean(text);
  if (!t) return false;
  if (/(?:^|\n)\s*(?:\d+|beat|scene|panel|p)\s*[:.\-\u2013]/.test(t)) return true;
  const s = sentences(t);
  return s.length >= 3 || t.length >= 240;
}

function titled(n: number, _prose: string): string {
  return BEAT_TITLES[Math.min(n - 1, BEAT_TITLES.length - 1)] || `Beat ${n}`;
}

function visualPrompt(prose: string, cast: string, nsfw: boolean, n: number, total: number): string {
  const where =
    /rain|storm|wet/.test(prose)
      ? "rain hammering stone, wet cobbles, overcast"
      : /night|moon|torch/.test(prose)
        ? "night, torch and moonlight, long shadows"
        : /tavern|inn|bar/.test(prose)
          ? "timber tavern, firelight, smoke, crowded tables"
          : /forest|woods|tree/.test(prose)
            ? "dark forest, moss, filtered light"
            : /alley|street|city/.test(prose)
              ? "narrow street, wet brick, neon or lantern"
              : /bed|room|chamber/.test(prose)
                ? "dim bedroom, rumpled sheets, one lamp"
                : "clear readable place, grounded lighting";
  const cam =
    n === 1
      ? "establishing, full bodies, environment readable"
      : n === total
        ? "close on the aftermath, faces, hands"
        : n % 2 === 0
          ? "medium, action in frame, both subjects"
          : "three-quarter, eye level, tight on the beat";
  const heat = nsfw
    ? "uncensored, explicit anatomy when the beat is sexual, adult, 18+"
    : "clothed, no nudity, no sex, cinematic still";
  return [
    prose,
    cast,
    where,
    cam,
    "same cast as the rest of the story, consistent faces and clothes",
    "detailed anatomy, detailed hands, detailed eyes, sharp focus",
    heat,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Break a pasted story into 3–8 visual beats. Numbered lines win. Keeps the user's words. */
export function splitStoryBeats(
  text: string,
  opts?: { nsfw?: boolean; max?: number },
): StoryBeat[] {
  const max = Math.min(8, Math.max(3, opts?.max ?? 6));
  const nsfw = Boolean(opts?.nsfw);
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:beat|scene|panel|p)?\s*(\d+)\s*[:.\-\u2013]\s*(.+)/gi)];
  let chunks: string[] = [];
  if (numbered.length >= 2) {
    chunks = numbered.map((m) => clean(m[2] || "")).filter((s) => s.length >= 8);
  } else {
    chunks = sentences(text);
  }
  if (chunks.length === 0 && clean(text)) chunks = [clean(text)];
  if (chunks.length === 1 && chunks[0]!.length > 220) {
    const words = chunks[0]!.split(/\s+/);
    const size = Math.ceil(words.length / Math.min(max, 5));
    const parts: string[] = [];
    for (let i = 0; i < words.length; i += size) parts.push(words.slice(i, i + size).join(" "));
    chunks = parts.filter((p) => p.trim().length > 20);
  }
  if (chunks.length > max) {
    const size = Math.ceil(chunks.length / max);
    const merged: string[] = [];
    for (let i = 0; i < chunks.length; i += size) {
      merged.push(chunks.slice(i, i + size).join(" "));
    }
    chunks = merged.slice(0, max);
  }
  while (chunks.length < 3 && chunks[0]) {
    chunks.push(chunks[chunks.length - 1]!);
    if (chunks.length >= 3) break;
  }
  const cast = storyCast(text);
  return chunks.slice(0, max).map((prose, i) => {
    const n = i + 1;
    return {
      n,
      title: titled(n, prose),
      prose,
      prompt: visualPrompt(prose, cast, nsfw, n, Math.min(chunks.length, max)),
    };
  });
}

const SFW_ARCS = [
  [
    "{cast} at {place}. {idea}. Weather sits on everything. They look at what they came for.",
    "They move on the idea: {idea}. A small sound first, then the other party steps out of cover.",
    "The clash is ugly and close — still the same people from {idea}. Mud, steel or claws, breath in the cold.",
    "Someone slips. The hold breaks. A choice sits in the open for one heartbeat.",
    "They finish it the hard way. No speech. Hands shake after.",
    "After: rain or quiet. The winner is not proud. The place keeps the mark.",
  ],
  [
    "{cast} walk a long road toward {place}. Packs, dust. The job is: {idea}.",
    "Inside, the room is wrong. Too quiet. A figure they know from {idea} is already waiting.",
    "Words first, then a shove. Tables scrape. Nobody in the room helps.",
    "The turn: a blade, a lie, or a door that was never locked.",
    "They get out with what they came for, or they do not. Blood on a sleeve.",
    "Night road again. Same faces. The story is not done and they know it.",
  ],
];

const NSFW_ARCS = [
  [
    "{cast} meet in {place}. Clothes still on. The look is already the decision. Beat comes from: {idea}.",
    "Hands first. A wall or a table. Mouths. No fade. Same people as {idea}.",
    "Clothes fail. Skin, weight, the sound of it. They do not stop to talk.",
    "Pace breaks. One of them takes over. Explicit, adult, nothing covered.",
    "Peak. Shaking, wet, wrecked faces. Still going until it is done.",
    "Aftercare or the lack of it. Same bodies, same room, the mess left on the floor.",
  ],
  [
    "{cast} should not be doing this in {place}. That is the point. Seed: {idea}.",
    "A grip, a warning that is not a stop. Fabric yanked.",
    "They fuck like they mean the risk. Detail on bodies, not poetry. Still {idea}.",
    "Someone almost gets caught. They do not stop.",
    "Finish messy. Teeth, nails, names.",
    "They dress badly and leave the room looking used.",
  ],
];

const PLACES_SFW = [
  "a torch-lit keep yard in the rain",
  "a timber tavern at last call",
  "a black pine forest after dark",
  "a cracked highway overpass",
  "a stone chapel with the roof gone",
];
const PLACES_NSFW = [
  "a locked back room behind the tavern",
  "a rain-slick alley nobody walks",
  "an upstairs inn bed with one lamp",
  "a ruined chapel nave",
  "a warehouse office after hours",
];

function fillArc(lines: string[], cast: string, place: string, idea: string): string {
  const clip = idea.slice(0, 180);
  return lines
    .map((l, i) => `${i + 1}. ${l.replace(/\{cast\}/g, cast).replace(/\{place\}/g, place).replace(/\{idea\}/g, clip)}`)
    .join("\n");
}

/** Offline story writer. Long pasted scenes stay intact. Short ideas get a 6-beat arc that keeps the idea. */
export function draftStory(
  idea: string,
  opts?: { nsfw?: boolean; seed?: number; max?: number },
): string {
  const nsfw = Boolean(opts?.nsfw);
  const ideaClean = clean(idea) || (nsfw ? "two adults who should know better" : "a fighter and the thing in the dark");
  if (looksLikeFullStory(ideaClean)) {
    return formatStoryScript(splitStoryBeats(ideaClean, { nsfw, max: opts?.max ?? 8 }));
  }
  const rng = mulberry32((opts?.seed ?? Date.now()) >>> 0);
  const cast = storyCast(ideaClean);
  const place = pick(nsfw ? PLACES_NSFW : PLACES_SFW, rng);
  const arc = pick(nsfw ? NSFW_ARCS : SFW_ARCS, rng);
  const head = nsfw ? `NSFW story. Adults only. Idea: ${ideaClean}.` : `Story. Idea: ${ideaClean}.`;
  return `${head}\n${fillArc(arc, cast, place, ideaClean)}`;
}

/** One more beat after the ones you already have — follows the last line. */
export function continueStory(
  story: string,
  beats: StoryBeat[],
  opts?: { nsfw?: boolean; seed?: number },
): StoryBeat {
  const nsfw = Boolean(opts?.nsfw);
  const rng = mulberry32((opts?.seed ?? beats.length * 9973) >>> 0);
  const last = beats[beats.length - 1]?.prose || story;
  const cast = storyCast(story || last);
  const hook = clean(last).slice(-120);
  const tailsSfw = [
    `They do not go home after: ${hook}. The road takes them to the next door that should have stayed shut.`,
    `Morning does not fix \u201c${hook}\u201d. Same faces, a new map, a worse job.`,
    `Someone follows from that last beat. They hear it late. They turn anyway.`,
  ];
  const tailsNsfw = [
    `They are not done after: ${hook}. Another room, same bodies, less patience.`,
    `Clothes stay off. The next hour is slower and meaner than \u201c${hook}\u201d.`,
    `A third adult walks in on \u201c${hook}\u201d. Nobody pretends this is a talk.`,
  ];
  const prose = pick(nsfw ? tailsNsfw : tailsSfw, rng);
  const n = (beats[beats.length - 1]?.n || 0) + 1;
  return {
    n,
    title: titled(n, prose),
    prose,
    prompt: visualPrompt(prose, cast, nsfw, n, n),
  };
}

export function formatStoryScript(beats: StoryBeat[]): string {
  return beats.map((b) => `${b.n}. ${b.title} \u2014 ${b.prose}`).join("\n");
}

export function storyBeatPrompt(beats: StoryBeat[], index: number): string {
  const b = beats[index];
  if (!b) return "";
  return b.prompt;
}

export function nextStoryPreview(beats: StoryBeat[], index: number): string {
  const b = beats[index + 1];
  if (!b) return "";
  return `${b.n}. ${b.title} \u2014 ${b.prose}`;
}
