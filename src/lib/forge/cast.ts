import { characterLabel, characterShow } from "./types";

type CastRow = { keys: string[]; looks: string };

const CAST: CastRow[] = [
  { keys: ["hestia"], looks: "short black hair, blue eyes, white sleeveless dress, blue ribbon hair bow, ahoge, large breasts, goddess, adult" },
  { keys: ["liliruca", "lili arde", "lilirucaarde"], looks: "pallum girl, short messy brown hair, red eyes, petite adult, choker, supporter, adventurer" },
  { keys: ["aiswallenstein", "ais wallenstein"], looks: "long blonde hair, gold eyes, white and pale-blue armor, swordswoman, tall, adult" },
  { keys: ["ryuu", "ryuu lion", "ryuu-danmachi"], looks: "elf waitress, long blonde hair, green eyes, pointed ears, white shirt, black vest, adult" },
  { keys: ["syr", "syr flova", "syrflova"], looks: "pink-red hair, blue eyes, waitress, white shirt, black vest, adult" },
  { keys: ["anyaflomer", "anya flomer"], looks: "cat girl, blonde hair, cat ears, waitress, adult" },
  { keys: ["chloelolo", "chloe lolo"], looks: "cat girl, dark hair, cat ears, thief, adult" },
  { keys: ["yamatomikoto", "yamato mikoto"], looks: "black hair, purple eyes, japanese clothes, katana, adult" },
  { keys: ["ishtar"], looks: "dark skin, long black hair, gold jewelry, goddess, large breasts, adult" },
  { keys: ["raphtalia"], looks: "raccoon demi-human, long brown hair, tanuki ears, fluffy tanuki tail, red eyes, shield heroine, adult" },
  { keys: ["filo", "filosh"], looks: "filolial girl, long blonde hair, blue eyes, white wings, white dress, bird girl, adult" },
  { keys: ["sadeena"], looks: "killer whale demi-human, long blue-black hair, orca markings, killer whale tail, adult" },
  { keys: ["atlafayon", "atla"], looks: "q'ten lo cat girl, white hair, cat ears, blindfold, petite, adult" },
  { keys: ["melty"], looks: "short blue hair, blue eyes, princess dress, young adult" },
  { keys: ["glasssh", "glass"], looks: "long green hair, fan weapons, otherworld hero, adult" },
  { keys: ["kizuna"], looks: "short brown hair, hunter, otherworld, adult" },
  { keys: ["sadeena"], looks: "orca demi-human, long dark hair, adult" },
  { keys: ["therese"], looks: "crystal woman, pink hair, jewel body, adult" },
  { keys: ["wydia"], looks: "shield hero supporting girl, adult" },
  { keys: ["keel-"], looks: "dog demi-human, brown hair, dog ears, adult" },
  { keys: ["rias", "riasgremory"], looks: "crimson red hair, blue-green eyes, pale skin, large breasts, crimson magician, high school, adult" },
  { keys: ["akeno", "himejima"], looks: "long black hair, violet eyes, shrine maiden, large breasts, adult" },
  { keys: ["koneko", "toujoukoneko"], looks: "short white hair, cat ears, yellow eyes, petite, black cat, adult" },
  { keys: ["xenovia"], looks: "short blue hair, yellow-green eyes, holy sword, knight, adult" },
  { keys: ["asiaargento", "asia argento"], looks: "long blonde hair, green eyes, nun habit, gentle, adult" },
  { keys: ["irina", "shidouirina"], looks: "brown twintails, green eyes, angel, adult" },
  { keys: ["kuryuu", "kiryuu aika"], looks: "black hair, glasses, school girl, adult" },
  { keys: ["kunou"], looks: "blonde twintails, fox ears, shrine, adult" },
  { keys: ["albedo"], looks: "long black hair, horns, golden slit eyes, white dress, succubus, black wings, adult" },
  { keys: ["shalltear"], looks: "vampire, silver-white hair, red eyes, gothic dress, petite, fangs, adult" },
  { keys: ["emmot", "enri"], looks: "goblin-allied village girl, brown hair, adult" },
  { keys: ["antilene"], looks: "long silver hair, extra arms, combat maid, adult" },
  { keys: ["erisboreas", "eris boreas", "eris-boreas"], looks: "long red hair, red eyes, fierce, swordswoman, muscular-lean, adult" },
  { keys: ["sylphie", "sylphiette"], looks: "short green hair, red eyes, elf ears, shy, mage, adult" },
  { keys: ["elinalise"], looks: "elf, long blonde hair, huge bust, adventurer, adult" },
  { keys: ["linia"], looks: "beast girl, cat features, adult" },
  { keys: ["shion"], looks: "kijin, long purple hair, horn, secretary, huge bust, adult" },
  { keys: ["shuna"], looks: "kijin, pink hair, horn, shrine maiden, adult" },
  { keys: ["luminous", "valentine"], looks: "vampire, pale blonde hair, red eyes, gothic, adult" },
  { keys: ["velzard"], looks: "white hair, ice dragonoid, pale, adult" },
  { keys: ["suphia"], looks: "tiger beast girl, white hair, tiger ears, adult" },
  { keys: ["myulan"], looks: "blue hair, mage, adult" },
  { keys: ["fran-tensura", "tenken-fran", "fran-"], looks: "black panther beast girl, black hair, cat ears, katana, adult" },
  { keys: ["remgalleu", "rem galleu"], looks: "panther beast girl, dark skin, panther ears and tail, adult" },
  { keys: ["shera", "sheralgreenwood"], looks: "elf, blonde hair, large breasts, princess, adult" },
  { keys: ["sylvie"], looks: "dark elf, dark skin, white hair, adult" },
  { keys: ["lumachina"], looks: "holy woman, blonde, white robes, adult" },
  { keys: ["rosexl", "rose "], looks: "armor, knight woman, adult" },
  { keys: ["jibril"], looks: "flugel, rainbow eyes, long gray hair, white-gold outfit, wings, adult" },
  { keys: ["shiro-no-game", "shiro-shuvi", "shuva"], looks: "white hair, red eyes, blank, gamer, petite adult" },
  { keys: ["moka", "akashiya"], looks: "rosario vampire, silver or pink hair, yellow or red eyes, fangs, adult" },
  { keys: ["noelle", "noellesilva"], looks: "short silver hair, royalty, water mage, adult" },
  { keys: ["claire_redfield", "claire redfield"], looks: "brown hair, red jacket, resident evil, adult" },
  { keys: ["jill_valentine", "jill valentine"], looks: "brown hair, bsaa, resident evil, adult" },
  { keys: ["aerith"], looks: "long brown hair in a braid, pink dress, green eyes, flower girl, adult" },
  { keys: ["tifa", "passiontifa", "lockhart"], looks: "long black hair, red eyes, white tank top, black skirt, adult" },
  { keys: ["alice starg", "alicestarga"], looks: "named heroine, canon look, adult" },
  { keys: ["alexia", "midgar"], looks: "blonde, princess, sword, adult" },
  { keys: ["aiswallenstein", "ais "], looks: "blonde swordswoman, gold eyes, adult" },
  { keys: ["anya forger", "anya_forger"], looks: "pink hair, green eyes, spy family character" },
  { keys: ["daki"], looks: "upper moon, long black-pink hair, obi, demon, adult" },
  { keys: ["hinatsuru"], looks: "demon slayer supporting woman, adult" },
  { keys: ["papi_"], looks: "harpy, blue hair, bird wings, talons, adult" },
  { keys: ["suu_"], looks: "slime girl, green translucent body, adult" },
  { keys: ["miia", "lamia-miia"], looks: "lamia, red hair, snake lower body, adult" },
  { keys: ["meroune"], looks: "mermaid, pink hair, fish tail, adult" },
  { keys: ["arachnera", "rachnera"], looks: "arachne, purple hair, spider lower body, adult" },
  { keys: ["izuna", "hatsuse"], looks: "fox girl, brown hair, fox ears and tails, kimono, adult" },
  { keys: ["lynga"], looks: "healer girl, adult" },
  { keys: ["ellie"], looks: "gacha heroine, adult" },
  { keys: ["nazuna"], looks: "gacha heroine, adult" },
  { keys: ["sena"], looks: "farm isekai girl, adult" },
  { keys: ["lexia"], looks: "princess, blonde, adult" },
  { keys: ["kanzakirin", "rin "], looks: "cheat-skill heroine, adult" },
  { keys: ["kaede"], looks: "cheat-skill heroine, adult" },
  { keys: ["yuki-saegusa", "saegusa"], looks: "black hair, school, adult" },
  { keys: ["mamar"], looks: "a rank party girl, adult" },
  { keys: ["marina"], looks: "a rank party girl, adult" },
  { keys: ["nene", "shifindle"], looks: "a rank party girl, adult" },
  { keys: ["osen", "jamie"], looks: "a rank party girl, adult" },
  { keys: ["silk"], looks: "a rank party girl, adult" },
  { keys: ["rain"], looks: "a rank party girl, adult" },
  { keys: ["angelina"], looks: "named woman, canon look, adult" },
  { keys: ["alice starga2", "alice starga", "alicestarga2"], looks: "named heroine, long hair, canon outfit, adult" },
  { keys: ["raphtaliakid", "raphtalia kid"], looks: "young raccoon demi-human look from early shield hero, tanuki ears, red eyes, adult-coded redesign, adult" },
  { keys: ["shalltearbloodfallen", "shalltear bloodfallen"], looks: "vampire, silver-white hair, crimson eyes, gothic lolita dress, petite adult, fangs" },
  { keys: ["syr flova", "syr_flova"], looks: "pink-red hair, blue eyes, hostess uniform, white shirt, black vest, adult" },
  { keys: ["syne lokk", "syne_lokk"], looks: "shield hero supporting woman, canon look, adult" },
  { keys: ["dwargon", "dwargonelf"], looks: "dwarf king or dark elf of tensura, adult" },
  { keys: ["luminousvalentine"], looks: "vampire queen, pale blonde hair, red eyes, elegant gothic, adult" },
  { keys: ["yamihealer", "lynga"], looks: "dark healer girl, canon look, adult" },
];

