import type { WildcardFile } from "./types";
import { writeExtreme, writeTabooSet, writeHorrorSet } from "./extreme";

export const WILDCARD_TOKEN = /__([a-zA-Z0-9][a-zA-Z0-9 _./+-]{0,120}?)__/g;

function wildcardRe() {
  return /__([a-zA-Z0-9][a-zA-Z0-9 _./+-]{0,120}?)__/g;
}

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
  let out = input;
  for (let i = 0; i < 32; i++) {
    const m = /\{([^{}]+)\}/.exec(out);
    if (!m || m.index === undefined) break;
    const choice = pickWeighted(m[1].split("|").map((s) => s.trim()).filter(Boolean), rng);
    out = out.slice(0, m.index) + choice + out.slice(m.index + m[0].length);
  }
  return out.replace(/[{}]/g, "");
}

/** Finished prompt: Perchance {a|b} becomes one pick. */
export function flattenPrompt(text: string, seed = 1): string {
  return expandBraces((text || "").replace(/\s+/g, " ").trim(), mulberry32(seed));
}

export function isPurpleProse(text: string) {
  return /breathtaking|masterpiece|vulnerability|unapologetically|masterclass|razor-sharp|edge-of-the-seat|cinematic vulnerability|high-fidelity|hyper-realistic 8k|visual temptation/i.test(
    text || "",
  );
}

export function recoverScene(text: string): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!isPurpleProse(t) && !/^a (breathtaking|lush|hyper)/i.test(t)) return userLead(t);
  const bits: string[] = [];
  if (/\banime\b/i.test(t)) bits.push("anime");
  if (/\b(young woman|girl|woman)\b/i.test(t)) bits.push("young woman");
  if (/\b(cat|dog|husky)\b/i.test(t)) bits.push((t.match(/\b(cat|dog|husky)\b/i) || ["cat"])[0]!);
  if (/silk|lingerie|barely|sheer|tattered|skimpy|translucent|minimal/i.test(t)) bits.push("barely any clothes");
  if (/pastel|pink|blue|black|silver/.test(t) && /hair/i.test(t)) bits.push("pastel hair");
  return bits.length ? bits.join(", ") : userLead(t).split(",").slice(0, 4).join(",").trim();
}