function hay(filename: string) {
  return `${filename} ${characterLabel(filename)}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function lookupCastLooks(filename: string): string {
  const h = ` ${hay(filename)} `;
  let best: CastRow | undefined;
  let bestLen = 0;
  for (const row of CAST) {
    for (const k of row.keys) {
      const token = k.toLowerCase().trim();
      if (token.length < 3) continue;
      if (h.includes(token) && token.length > bestLen) {
        best = row;
        bestLen = token.length;
      }
    }
  }
  return best?.looks || "";
}

/** What the writer / LoRA need in the box: name + series + canon look. */
export function characterBio(filename: string): string {
  const label = characterLabel(filename);
  const show = characterShow(filename);
  const looks = lookupCastLooks(filename);
  const series = show && show !== "Other" ? `${show} character` : "";
  const bits = [label, series, looks || "canon appearance, official design, named character, adult"];
  return bits.filter(Boolean).join(", ");
}

export function enabledCastBios(loras: { filename: string; enabled?: boolean }[]): string[] {
  return loras.filter((l) => l.enabled).map((l) => characterBio(l.filename)).filter(Boolean);
}

export function withCastBios(prompt: string, bios: string[]): string {
  const p = (prompt || "").trim();
  if (!bios.length) return p;
  const missing = bios.filter((b) => {
    const name = b.split(",")[0]?.trim() || "";
    const first = name.split(/\s+/)[0] || "";
    return first.length > 2 && !new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(p);
  });
  if (!missing.length) {
    const needLooks = bios.filter((b) => !/\b(hair|eyes|ears|tail|dress|armor|ribbon)\b/i.test(p));
    if (!needLooks.length) return p;
    return `${needLooks.join(". ")}. ${p}`.trim();
  }
  return `${missing.join(". ")}${p ? `. ${p}` : ""}`.trim();
}

export function stripPersonFromPrompt(prompt: string, filename: string): string {
  const label = characterLabel(filename);
  const bio = characterBio(filename);
  let p = (prompt || "").trim();
  if (bio) {
    const idx = p.toLowerCase().indexOf(bio.toLowerCase());
    if (idx >= 0 && idx < 8) p = (p.slice(0, idx) + p.slice(idx + bio.length)).replace(/^[\s,.;]+/, "");
  }
  if (label && label.length > 2) {
    const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.']{0,160}\\.\\s*`, "i");
    p = p.replace(re, "");
  }
  return p.replace(/^[\s,.;]+/, "").replace(/\s+/g, " ").trim();
}