/** Perchance curly lists. Generate picks one. Does not dump sex unless asked. */
export function withRandomBlocks(lead: string, nsfw = false): string {
  const t = (lead || "").replace(/\s+/g, " ").trim();
  if (!t) return t;
  if (/\{/.test(t)) return t;
  const c = lookCast(t);
  const shot = "{full body|three-quarter|low angle|eye level|over-the-shoulder}";
  const light = "{warm daylight|overcast|golden hour|cool moonlight|neon night|soft window light}";
  const place = c.fight
    ? "{dirt yard|wet alley|keep courtyard|rubble lot|torch-lit street}"
    : "{dim bedroom|rain-slick alley|rooftop at night|small kitchen|wooded path}";
  if (c.animals.length) {
    const bits = c.animals.map((a) => {
      if (a === "cat") return "{an orange tabby|a black shorthair|a grey street cat}, {arched spine|low crouch}, {slit pupils|bared fangs}";
      if (a === "dog") return "{a stocky brown mutt|a brindle dog|a white-chested mutt}, {hackles up|heavy paws}, {bared teeth|jowls pulled}";
      if (a === "husky") return "{a black-and-white husky|a grey agouti husky}, ice-blue eyes, {gathered to spring|shoulders down}";
      return `{an adult ${a}}`;
    });
    return `${shot} of ${t}, ${bits.join(", ")}, ${place}, ${light}, fur flying`;
  }
  const hair = "{long black hair|silver hair|auburn hair|short dark hair|wind-swept hair}";
  const eyes = "{brown eyes|green eyes|grey eyes|amber eyes}";
  const clothes = nsfw
    ? "{sheer silk|torn clothes|barely-there lace|open shirt}"
    : "{worn jacket|simple shirt|travel cloak|armor straps}";
  return `${shot} of ${t}, ${hair}, ${eyes}, ${clothes}, ${place}, ${light}`;
}

function tooClose(out: string, inn: string) {
  const a = (out || "").replace(/\s+/g, " ").trim().toLowerCase();
  const b = (inn || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!b) return false;
  if (a === b) return true;
  if (a.startsWith(b) && a.length < b.length + 48) return true;
  return false;
}

function expandNames(
  input: string,
  files: WildcardFile[],
  rng: () => number,
  depth = 0,
): string {
  if (depth > 8) return input;
  const map = new Map(files.map((f) => [f.name.toLowerCase(), f.lines]));
  return input.replace(wildcardRe(), (_, name: string) => {
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
): { expanded: string; loras: InlineLora[]; missing: string[] } {
  const rng = mulberry32(seed);
  const missing: string[] = [];
  const map = new Set(files.map((f) => f.name.toLowerCase()));
  for (const m of prompt.matchAll(wildcardRe())) {
    const n = (m[1] ?? "").toLowerCase();
    if (n && !map.has(n)) missing.push(n);
  }
  const named = expandNames(prompt, files, rng);
  const braced = expandBraces(named, rng);
  const parsed = parseInlineLoras(braced);
  return { expanded: parsed.text, loras: parsed.loras, missing };
}

function pickLine(files: WildcardFile[], name: string, rng: () => number): string {
  const lines =
    files
      .find((f) => f.name.toLowerCase() === name.toLowerCase())
      ?.lines.filter((l) => l.trim() && !l.startsWith("#")) ?? [];
  if (!lines.length) return "";
  return lines[Math.floor(rng() * lines.length)] ?? "";
}

export type PromptFlavor = "person" | "sex" | "scene" | "enhance" | "bdsm" | "dark" | "taboo" | "horror";

export const PROMPT_FLAVORS: { id: PromptFlavor; label: string; hint: string }[] = [
  { id: "person", label: "Who", hint: "face, body, clothes" },
  { id: "scene", label: "Where", hint: "place, camera, light" },
  { id: "enhance", label: "More words", hint: "keep yours, add detail" },
  { id: "sex", label: "Sex", hint: "explicit acts" },
  { id: "bdsm", label: "BDSM", hint: "rope, impact" },
  { id: "dark", label: "Monster", hint: "creature, tentacle" },
  { id: "taboo", label: "Taboo", hint: "forbidden adult" },
  { id: "horror", label: "Gore", hint: "force, blood" },
];

function wantsSexAct(text: string) {
  return /\b(fuck|fucks|fucking|rape|pussy|cock|blowjob|handjob|anal|creampie|gangbang|spitroast)\b/i.test(text || "");
}

const ADULT_RE =
  /\b(nude|naked|nsfw|sex|sexy|skimpy|lingerie|lewd|erotic|fuck|cock|pussy|hentai|explicit|topless|porn|cum|blowjob|masturbat|penetrat|barely.{0,12}cloth)\b/i;

export function isAdult(text: string) {
  return ADULT_RE.test(text);
}

export function keepNeutral(out: string, user: string, flavor: PromptFlavor): string {
  const u = (user || "").toLowerCase();
  const explicit = /^(sex|bdsm|dark|taboo|horror)$/.test(flavor);
  const allowCute = /\b(cute|kawaii|moe|chibi|adorable|wholesome)\b/.test(u);
  const allowGay = /\b(gay|yaoi|mlm|femboy|twink|bara|2boys|boys love|otoko no ko)\b/.test(u);
  const allowYuri = /\b(yuri|lesbian|wlw|2girls|girls love)\b/.test(u);
  const allowSchool = /\b(school|uniform|classroom|sailor)\b/.test(u);
  const allowViewer = /\b(looking at viewer|eye contact|at the camera)\b/.test(u);
  const allowBlush = /\b(blush|flushed)\b/.test(u);
  const allowSex = explicit || isAdult(u);
  let t = out;
  const drop = (re: RegExp) => {
    t = t.replace(re, " ");
  };
  if (!allowCute) drop(/\b(cute|kawaii|moe|chibi|adorable|wholesome|heart-eyes|heart eyes)\b/gi);
  if (!allowGay) drop(/\b(yaoi|mlm|femboy|twink|bara|otoko no ko|\btrap\b|2boys|1boy|boys love|gay couple)\b/gi);
  if (!allowYuri) drop(/\b(yuri|scissoring|tribbing|2girls|girls love)\b/gi);
  if (!allowSchool) drop(/\b(school uniform|sailor uniform|classroom|school rooftop)\b/gi);
  if (!allowViewer) drop(/\blooking at viewer\b/gi);
  if (!allowBlush) drop(/\bblush(ing)?\b/gi);
  if (!allowSex) {
    drop(
      /\b(ahegao|masturbat\w*|handjob|blowjob|anal|ring gag|creampie|tentacle sex|explicit sex)\b/gi,
    );
  }
  return t.replace(/\s+,/g, ",").replace(/,+/g, ",").replace(/^,\s*|,+\s*$/g, "").replace(/\s{2,}/g, " ").trim();
}

function joinScene(parts: string[], _adult?: boolean) {
  return parts
    .filter(Boolean)
    .join(", ")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/^,\s*|,+\s*$/g, "")
    .trim();
}

const COMMON_NOUNS = new Set(
  "cat dog girl boy woman man person car house room city landscape sky bird flower tree".split(" "),
);

function isNameLike(text: string) {
  const t = text.trim();
  const words = t.split(/\s+/);
  if (!t || words.length > 3) return false;
  if (words.some((w) => COMMON_NOUNS.has(w.toLowerCase()))) return false;
  if (t.length > 32) return false;
  return true;
}

function hasPlace(s: string) {
  return /\b(in|on|at|inside|under|over|beside|against)\b/i.test(s);
}

function alreadyDirected(text: string) {
  return (
    text.length > 80 &&
    /\b(masterpiece|best quality|anime still|dramatic composition|photoreal|cinematic still)\b/i.test(
      text,
    )
  );
}

function colorGarb(color: string, role: string) {
  if (/ninja/i.test(role)) return `wearing ${color} ninja garb`;
  return `wearing ${color}`;
}

function phraseChunk(chunk: string) {
  let s = chunk
    .replace(/\bhuskys\b/gi, "huskies")
    .replace(/\bhusky's\b/gi, "huskies")
    .replace(/\bother\b/gi, "a pack of")
    .replace(/\s+/g, " ")
    .trim();
  const ninja = /\bninja/i.test(s);
  s = s.replace(
    /\bin (black|blue|red|white|gold|green|purple|silver)\b/gi,
    ninja ? "wearing $1 ninja garb" : "wearing $1",
  );
  if (/\b(husky|huskies|wolf|cat|dog|fox)\b/i.test(s) && /\b(ninja|samurai|knight)\b/i.test(s)) {
    if (!/anthropomorphic|anthro/i.test(s)) {
      s = /^a pack of /i.test(s)
        ? s.replace(/^a pack of /i, "a pack of anthropomorphic ")
        : `anthropomorphic ${s}`;
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

export function userLead(text: string) {
  let t = (text || "").replace(/\s+/g, " ").trim();
  const cut = t.split(
    /, (?:small compact|lean street|stocky mutt|medium mixed-breed|adult Siberian|adult grey wolf|red fox|she parries|she kicks|shield bash|torch-lit keep|flagstone|detailed anatomy|detailed fur|pores|subsurface scatter)/i,
  )[0];
  t = (cut || t)
    .replace(
      /\b(detailed anatomy|detailed hands|detailed eyes|detailed skin|pores, subsurface scatter|pores|subsurface scatter|highly detailed anime still|sharp focus, cinematic|cinematic, detailed)\b/gi,
      "",
    )
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/^,\s*|,+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

function lookCast(text: string) {
  const t = text.toLowerCase();
  const female = /\b(girl|woman|women|female|lady|heroine)\b/.test(t) || /\b(she|her)\b/.test(t);
  const goblin = /\bgoblins?\b/.test(t);
  const orc = /\borcs?\b/.test(t);
  const monster = /\b(monster|demon|beast|troll|dragon|werewolf|creature|fiend|ogre)\b/.test(t);
  const fight = /\b(fight|fighting|vs|versus|battle|duel|clash|combat|warrior|knight)\b/.test(t);
  const warrior = /\b(warrior|knight|soldier|fighter|champion|guard|paladin|vanguard)\b/.test(t);
  const humanFemale = female || (/\bhuman\b/.test(t) && (female || warrior));
  const humanMale =
    !goblin &&
    !orc &&
    !monster &&
    (/\b(human male|adult man)\b/.test(t) || (/\b(man|men|guy)\b/.test(t) && !female));
  return {
    goblin,
    orc,
    monster,
    girl: humanFemale,
    man: humanMale,
    chase: /\b(after|chase|chasing|pursu|hunt|running from|following)\b/.test(t),
    fight,
    warrior,
    animals: animalsIn(t),
    nameOnly: isNameLike(text) && !isScenePrompt(text),
  };
}

const ANIMAL_LOOK: Record<string, { body: string[]; coat: string[]; face: string[]; pose: string[] }> = {
  cat: {
    body: [
      "small compact domestic cat, arched spine, long tail lashing",
      "lean street cat, wiry flanks, torn ear",
    ],
    coat: ["orange tabby, white chest and paws", "black short fur, yellow eyes", "grey striped tabby"],
    face: ["whiskers fanned, bared fangs, slit pupils, ears pinned", "hissing, wrinkled muzzle, pink nose"],
    pose: ["rearing on hind legs, front claws out", "low crouch, weight on haunches, ready to pounce"],
  },
  dog: {
    body: ["medium mixed-breed dog, deep chest, thick neck, heavy paws", "stocky mutt, short legs, wide stance"],
    coat: ["short brown coat, white blaze", "brindle scruff, dirty from the yard"],
    face: ["black nose, bared teeth, ears back, spit flying", "jowls pulled, eyes locked on the cat"],
    pose: ["hackles up, lunging on forelegs", "braced, snapping at the cat's shoulder"],
  },
  husky: {
    body: ["adult Siberian husky, long legs, deep chest, curled tail", "thick-coated husky, wolfish build"],
    coat: ["black and white, mask on the face", "grey agouti, white socks"],
    face: ["ice-blue eyes, upright ears, black lips drawn", "bi-eyed, panting, teeth showing"],
    pose: ["gathered to spring", "shoulders down, stalking"],
  },
  wolf: {
    body: ["adult grey wolf, long muzzle, high shoulders", "lean timber wolf, huge paws"],
    coat: ["grizzled grey-brown, dark saddle", "pale arctic ruff"],
    face: ["amber eyes, ears forward, lips peeled", "breath steaming, fangs long"],
    pose: ["hackles a ridge down the back", "circling, stiff-legged"],
  },
  fox: {
    body: ["red fox, slender, black socks, white-tipped tail", "lean fox, sharp face"],
    coat: ["rust red, white chest", "cross-fox dark stripe"],
    face: ["narrow muzzle, gold eyes, black nose", "ears tall, teeth small and sharp"],
    pose: ["light on the toes, darting", "pounce stance"],
  },
};

function animalsIn(text: string): string[] {
  const t = text.toLowerCase();
  const keys = ["husky", "wolf", "fox", "kitten", "puppy", "cat", "dog", "horse", "bird", "rabbit"] as const;
  const canon: Record<string, string> = { kitten: "cat", puppy: "dog" };
  const skip = /\bwolf cut\b|\bfox eyes?\b|\bcat (ears?|girl|lingerie|suit|hood)\b/g;
  const cleaned = t.replace(skip, " ");
  const found: string[] = [];
  for (const k of keys) {
    if (new RegExp(`\\b${k}s?\\b`).test(cleaned)) {
      const id = canon[k] || k;
      if (!found.includes(id)) found.push(id);
    }
  }
  return found;
}

function animalBits(id: string, rng: () => number): string[] {
  const pack = ANIMAL_LOOK[id];
  if (!pack) return [`${id}, detailed fur, detailed face, detailed paws`];
  return [
    pickFrom(pack.body, rng),
    pickFrom(pack.coat, rng),
    pickFrom(pack.face, rng),
    pickFrom(pack.pose, rng),
  ];
}

const GOBLIN_LOOK = {
  body: [
    "short wiry adult goblin, long arms, knobby knees, pot belly",
    "small hunched goblin, skinny legs, oversized hands",
    "stocky goblin, thick neck, bandy legs, chest hair",
  ],
  head: [
    "long hooked nose, huge pointed ears, yellow slit eyes, needle teeth",
    "warty snout, drool, one broken tusk, sly grin",
    "bat-like ears, receding hair, hungry stare",
  ],
  hide: ["mottled green hide", "olive warty skin", "sickly yellow-green skin"],
  clothes: ["ragged leather, bone charms, scavenged belt", "filthy loincloth, torn vest", "patchwork armor too big for him"],
};

const ORC_LOOK = {
  body: ["massive adult orc, barrel chest, tusks, corded arms", "broad orc, green-grey muscle, heavy gut"],
  head: ["lower tusks, flat nose, small eyes under a heavy brow", "scarred orc face, broken tusk, braided hair"],
  hide: ["green-grey hide", "ash-green skin, battle scars"],
  clothes: ["hide kilt, war harness", "crude iron pauldron, fur cloak"],
};

const WOMAN_LOOK = {
  body: [
    "adult woman, natural proportions, defined collarbones",
    "adult woman, soft stomach, full hips, strong thighs",
    "adult woman, athletic, long legs, visible collarbones",
  ],
  face: [
    "adult face, full lips, clear eyes, slight smile",
    "adult face, tired eyes, soft jaw, real skin texture",
    "adult face, sharp cheekbones, dark lashes, unimpressed look",
  ],
  hair: [
    "long dark hair over one shoulder",
    "shoulder-length brown hair, a few loose strands",
    "blonde hair, slightly messy, not salon-perfect",
    "black hair, simple, not styled for a photoshoot",
  ],
  clothes: [
    "blouse and jeans, ordinary clothes",
    "knit sweater, skirt, boots",
    "leather jacket over a tank and jeans",
    "simple dress, no costume",
  ],
};

const SKIMPY_LOOK = [
  "barely-there silk, most of the body uncovered",
  "sheer lingerie, nipples and hips visible",
  "tiny bikini, high cut",
  "open shirt, nothing under, short skirt",
  "torn translucent dress clinging to skin",
];

const MAN_LOOK = {
  body: [
    "adult man, broad shoulders, visible stubble, real proportions",
    "lean adult man, veined forearms, tired posture",
    "heavy adult man, thick neck, worn hands",
  ],
  face: [
    "square jaw, tired eyes, pores, stubble",
    "beard, heavy brow, lined forehead",
    "short beard, crooked nose, quiet expression",
  ],
  hair: ["short dark hair", "unkempt brown hair", "receding hair, close crop"],
  clothes: ["worn jacket, shirt, jeans, boots", "coat, sweater, scuffed shoes", "henley, work pants, belt"],
};

const MONSTER_BODY = [
  "hulking hunched body, corded muscle, too-long arms",
  "tall emaciated frame, stretched limbs, knotted joints",
  "broad-shouldered brute, thick neck, barrel chest",
  "loping quadruped heaving onto two legs, spine ridges",
];
const MONSTER_HEAD = [
  "elongated snout, stacked teeth, black gums, strings of drool",
  "sunken glowing eyes, split jaw, no lips",
  "horned skull-face, wet maw, steam off the breath",
  "asymmetric face, one huge eye, torn cheek",
];
const MONSTER_HIDE = [
  "slick dark scales",
  "pale warty hide",
  "charred cracked skin",
  "matted wet fur over bony plates",
];
const MONSTER_HANDS = [
  "black claws, hooked, too many knuckles",
  "huge calloused hands, dirt packed under nails",
  "talons scraping the ground",
];
const GIRL_HAIR = [
  "long dark hair whipping behind her",
  "messy brown hair stuck to her cheeks",
  "blonde hair in a tangled ponytail",
  "black hair across one eye",
];
const GIRL_CLOTHES = [
  "torn jacket, jeans, one shoe missing",
  "hoodie snagged, bare midriff",
  "thin dress ripping at the shoulder",
  "coat flying open over a tank and jeans",
];
const GIRL_FACE = [
  "adult woman, terror, mouth open",
  "adult woman, looking back over her shoulder, eyes wide",
  "adult woman, gritted teeth, tears, still running",
  "adult woman, pale, sweat, jaw clenched",
];
const CHASE_BEAT = [
  "closing the gap, one stride from catching her",
  "reaching a claw toward her back",
  "she stumbles, it does not slow",
  "her feet kicking up gravel, it behind her",
];

const WARRIOR_WOMAN = {
  body: [
    "adult human woman, athletic, scarred forearms, combat stance, weight on her back foot",
    "adult human woman, broad shoulders for a woman, tight core, dirt and sweat on her skin",
    "adult human woman, long legs planted, shield arm up, sword arm cocked",
  ],
  armor: [
    "battered iron breastplate, leather fauld, dented vambraces, mud-caked greaves",
    "boiled leather cuirass, chainmail sleeves, cracked pauldron, sword-belt",
    "scale armor over a padded gambeson, scuffed tassets, worn boots",
  ],
  weapon: [
    "longsword mid-swing, heater shield catching a blow",
    "spear braced, short sword at her hip",
    "hand-and-a-half sword, knuckles white on the grip",
  ],
  face: [
    "adult woman, jaw clenched, a cut over one brow, dirt on her cheek, no smile",
    "adult woman, teeth bared, sweat, blood at the lip, eyes locked on him",
    "adult woman, scar through the eyebrow, breathing hard, furious",
  ],
  hair: [
    "dark hair tied back, sweat-soaked strands stuck to her neck",
    "braid coming loose, wet with rain and sweat",
    "short practical hair, plastered to her forehead",
  ],
};

const FIGHT_PLACE = [
  "ruined stone courtyard between collapsed walls",
  "muddy hill fort, palisade splintered",
  "torch-lit keep yard, rain hammering the flagstones",
  "burned village square, carts overturned",
];
const FIGHT_GROUND = [
  "cracked flagstones slick with rain and blood",
  "mud, broken spears, a dead horse in the muck",
  "wet cobbles, puddles reflecting fire",
  "trampled grass, spent arrows, a dropped helmet",
];
const FIGHT_WEATHER = [
  "cold rain, torch smoke, night",
  "fog rolling in, distant thunder",
  "ash falling, orange firelight",
  "wind driving rain sideways",
];
const FIGHT_FAR = [
  "burning cottages on the ridge, black trees, mountains",
  "a collapsed gatehouse, the moon through the smoke",
  "watchtowers, a banner torn in the wind",
  "the forest edge, crows, a dead sky",
];
const FIGHT_BEAT = [
  "she parries high, he lunges low at her knees",
  "blades locked, sparks, she drives him back a step",
  "his rusty shank vs her steel, close quarters",
  "she kicks mud, shield bash, he scrabbles aside",
];

function lookFill(text: string, anime: boolean, rng: () => number): string {
  const lead = userLead(text);
  const c = lookCast(lead);
  const x = extrasFor(lead, anime, rng);
  const parts: string[] = [lead];
  if (c.animals.length) {
    for (const a of c.animals) parts.push(...animalBits(a, rng));
    if (c.fight && c.animals.length >= 2) {
      parts.push(
        pickFrom(
          [
            "they collide mid-air, fur flying, dirt kicked up",
            "the cat slashes, the dog snaps, both committed",
            "locked together, rolling, claws in coat, teeth at the neck",
          ],
          rng,
        ),
      );
    }
  } else {
    if (c.goblin) {
      parts.push(pickFrom(GOBLIN_LOOK.body, rng), pickFrom(GOBLIN_LOOK.head, rng), pickFrom(GOBLIN_LOOK.hide, rng), pickFrom(GOBLIN_LOOK.clothes, rng));
    } else if (c.orc) {
      parts.push(pickFrom(ORC_LOOK.body, rng), pickFrom(ORC_LOOK.head, rng), pickFrom(ORC_LOOK.hide, rng), pickFrom(ORC_LOOK.clothes, rng));
    } else if (c.monster) {
      parts.push(pickFrom(MONSTER_BODY, rng), pickFrom(MONSTER_HEAD, rng), pickFrom(MONSTER_HIDE, rng), pickFrom(MONSTER_HANDS, rng));
    }
    if (c.girl) {
      if (c.chase && !c.warrior && !c.fight) {
        parts.push(pickFrom(GIRL_HAIR, rng), pickFrom(GIRL_CLOTHES, rng), pickFrom(GIRL_FACE, rng));
      } else if (c.warrior || c.fight) {
        parts.push(
          pickFrom(WARRIOR_WOMAN.body, rng),
          pickFrom(WARRIOR_WOMAN.armor, rng),
          pickFrom(WARRIOR_WOMAN.weapon, rng),
          pickFrom(WARRIOR_WOMAN.face, rng),
          pickFrom(WARRIOR_WOMAN.hair, rng),
        );
      } else {
        parts.push(pickFrom(WOMAN_LOOK.body, rng), pickFrom(WOMAN_LOOK.face, rng), pickFrom(WOMAN_LOOK.hair, rng));
        parts.push(isAdult(lead) ? pickFrom(SKIMPY_LOOK, rng) : pickFrom(WOMAN_LOOK.clothes, rng));
      }
    }
    if (c.man && !c.goblin && !c.orc && !c.monster) {
      parts.push(pickFrom(MAN_LOOK.body, rng), pickFrom(MAN_LOOK.face, rng), pickFrom(MAN_LOOK.hair, rng), pickFrom(MAN_LOOK.clothes, rng));
    }
    if (c.fight) {
      parts.push(pickFrom(FIGHT_BEAT, rng), pickFrom(FIGHT_PLACE, rng), pickFrom(FIGHT_GROUND, rng), pickFrom(FIGHT_WEATHER, rng), pickFrom(FIGHT_FAR, rng));
    } else if (c.chase) parts.push(pickFrom(CHASE_BEAT, rng));
    else if (c.nameOnly && !c.goblin && !c.orc && !c.monster && !c.girl && !c.man) {
      parts.push(
        pickFrom(["looking slightly aside", "neutral mouth", "soft jaw"], rng),
        pickFrom(["worn jacket", "simple shirt", "hoodie"], rng),
        pickFrom(["upper body", "close-up"], rng),
      );
    }
  }
  if (!c.fight && !hasPlace(lead)) parts.push(x.place);
  else if (c.animals.length && !hasPlace(lead)) parts.push(x.place);
  parts.push(x.shot, x.light);
  if (x.ground) parts.push(x.ground);
  if (x.weather) parts.push(x.weather);
  if (x.far) parts.push(x.far);
  if (c.animals.length && !c.girl && !c.man) {
    parts.push("detailed fur", "detailed paws");
  }
  parts.push(anime ? "anime illustration" : "photograph");
  return keepNeutral(joinScene(parts, isAdult(lead)), lead, "person");
}

function extrasFor(text: string, anime: boolean, rng: () => number): {
  beat: string;
  place: string;
  shot: string;
  light: string;
  finish: string;
  ground?: string;
  weather?: string;
  far?: string;
} {
  const t = text.toLowerCase();
  const finish = anime ? "highly detailed anime still" : "cinematic, detailed";
  const beasts = animalsIn(t);
  if (beasts.length) {
    return {
      beat: pickFrom(
        beasts.length >= 2
          ? ["mid-clash, fur and dirt in the air", "one on top, the other twisting out", "both on hind legs, striking"]
          : ["caught mid-step", "weight on the front paws", "alert, tense"],
        rng,
      ),
      place: placeFromText(text, rng) || pickFrom(["dirt yard", "back-alley, trash bags", "overgrown lot", "wet street"], rng),
      shot: pickFrom(["low angle full bodies", "wide action shot", "close on the clash"], rng),
      light: pickFrom(["overcast", "late afternoon dust", "streetlamp"], rng),
      finish,
    };
  }
  if (/kidnap|abduct|snatch|carried|carrying her|thrown over/.test(t)) {
    return {
      beat: pickFrom(
        ["thrown over its shoulder", "she struggles, reaching back", "clawed hand over her mouth", "held under one arm, kicking"],
        rng,
      ),
      place: pickFrom(
        ["empty street at night", "between parked cars", "foggy underpass", "wet pavement, distant traffic"],
        rng,
      ),
      shot: pickFrom(["wide shot", "low angle", "from behind", "full body"], rng),
      light: pickFrom(["streetlamp", "headlights in rain", "moonlight", "harsh night"], rng),
      finish,
    };
  }
  if (/fight|ninja|battle|sword|blade|clash|sparks|warrior/.test(t)) {
    return {
      beat: pickFrom(FIGHT_BEAT, rng),
      place: pickFrom(FIGHT_PLACE, rng),
      ground: pickFrom(FIGHT_GROUND, rng),
      weather: pickFrom(FIGHT_WEATHER, rng),
      far: pickFrom(FIGHT_FAR, rng),
      shot: pickFrom(["wide action shot", "low angle full bodies", "over her shield rim"], rng),
      light: pickFrom(anime ? ["moonlight through smoke", "torch fire, rain highlights"] : ["hard rim light, fire bounce", "overcast, wet steel"], rng),
      finish,
    };
  }
  if (/\b(monster|demon|goblin|troll|beast)\b/.test(t) && /\b(girl|woman|her|female)\b/.test(t)) {
    return {
      beat: pickFrom(["looming over her", "grabbing her wrist", "she looks back in fear", "one huge hand around her"], rng),
      place: pickFrom(["dark street", "ruined hallway", "forest edge at night", "broken doorway"], rng),
      shot: pickFrom(["low angle", "wide shot", "full body"], rng),
      light: pickFrom(["moonlight", "streetlamp", "red glow"], rng),
      finish,
    };
  }
  if (isNameLike(text) && !isScenePrompt(text)) {
    return {
      beat: pickFrom(["neutral expression", "mouth closed", "looking slightly aside"], rng),
      place: pickFrom(["plain interior", "overcast street", "empty room"], rng),
      shot: pickFrom(["upper body", "medium shot", "close-up"], rng),
      light: pickFrom(["window light", "overcast", "soft daylight"], rng),
      finish,
    };
  }
  return {
    beat: pickFrom(["mid-motion", "caught in the moment", "clear subject"], rng),
    place: placeFromText(text, rng) || pickFrom(["open street", "interior", "night scene"], rng),
    shot: pickFrom(["wide shot", "medium shot", "full body"], rng),
    light: pickFrom(anime ? ["soft light", "rim light", "night"] : ["window light", "overcast"], rng),
    finish,
  };
}

function grokFill(text: string, anime: boolean, rng: () => number): string {
  const lead = userLead(text);
  const x = extrasFor(lead, anime, rng);
  const beat = isAdult(lead)
    ? pickFrom(
        ["skin flushed, sweat", "mouth open", "explicit detailed anatomy", "clothes pulled aside"],
        rng,
      )
    : x.beat;
  return joinScene([
    lead,
    beat,
    x.place,
    x.shot,
    x.light,
    "detailed skin",
    "detailed hands",
    "detailed eyes",
    "detailed hair",
    anime ? "highly detailed anime still" : "sharp focus, detailed",
  ]);
}

function isDumbLook(scene: string, out: string) {
  const s = scene.toLowerCase();
  const o = out.toLowerCase();
  if (/monster|demon|beast|chase|after|fight|ninja/.test(s) && /school uniform|sailor uniform|classroom|messy bed|looking at viewer/.test(o)) {
    return true;
  }
  if (/\b(cat|dog|husky|wolf|fox)\b/.test(s) && /shield|flagstone|cottage|keep yard|banner torn|human woman|warrior/.test(o)) {
    return true;
  }
  if (/\b(cat|dog)\b/.test(s) && !/\b(fur|whisker|muzzle|paw|tabby|hackles|fangs|tail|coat)\b/.test(o)) {
    return true;
  }
  if (!isAdult(s) && /ahegao|masturbat|handjob|ring gag|\banal\b/.test(o)) return true;
  if (out.length < Math.max(24, Math.min(scene.trim().length + 24, 80))) return true;
  return false;
}

export function writeIdeas(opts: {
  flavor: PromptFlavor;
  files: WildcardFile[];
  seed: number;
  existing?: string;
  family?: "flux" | "sdxl" | "sd15";
  checkpoint?: string;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const scene = userLead(opts.existing ?? "");
  for (let i = 0; i < 24 && out.length < 3; i++) {
    const t = writePrompt({
      ...opts,
      existing: scene,
      seed: opts.seed + i * 9973 + 41,
    });
    if (!t || seen.has(t)) continue;
    if (opts.flavor === "person" && isDumbLook(scene, t)) continue;
    seen.add(t);
    out.push(keepNeutral(t, scene, opts.flavor));
  }
  return out;
}

function pickFrom(lines: string[], rng: () => number) {
  return lines[Math.floor(rng() * lines.length)] ?? "";
}

function isScenePrompt(text: string) {
  const t = text.toLowerCase();
  return /\b(fight|fighting|vs|versus|battle|war|chase|ninja|ninjas|kidnap|abduct|monster)\b/.test(t);
}

function placeFromText(text: string, rng: () => number): string {
  const t = text.toLowerCase();
  if (/\b(ninja|samurai|shinobi|katana|sword)\b/.test(t)) {
    return pickFrom(
      ["moonlit rooftop", "rain-soaked alley", "dojo at night", "pagoda roof in a storm"],
      rng,
    );
  }
  if (/\b(fight|battle|war)\b/.test(t) && !/\b(cat|dog|husky|wolf|fox)\b/.test(t)) {
    return pickFrom(["rubble and sparks", "night battlefield", "narrow alley"], rng);
  }
  if (/\b(husky|wolf|dog|fox)\b/.test(t)) {
    return pickFrom(["snow field", "pine forest at night", "frozen street"], rng);
  }
  if (/\b(school|classroom|uniform)\b/.test(t)) {
    return pickFrom(["classroom", "school rooftop", "hallway"], rng);
  }
  return "";
}

function densifyScene(text: string, anime: boolean, rng: () => number) {
  const place = placeFromText(text, rng);
  const shot = pickFrom(
    anime
      ? ["dynamic low angle", "dramatic wide shot", "action close-up", "high angle"]
      : ["low angle", "wide shot", "over-the-shoulder"],
    rng,
  );
  const motion = pickFrom(
    ["motion", "sparks from clashing blades", "wind and debris", "speed lines", "impact frames"],
    rng,
  );
  const light = pickFrom(
    anime ? ["moonlight", "lantern light", "lightning flash", "rim light"] : ["hard rim light", "overcast", "neon night"],
    rng,
  );
  const style = anime ? "dramatic composition" : "detailed";
  const lower = text.toLowerCase();
  const extras = [shot, motion, place, light, style].filter(
    (e) => e && !lower.includes(e.split(",")[0]!.trim().toLowerCase()),
  );
  return joinScene([text, ...extras], isAdult(text));
}

const ANIME = {
  shot: [
    "close-up on the face",
    "upper body",
    "medium shot",
    "full body",
    "from the side",
    "low angle full body",
    "high angle",
    "over-the-shoulder",
    "dutch angle",
    "three-quarter view",
    "extreme close-up on the eyes",
    "from behind looking back",
    "worm's eye",
    "cowboy shot",
  ],
  lighting: [
    "soft light",
    "rim light",
    "window light",
    "overcast",
    "night",
    "golden hour",
    "neon",
    "moonlight",
    "candlelight",
    "backlit hair",
    "hard side light",
    "underlighting",
    "god rays",
    "rain reflections",
  ],
  style: [
    "detailed face",
    "clean linework",
    "cel shading",
    "anime still",
    "sharp lineart",
    "painterly anime",
    "high detail eyes",
    "film grain anime",
  ],
  pose: [
    "sitting",
    "standing",
    "walking",
    "arms at sides",
    "hand on hip",
    "leaning forward",
    "looking back over the shoulder",
    "kneeling",
    "arms crossed",
    "reaching out",
    "hands behind back",
    "one knee up",
  ],
  face: [
    "neutral expression",
    "looking aside",
    "closed mouth",
    "half-lidded eyes",
    "slight smile",
    "scowl",
    "parted lips",
    "looking at viewer",
    "tearing up",
    "smirk",
    "teeth showing",
  ],
  clothes: [
    "shirt and pants",
    "jacket",
    "hoodie",
    "simple dress",
    "sailor-style top",
    "crop top and skirt",
    "coat over a thin shirt",
    "tank and shorts",
    "armor pieces over cloth",
    "ripped clothes",
    "open jacket nothing under",
    "evening dress",
  ],
  place: [
    "street",
    "interior",
    "overcast outdoor",
    "empty room",
    "bedroom",
    "rooftop at night",
    "train platform",
    "rain alley",
    "shrine path",
    "apartment kitchen",
    "club bathroom",
    "forest edge",
    "hotel corridor",
    "rooftop water tank",
  ],
};

const PHOTO = {
  shot: [
    "close-up",
    "medium shot",
    "wide shot",
    "over-the-shoulder",
    "low angle",
    "high angle",
    "full body",
    "profile",
    "35mm close",
    "50mm portrait",
    "85mm face",
    "from behind",
  ],
  lighting: [
    "window light",
    "overcast",
    "practical lamps",
    "golden hour",
    "neon night",
    "softbox",
    "hard sun",
    "candle",
    "street lamp",
    "flash fill",
    "rembrandt",
    "backlight haze",
  ],
  style: [
    "detailed skin",
    "sharp focus",
    "film still",
    "35mm grain",
    "wet skin highlights",
    "pores",
    "editorial",
    "documentary flash",
  ],
  pose: [
    "sitting",
    "standing",
    "leaning on a wall",
    "walking",
    "hands in pockets",
    "arms folded",
    "looking down",
    "head turned",
    "weight on one hip",
    "crouched",
  ],
  face: [
    "neutral",
    "looking aside",
    "mouth closed",
    "tired eyes",
    "smirk",
    "jaw set",
    "soft mouth",
    "looking at camera",
    "brows knit",
  ],
  clothes: [
    "jeans and a shirt",
    "hoodie",
    "jacket",
    "little black dress",
    "suit jacket open",
    "tank top",
    "leather jacket",
    "sweater falling off a shoulder",
    "wet t-shirt",
    "unbuttoned shirt",
    "coat and nothing else",
  ],
  place: [
    "interior",
    "city street",
    "overcast outdoor",
    "motel room",
    "parking garage",
    "diner booth",
    "apartment at night",
    "warehouse",
    "rooftop",
    "car interior",
    "bathroom mirror",
    "alley with steam",
  ],
};

/** Fills the box with a finished prompt. Never leaves __tokens__ behind. */
export function writePrompt(opts: {
  flavor: PromptFlavor;
  files: WildcardFile[];
  seed: number;
  existing?: string;
  family?: "flux" | "sdxl" | "sd15";
  checkpoint?: string;
}): string {
  const rng = mulberry32(opts.seed);
  const p = (name: string) => pickLine(opts.files, name, rng);
  const ckpt = (opts.checkpoint ?? "").toLowerCase();
  const anime =
    opts.family === "sd15" ||
    (/mix|anime|kitten|illustrious|noob|nai|pony/.test(ckpt) && !ckpt.includes("flux"));
  const pack = anime ? ANIME : PHOTO;
  const shot = pickFrom(pack.shot, rng);
  const lighting = pickFrom(pack.lighting, rng);
  const style = pickFrom(pack.style, rng);
  const poseA = pickFrom(pack.pose, rng);
  const face = pickFrom(pack.face, rng);
  const clothes = pickFrom(pack.clothes, rng);
  const place = pickFrom(pack.place, rng);
  const body = p("body");
  const person = p("person");
  const hair = p("hair");
  const clothing = p("clothing");
  const pose = p("pose");
  const expression = p("expression");
  const act = p("act");
  const setting = p("setting");

  if (opts.flavor === "person") {
    const raw = (opts.existing ?? "").trim();
    if (raw) {
      const { expanded } = expandPrompt(raw, opts.files, opts.seed);
      return keepNeutral(lookFill(expanded, anime, rng), raw, "person");
    }
  }

  if (opts.flavor === "enhance") {
    const raw = (opts.existing ?? "").trim();
    if (!raw) return writePrompt({ ...opts, flavor: "person" });
    const { expanded } = expandPrompt(raw, opts.files, opts.seed);
    return keepNeutral(lookFill(expanded, anime, rng), raw, "enhance");
  }

  if (opts.flavor === "sex" || opts.flavor === "bdsm" || opts.flavor === "dark" || opts.flavor === "taboo" || opts.flavor === "horror") {
    const raw = (opts.existing ?? "").trim() || "her";
    const { expanded } = expandPrompt(raw, opts.files, opts.seed);
    if (opts.flavor === "taboo") return writeTabooSet(expanded, opts.seed)[0] ?? expanded;
    if (opts.flavor === "horror") return writeHorrorSet(expanded, opts.seed)[0] ?? expanded;
    const idx = opts.flavor === "bdsm" ? 1 : opts.flavor === "dark" ? 2 : 0;
    return writeExtreme(expanded, opts.seed)[idx] ?? expanded;
  }

  if (opts.flavor === "scene") {
    const raw = (opts.existing ?? "").trim();
    const cam = pickFrom(pack.shot, rng);
    const light = pickFrom(pack.lighting, rng);
    const loc = setting || pickFrom(pack.place, rng);
    const extra = pickFrom(
      [
        "depth of field",
        "volumetric light",
        "wet ground reflections",
        "dust in the air",
        "fog",
        "rain streaks",
        "practical lights in frame",
        "bokeh",
      ],
      rng,
    );
    return joinScene([raw, cam, loc, light, extra, style].filter(Boolean), false);
  }

  if (anime) {
    return keepNeutral(
      joinScene(["adult", clothes, poseA, face, place, lighting, style], false),
      opts.existing ?? "",
      opts.flavor,
    );
  }

  return keepNeutral(
    joinScene(
      [`${shot} of a ${body} ${person} with ${hair}`, clothing, pose, expression, setting, lighting, style],
      false,
    ),
    opts.existing ?? "",
    opts.flavor,
  );
}

/** Grok clip: i2v locks the still; t2v invents motion. */
export function grokMotion(typed: string, kind: "still-lock" | "invent" = "invent"): string {
  const lead = userLead(recoverScene(typed) || typed || "")
    .replace(/\s+/g, " ")
    .trim();
  if (kind === "still-lock") {
    const core = lead || "the same people";
    return `${core}, same face, same body, same clothes, same hair, subtle motion only, breathing, hair drift, cloth shift, sharp focus, no morph, no warp`;
  }
  if (!lead) return "slow camera push in, natural motion, hair and cloth move";
  const moving =
    /\b(walk|run|turn|look|kiss|blow|rain|pan|zoom|move|spin|fight|fly|swim|fall|shake|breathe|laugh|cry|dance|thrust|ride)\b/i.test(
      lead,
    );
  const core = moving ? lead : `${lead}, she moves, camera push in`;
  return `${core}, natural motion, hair and cloth move, sharp focus, high detail, stable camera, clear, cinematic lighting`;
}
export function grokExpand(opts: {
  typed: string;
  files: WildcardFile[];
  seed: number;
  family?: "flux" | "sdxl" | "sd15";
  checkpoint?: string;
  roll?: "normal" | "random";
}): string {
  const raw = (opts.typed ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  const { expanded: wild } = expandPrompt(raw, opts.files, opts.seed);
  const dump =
    isPurpleProse(wild) ||
    /pores|subsurface scatter|flagstone|keep yard|detailed anatomy|highly detailed anime still/i.test(wild);
  const lead = dump ? recoverScene(wild) : userLead(wild);
  const ckpt = (opts.checkpoint ?? "").toLowerCase();
  const anime =
    opts.family === "sd15" ||
    (/mix|anime|kitten|illustrious|noob|nai|pony/.test(ckpt) && !ckpt.includes("flux"));
  const nsfw = wantsSexAct(lead) || isAdult(lead);
  if (opts.roll === "random" || /\{[^{}|]+\|/.test(wild)) {
    const curly = /\{[^{}|]+\|/.test(wild) ? wild : withRandomBlocks(lead, nsfw);
    const flat = flattenPrompt(curly, opts.seed);
    if (!tooClose(flat, lead)) return flat;
  }
  const flavor: PromptFlavor = nsfw ? "sex" : "enhance";
  let out = flattenPrompt(
    writePrompt({
      flavor,
      existing: lead,
      files: opts.files,
      seed: opts.seed,
      family: opts.family,
      checkpoint: opts.checkpoint,
    }),
    opts.seed,
  );
  const thin = (s: string) =>
    tooClose(s, lead) || tooClose(s, raw) || s.split(/\s+/).length <= lead.split(/\s+/).length + 6;
  if (thin(out)) {
    const rng = mulberry32(opts.seed + 17);
    out = lookFill(lead, anime, rng);
  }
  if (thin(out)) {
    out = grokFill(lead, anime, mulberry32(opts.seed + 31));
  }
  if (thin(out)) {
    out = flattenPrompt(withRandomBlocks(lead, nsfw), opts.seed);
  }
  return out;
}

/** Keep the last scene, weave in picks, output one new ordered prompt. */
export function composeNewScene(
  existing: string,
  extras: { label: string; tags: string }[],
): string {
  const lead = userLead(recoverScene(existing) || existing || "").replace(/\s+/g, " ").trim();
  const tags = extras
    .map((e) => (e.tags || e.label || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase().slice(0, 28);
    if (seen.has(k)) continue;
    if (lead && lead.toLowerCase().includes(k)) continue;
    seen.add(k);
    unique.push(t);
  }
  const subject = lead || "an adult";
  if (!unique.length) return subject;
  const comic = unique.filter((t) => /comic|manga|panel|screentone|halftone|webtoon|gekiga|kirby/i.test(t));
  const rest = unique.filter((t) => !comic.includes(t));
  return [subject, ...rest.slice(0, 16), ...comic.slice(0, 4)]
    .filter(Boolean)
    .join(", ");
}

export const DEFAULT_WILDCARDS: WildcardFile[] = [
  {
    name: "person",
    lines: [
      "woman",
      "man",
      "young woman",
      "young man",
      "mature woman",
      "mature man",
      "tall woman",
      "short woman",
      "broad man",
      "lean man",
      "androgynous adult",
      "muscular woman",
      "soft man",
    ],
  },
  {
    name: "body",
    lines: [
      "slim",
      "athletic",
      "curvy",
      "thick",
      "soft belly",
      "muscular",
      "petite",
      "tall",
      "heavy",
    ],
  },
  {
    name: "hair",
    lines: [
      "long black hair",
      "short black hair",
      "long blonde hair",
      "red hair",
      "brown wavy hair",
      "silver hair",
      "buzz cut",
      "wet hair",
      "braids",
      "bald",
    ],
  },
  {
    name: "clothing",
    lines: [
      "nude",
      "topless",
      "lingerie",
      "underwear only",
      "open shirt",
      "jeans and a tank",
      "little black dress",
      "hoodie and shorts",
      "leather jacket, nothing under",
      "fully clothed",
      "wedding dress hiked up",
      "uniform partly off",
    ],
  },
  {
    name: "pose",
    lines: [
      "standing",
      "sitting",
      "lying on their back",
      "on all fours",
      "kneeling",
      "leaning on a wall",
      "walking toward camera",
      "looking over their shoulder",
      "legs spread",
      "from behind",
    ],
  },
  {
    name: "expression",
    lines: [
      "neutral",
      "smiling",
      "a smirk",
      "mouth open",
      "angry",
      "tired",
      "looking at the camera",
      "eyes closed",
      "crying",
      "laughing",
    ],
  },
  {
    name: "act",
    lines: [
      "kissing",
      "having sex",
      "giving head",
      "being fucked",
      "masturbating",
      "just standing there",
      "undressing",
      "after sex",
      "making out",
    ],
  },
  {
    name: "setting",
    lines: [
      "messy bedroom",
      "bathroom",
      "kitchen at night",
      "cheap hotel",
      "car back seat",
      "alley",
      "forest",
      "rooftop",
      "office after hours",
      "studio seamless",
      "shower",
    ],
  },
  {
    name: "lighting",
    lines: [
      "harsh flash",
      "window light",
      "neon",
      "lamp light",
      "overcast",
      "golden hour",
      "dark with one practical",
      "fluorescent",
    ],
  },
  {
    name: "camera",
    lines: [
      "phone snapshot",
      "35mm",
      "50mm",
      "85mm portrait",
      "low angle",
      "high angle",
      "cctv",
      "point of view",
    ],
  },
  {
    name: "shot",
    lines: ["close-up", "medium shot", "full body", "wide shot", "detail"],
  },
  {
    name: "style",
    lines: [
      "photoreal",
      "amateur photo",
      "film still",
      "raw photo",
      "digital painting",
      "anime",
      "3d render",
    ],
  },
];
