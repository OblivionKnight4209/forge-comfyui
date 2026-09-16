import { LOOK_APPENDS } from "./looks";
import {
  FACE_MORE,
  BODY_MORE,
  CLOTHES_MORE,
  PLACE_MORE,
  CAM_MORE,
  LIGHT_MORE,
  MORE_MORE,
  COMIC_MORE,
  EVIL_MORE,
  NSFW_MORE,
} from "./write-bits";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ANATOMY = [
  "pussy in view, labia, clit",
  "cock out, veins, precum",
  "bare tits, hard nipples",
  "ass spread, hole visible",
  "cum on skin, dripping",
  "wet pussy, juices",
  "erection, heavy balls",
  "breasts pressed together",
  "throat bulge",
  "stretched hole, gaping",
  "ahegao, tongue out, crossed eyes",
  "creampie leaking down thighs",
  "puffy nipples, areola",
  "inner thighs wet",
  "cockhead flared, dripping",
  "clit hood pulled back",
  "ass cheeks spread by hands",
  "cum in navel",
  "saliva string from lip to cock",
  "hickeys on the neck",
  "scratches down his back",
  "bite mark on the shoulder",
  "pubic hair trimmed",
  "veiny shaft, wet",
  "labia stretched around cock",
  "balls tight against her",
];

const SEX = [
  "fucking, penetration, hips slamming",
  "blowjob, lips stretched around cock, spit",
  "cunnilingus, face in pussy, tongue out",
  "handjob, fist around shaft",
  "cowgirl, bouncing, cock buried",
  "doggy style, grabbing hips",
  "missionary, legs up, deep",
  "anal, stretched hole",
  "creampie, cum leaking",
  "facefuck, tears, drool",
  "titfuck, cock between breasts",
  "masturbating, fingers in pussy",
  "double penetration",
  "gangbang, several cocks",
  "bukkake, cum on face and tits",
  "breeding press, legs pinned",
  "reverse cowgirl, looking back",
  "standing fuck against the wall",
  "prone bone, face in pillow",
  "lotus position, deep grind",
  "full nelson, folded, lifted",
  "mating press, knees to shoulders",
  "spooning, from behind on the side",
  "69, mutual oral",
  "amazon position, she pins him",
  "piledriver, folded in half",
  "standing carry, legs around waist",
  "bent over the table, from behind",
  "on all fours, face down ass up",
  "spitroast, mouth and pussy filled",
  "slow grind, cock fully in",
  "quick shallow thrusts then slam",
  "she cums on his cock, shaking",
  "he pulls out, cums on her tits",
  "he stays in, flooding her",
  "fingering her while fucking her mouth",
  "two fingers in the ass, cock in pussy",
  "dry humping then clothes yanked aside",
  "she rides until her thighs shake",
  "hair pulled while from behind",
  "ankles on his shoulders",
  "one leg up, standing split",
  "she jerks him onto her tongue",
  "he eats her out until she squirts",
  "quickie, pants around ankles",
  "all night, sheets wrecked",
];

const BDSM = [
  "bondage, rope harness, tied wrists",
  "collar and leash, kneeling",
  "ball gag, drool, muffled",
  "cuffs, spreader bar, legs forced open",
  "hogtie on the floor",
  "spanked ass, red handprints",
  "riding crop, welts",
  "nipple clamps, chain",
  "blindfold, helpless",
  "shibari suspension, ropes biting skin",
  "dominant standing over submissive",
  "pet play, on all fours, collar",
  "choked lightly, hand on throat",
  "caged, dungeon wall",
  "latex catsuit, zipper open",
  "steel stocks, bent over",
  "wax dripping on breasts",
  "paddle, sting, flushed skin",
  "ring gag, mouth forced open",
  "armbinder, chest out",
  "rope crotch, pulling up",
  "anal hook, tail rope to a collar",
  "leather hood, zippered mouth",
  "over-the-knee spanking",
  "belt marks across the ass",
  "cane welts, precise",
  "clit clamp, chain to collar",
  "cock cage, denied",
  "predicament bondage, on tiptoes",
  "mummified in wrap, only mouth free",
  "st. andrews cross, strapped",
  "queening chair, sitting on his face",
  "breast bondage, rope shelf",
  "ice on nipples, flinching",
  "violet wand tracing inner thighs",
  "slave pose, forehead on the floor",
  "punished, corner, plugged",
  "leash yanked, forced to crawl",
  "bit gag, leather straps",
  "thigh cuffs chained to wrists",
];

export const NSFW_CORE: { id: string; label: string; tags: string }[] = [
  { id: "tentacle", label: "Tentacle", tags: "tentacles wrapping thighs and waist, wet suckers, tentacle in pussy, tentacle in mouth" },
  { id: "monster", label: "Monster", tags: "monster sex, bestial claws, size difference, feral body, human woman, explicit" },
  { id: "demon", label: "Demon", tags: "demon, horns, tail, claws, hellfire, corruption, fucking her" },
  { id: "succubus", label: "Succubus", tags: "succubus, bat wings, heart tail, draining him, riding cock, glowing eyes" },
  { id: "incubus", label: "Incubus", tags: "incubus, dark wings, holding her down, feeding, explicit sex" },
  { id: "vampire", label: "Vampire", tags: "vampire, fangs in neck, blood smear, pale skin, night, biting while fucking" },
  { id: "werewolf", label: "Werewolf", tags: "werewolf, fur, knot, full moon, size difference, mounting her" },
  { id: "goblin", label: "Goblin", tags: "goblin, short muscular, green skin, gangbang, breeding, smug" },
  { id: "orc", label: "Orc", tags: "orc, tusks, huge cock, green-grey skin, holding her up, breeding" },
  { id: "minotaur", label: "Minotaur", tags: "minotaur, bull head, huge body, labyrinth, mounting, size difference" },
  { id: "dragon", label: "Dragon", tags: "dragon, scales, knot, heat, treasure hoard, oviposition aesthetic" },
  { id: "slime", label: "Slime", tags: "slime girl, translucent body, dissolving clothes, engulfing, tentacle slime" },
  { id: "alien", label: "Alien", tags: "alien, ovipositor, eggs, strange anatomy, probing, glowing fluids" },
  { id: "naga", label: "Naga", tags: "naga, snake lower body, coils around her, constricting, explicit" },
  { id: "lamia", label: "Lamia", tags: "lamia, long tail, coils, hypnotic eyes, swallowing thighs" },
  { id: "spider", label: "Arachne", tags: "arachne, spider girl, webbing bondage, eggs, dark nest" },
  { id: "harpy", label: "Harpy", tags: "harpy, wings, talons, nest, mounting, feathers everywhere" },
  { id: "centaur", label: "Centaur", tags: "centaur, equine body, size, mounting, stable, explicit" },
  { id: "satyr", label: "Satyr", tags: "satyr, goat legs, horns, flute dropped, rutting" },
  { id: "ghost", label: "Ghost", tags: "ghost, translucent hands, possession, haunted bed, ectoplasm" },
  { id: "shadow", label: "Shadow", tags: "living shadows grabbing, darkness tendrils, pin, violate" },
  { id: "drow", label: "Dark elf", tags: "dark elf, drow, white hair, dark skin, underdark, cruel smirk, explicit" },
  { id: "witch", label: "Witch", tags: "witch, ritual circle, grimoire, riding a demon, candles, naked" },
  { id: "cult", label: "Cult", tags: "cult ritual, hooded figures, altar, orgy, candles, sacrifice aesthetic" },
  { id: "possess", label: "Possessed", tags: "possession, glowing eyes, smirk, body used, demon inside" },
  { id: "hypno", label: "Hypnosis", tags: "hypnosis, spiral eyes, mindless smile, obey, drool, used" },
  { id: "corrupt", label: "Corruption", tags: "corruption, dark veins, glowing marks, falling, eager now" },
  { id: "ahegao", label: "Ahegao", tags: "ahegao, tongue out, crossed eyes, ruined makeup, fucked silly" },
  { id: "breed", label: "Breeding", tags: "breeding press, creampie, womb, knocking her up, held down" },
  { id: "impreg", label: "Impreg", tags: "impregnation, creampie, swollen belly start, cum stuffed" },
  { id: "ovi", label: "Oviposition", tags: "oviposition, eggs filling belly, ovipositor, stuffed, leaking" },
  { id: "inflate", label: "Inflation", tags: "belly inflation, stuffed with cum, taut, leaking" },
  { id: "size", label: "Size diff", tags: "huge size difference, tiny adult woman, massive cock, stretched" },
  { id: "femdom", label: "Femdom", tags: "femdom, she rides his face, pegging, boot on chest, smirk" },
  { id: "maledom", label: "Maledom", tags: "maledom, pinning her, hair pull, using her, rough" },
  { id: "peg", label: "Pegging", tags: "pegging, strap-on, him on all fours, she grinning" },
  { id: "glory", label: "Glory hole", tags: "glory hole, anonymous cock through wall, sucking, messy" },
  { id: "public", label: "Public", tags: "public sex, exhibition, people nearby, clothes pulled aside" },
  { id: "voyeur", label: "Voyeur", tags: "being watched, window, voyeur, she knows, keeps going" },
  { id: "gang", label: "Gangbang", tags: "gangbang, many hands, many cocks, used, messy" },
  { id: "freeuse", label: "Free use", tags: "free use, anyone can use her, vacant smile, still being fucked" },
  { id: "netorare", label: "NTR", tags: "netorare, cheating, being taken, watching, explicit" },
  { id: "futa", label: "Futa", tags: "futanari, cock and pussy, erection, fucking her, cum" },
  { id: "femboy", label: "Femboy", tags: "femboy, feminine adult, thighs, cock, blush, explicit" },
  { id: "yuri", label: "Yuri", tags: "two women, scissoring, tribbing, strap-on, wet" },
  { id: "yaoi", label: "Yaoi", tags: "two men, explicit sex, kissing, cock, sweat" },
  { id: "monstergirl", label: "Monster girl", tags: "monster girl, nonhuman features, human torso, explicit sex" },
  { id: "latex", label: "Latex", tags: "latex suit, shine, zipper, hood, catsuit, explicit" },
  { id: "medical", label: "Medical", tags: "exam table, stirrups, speculum, nurse, clinical light, explicit" },
  { id: "dungeon", label: "Dungeon", tags: "dungeon, chains, torchlight, stone, used as a toy" },
  { id: "prison", label: "Prison", tags: "prison cell, bars, conjugal, against the bars, explicit" },
  { id: "slave", label: "Slave", tags: "slave collar, brand, kneeling, presenting, owned" },
  { id: "maid", label: "Maid", tags: "maid outfit pulled aside, serving, on her knees, messy" },
  { id: "nun", label: "Nun", tags: "nun habit open, blasphemy, chapel, fucked at the altar" },
  { id: "witchsex", label: "Warlock pact", tags: "infernal pact, signing in blood, demon claiming her body" },
  { id: "fallen", label: "Fallen angel", tags: "fallen angel, black wings, halo cracked, corrupted, explicit" },
  { id: "necromancer", label: "Necro", tags: "necromancer, undead hands, ritual, dark magic, explicit living adult" },
  { id: "mummy", label: "Mummy", tags: "bandages unraveling, tomb, ancient, wrapping her, explicit" },
  { id: "pirate", label: "Pirate", tags: "pirate, ship cabin, plundered, bent over the table" },
  { id: "barbarian", label: "Barbarian", tags: "barbarian, furs, claiming, furs on the floor, rough sex" },
  { id: "office", label: "Office", tags: "office, desk, after hours, skirt up, files scattered" },
  { id: "nurse", label: "Nurse", tags: "nurse, clinic, stockings, bent over the bed" },
  { id: "cop", label: "Uniform", tags: "uniform half off, badge, cuffs used for sex, squad car aesthetic" },
  { id: "bodywrite", label: "Body writing", tags: "body writing, slut, cum dump, marker on tits and belly" },
  { id: "lactation", label: "Lactation", tags: "lactation, milk, breasts leaking, sucking nipples" },
  { id: "pregnant", label: "Pregnant", tags: "pregnant adult, swollen belly, sex, careful and explicit" },
  { id: "knot", label: "Knotting", tags: "knot, tied, canine cock, stuck, pulsing" },
  { id: "dp", label: "DP", tags: "double penetration, both holes filled, overwhelmed" },
  { id: "throat", label: "Deepthroat", tags: "deepthroat, nose to groin, throat bulge, spit, tears" },
  { id: "edging", label: "Edging", tags: "edging, denied, dripping, shaking, please" },
  { id: "orgasm", label: "Forced orgasm", tags: "forced orgasm, squirting, overstim, twitching" },
  { id: "vore", label: "Soft vore", tags: "soft vore aesthetic, coils, swallowed to the waist, explicit adult" },
  { id: "feet", label: "Feet", tags: "footjob, soles, toes around cock, worship" },
  { id: "armpit", label: "Armpit", tags: "armpit, face buried, musk, holding her arm up" },
  { id: "watersports", label: "Watersports", tags: "watersports, piss, messy, explicit" },
  { id: "cnc", label: "CNC", tags: "consensual non-consent roleplay, struggling then moaning, adult" },
  { id: "kidnap", label: "Taken", tags: "carried off, thrown over a shoulder, then used, night street" },
  { id: "cage", label: "Cage", tags: "in a cage, reaching through bars, used, pet" },
  { id: "suspension", label: "Hung", tags: "rope suspension, helpless, accessible, fucked while hanging" },
  { id: "wax", label: "Wax", tags: "hot wax on nipples and belly, red drips, flinching" },
  { id: "electro", label: "Electro", tags: "violet wand, sparks, twitching, wired, explicit" },
  { id: "knife", label: "Stab", tags: "stabbing, knife in the chest, blood spray, horror, explicit adult, 18+" },
  { id: "blood", label: "Gore", tags: "gore, blood, viscera, open wound, splatter, horror still, 18+" },
  { id: "choke", label: "Choke", tags: "hand on throat, breath play, eyes rolling, still fucking" },
  { id: "transform", label: "TF", tags: "transformation, body changing, monster parts growing, still adult, explicit" },
  { id: "fleshwall", label: "Flesh wall", tags: "living wall of tentacles and holes, stuck, used from every side" },
  { id: "pit", label: "Tentacle pit", tags: "pit of tentacles, sinking, filled, helpless, moaning" },
  { id: "soul", label: "Soul drain", tags: "succubus draining, glowing from the chest, orgasm as it feeds" },
  { id: "pact", label: "Deal", tags: "deal with a devil, contract, body as payment, claimed" },
  { id: "cemetery", label: "Cemetery", tags: "cemetery, gravestones, night, undead lover, explicit" },
  { id: "haunted", label: "Haunted", tags: "haunted house, poltergeist hands, sheets, used in the dark" },
  { id: "affair", label: "Affair", tags: "secret affair, they shouldn't, hotel, wedding rings on, fucking anyway" },
  { id: "caught", label: "Caught", tags: "caught in the act, door open, still going, shocked and aroused" },
  { id: "cuck", label: "Cuckold", tags: "cuckold, partner watching, being taken, humiliating, explicit" },
  { id: "hotwife", label: "Hotwife", tags: "hotwife, shared, he watches, she looks at him while being fucked" },
  { id: "blackmail", label: "Blackmail", tags: "blackmail, photos, she complies, clothes off, adult" },
  { id: "boss", label: "Boss", tags: "boss and employee, after hours, desk, promotion, explicit adult" },
  { id: "doctor", label: "Doctor", tags: "doctor and adult patient, exam table, unethical, explicit" },
  { id: "priest", label: "Priest", tags: "priest, confession, habit or collar, blasphemy, explicit adult" },
  { id: "stepmom", label: "Stepmom", tags: "adult stepmother, grown stepkid, forbidden, house at night, explicit, 18+" },
  { id: "stepdad", label: "Stepdad", tags: "adult stepfather, grown stepdaughter, forbidden, explicit, 18+" },
  { id: "stepsib", label: "Stepsib", tags: "adult stepsiblings, home alone, forbidden, explicit, 18+" },
  { id: "milf", label: "MILF", tags: "mature woman, MILF, younger adult partner, age gap, explicit, 18+" },
  { id: "dilf", label: "DILF", tags: "mature man, DILF, younger adult partner, age gap, explicit, 18+" },
  { id: "inlaw", label: "In-law", tags: "in-laws, family gathering, sneaking off, forbidden, adults, explicit" },
  { id: "cheating", label: "Cheating", tags: "cheating, spouse in the other room, quiet, urgent, explicit" },
  { id: "secret", label: "Secret", tags: "secret relationship, hiding, hand over mouth, muffling, explicit" },
  { id: "power", label: "Power", tags: "power imbalance, adult, they know it's wrong, still doing it, explicit" },
  { id: "college", label: "College", tags: "college adults, dorm, professor and student both 18+, office hours, explicit" },
  { id: "neighbor", label: "Neighbor", tags: "neighbor, borrowed sugar, door not fully closed, explicit" },
  { id: "roommate", label: "Roommate", tags: "roommates, thin walls, walked in, then joined, explicit" },
  { id: "ex", label: "Ex", tags: "exes, shouldn't, one last time, clothes ripped, explicit" },
  { id: "force", label: "Force", tags: "forced, pinned, struggling, held down, clothes ripped, explicit sex, adult 18+" },
  { id: "rape", label: "Rape", tags: "rape, forced sex, crying, held down, tearing clothes, explicit, adult 18+" },
  { id: "horror", label: "Horror", tags: "horror, terror on the face, dark room, nightmare, blood, 18+" },
  { id: "slasher", label: "Slasher", tags: "slasher, masked killer, knife raised, victim adult, blood, 18+" },
  { id: "torture", label: "Torture", tags: "torture, dungeon, wounds, blood, screaming, adult 18+" },
  { id: "impale", label: "Impale", tags: "impaled, blood, horror, explicit wound, adult 18+" },
  { id: "guignol", label: "Guignol", tags: "grand guignol, theatrical gore, blood on the walls, adult 18+" },
  { id: "bodyhorror", label: "Body horror", tags: "body horror, flesh tearing, viscera, nightmare anatomy, adult 18+" },
  { id: "cannibal", label: "Cannibal", tags: "cannibal horror, blood around the mouth, raw flesh, adult 18+" },
  { id: "undeadgore", label: "Undead", tags: "zombie, rotting, biting, blood, horror, adult 18+" },
  { id: "missionary", label: "Missionary", tags: "missionary, on her back, legs open, looking at him, deep, explicit" },
  { id: "legsup", label: "Legs up", tags: "missionary, legs over his shoulders, folded, deep, explicit" },
  { id: "doggy", label: "Doggy", tags: "doggy style, on all fours, grabbing hips, from behind, explicit" },
  { id: "fda", label: "Ass up", tags: "face down ass up, arched back, from behind, explicit" },
  { id: "cowgirl", label: "Cowgirl", tags: "cowgirl, she rides, bouncing, cock buried, looking down, explicit" },
  { id: "rcowgirl", label: "Reverse cowgirl", tags: "reverse cowgirl, looking back, ass toward him, riding, explicit" },
  { id: "prone", label: "Prone bone", tags: "prone bone, lying on her stomach, from behind, face in pillow, explicit" },
  { id: "spoon", label: "Spooning", tags: "spooning sex, on their side, from behind, close, explicit" },
  { id: "standing", label: "Standing", tags: "standing sex, one leg up, against nothing, holding her, explicit" },
  { id: "wall", label: "Against wall", tags: "fucked against the wall, legs around waist, standing, explicit" },
  { id: "carry", label: "Carry", tags: "standing carry, she wrapped around him, lifted, bouncing, explicit" },
  { id: "lotus", label: "Lotus", tags: "lotus position, sitting in his lap, face to face, deep grind, explicit" },
  { id: "amazon", label: "Amazon", tags: "amazon position, she pins him, riding facing him, in control, explicit" },
  { id: "nelson", label: "Full nelson", tags: "full nelson, arms locked, folded, lifted, helpless, explicit" },
  { id: "pile", label: "Piledriver", tags: "piledriver, folded in half, legs over head, deep, explicit" },
  { id: "mating", label: "Mating press", tags: "mating press, knees to shoulders, folding her, pounding, explicit" },
  { id: "butterfly", label: "Butterfly", tags: "butterfly, on the edge of the bed, legs spread, standing between, explicit" },
  { id: "chair", label: "Chair", tags: "sex on a chair, in his lap, straddling, explicit" },
  { id: "lap", label: "Lap", tags: "on his lap, grinding, clothes shoved aside, explicit" },
  { id: "table", label: "Table", tags: "bent over the table, from behind, grabbing the edge, explicit" },
  { id: "desk", label: "Desk", tags: "on the desk, papers everywhere, legs open, explicit" },
  { id: "kneel", label: "Kneeling", tags: "kneeling, looking up, oral, hands on thighs, explicit" },
  { id: "allfours", label: "All fours", tags: "on all fours, presenting, looking back, explicit" },
  { id: "sixty", label: "69", tags: "69, mutual oral, her on top, face in pussy, cock in mouth, explicit" },
  { id: "facesit", label: "Facesitting", tags: "facesitting, sitting on his face, riding his tongue, explicit" },
  { id: "oralpos", label: "Blowjob", tags: "blowjob, on her knees, lips stretched, spit, looking up, explicit" },
  { id: "cunnilingus", label: "Cunnilingus", tags: "cunnilingus, face in pussy, her thighs around his head, explicit" },
  { id: "handpos", label: "Handjob", tags: "handjob, fist around shaft, stroking, precum, explicit" },
  { id: "titjob", label: "Titfuck", tags: "titfuck, cock between breasts, looking down, explicit" },
  { id: "analpos", label: "Anal", tags: "anal, stretched hole, from behind, gripping her hips, explicit" },
  { id: "spit", label: "Spitroast", tags: "spitroast, one in her mouth, one in her pussy, held between, explicit" },
  { id: "shower", label: "Shower", tags: "shower sex, wet tile, steam, standing, water running, explicit" },
  { id: "carsex", label: "Car", tags: "car sex, cramped, back seat, clothes shoved aside, explicit" },
  { id: "againstglass", label: "Against glass", tags: "pressed against glass, from behind, city lights, explicit" },
  { id: "pretzel", label: "Pretzel", tags: "pretzel, one leg between his, twisted, deep, explicit" },
  { id: "bridge", label: "Bridge", tags: "bridge pose, hips up, from below, explicit" },
  { id: "wheelbarrow", label: "Wheelbarrow", tags: "wheelbarrow, she on her hands, he holds her hips, explicit" },
  { id: "split", label: "Split", tags: "full split, one leg up, standing, explicit" },
  { id: "happybaby", label: "Happy baby", tags: "happy baby, knees to chest, looking up, explicit" },
  { id: "sidefuck", label: "Side", tags: "on their side, scissor, from the side, explicit" },
  { id: "scissor", label: "Scissor", tags: "scissoring, two women, legs locked, grinding, explicit" },
  { id: "trib", label: "Tribbing", tags: "tribbing, pussy on pussy, grinding, explicit" },
  { id: "anvil", label: "Anvil", tags: "anvil, she on her back, legs straight up, folded, explicit" },
  { id: "super", label: "Superimposed", tags: "superimposed, both on their backs, legs up, explicit" },
  { id: "deckchair", label: "Deck chair", tags: "she leaning back, legs open, he kneeling, explicit" },
  { id: "leapfrog", label: "Leapfrog", tags: "leapfrog, chest down, ass up, from behind, explicit" },
  { id: "corkscrew", label: "Corkscrew", tags: "corkscrew, twisted torso, looking back, from behind, explicit" },
  { id: "reversepile", label: "Reverse pile", tags: "reverse piledriver, she folded over him, explicit" },
  { id: "standing69", label: "Standing 69", tags: "standing 69, lifted, mutual oral, explicit" },
  { id: "knee", label: "On his knees", tags: "he on his knees, she standing, face in pussy, explicit" },
  { id: "bentstand", label: "Bent standing", tags: "bent at the waist, standing, from behind, explicit" },
  { id: "sofaarm", label: "Sofa arm", tags: "bent over the sofa arm, from behind, explicit" },
  { id: "counter", label: "Counter", tags: "on the kitchen counter, legs open, explicit" },
  { id: "floor", label: "Floor", tags: "on the floor, messy, missionary, explicit" },
  { id: "wallsit", label: "Wall sit", tags: "he sits against the wall, she in his lap, explicit" },
  { id: "reverseamazon", label: "Reverse amazon", tags: "she pins him, reverse, riding, explicit" },
  { id: "doubleoral", label: "Two on one oral", tags: "two mouths on one cock, explicit" },
  { id: "dpstand", label: "Standing DP", tags: "standing double penetration, held up, explicit" },
  { id: "oni", label: "Oni", tags: "oni, horns, red skin, kanabō dropped, huge, claiming her, explicit" },
  { id: "kitsune", label: "Kitsune", tags: "kitsune, fox ears, many tails, sly, mounting, explicit" },
  { id: "kelpie", label: "Kelpie", tags: "kelpie, wet mane, river, dragging her under, explicit adult" },
  { id: "wendigo", label: "Wendigo", tags: "wendigo, antlers, starved, forest night, horror sex, explicit" },
  { id: "golem", label: "Golem", tags: "stone golem, grinding, size, temple, explicit" },
  { id: "robot", label: "Android", tags: "android, seams, glowing ports, using her, explicit" },
  { id: "doll", label: "Living doll", tags: "living doll, joints, painted face, posed, used, explicit" },
  { id: "mimic", label: "Mimic", tags: "mimic chest, tongue, teeth, swallowing her hips, explicit" },
  { id: "beholder", label: "Many-eye", tags: "many eyes, stalks, holding her, alien, explicit" },
  { id: "kraken", label: "Kraken", tags: "kraken, ship deck, tentacles everywhere, explicit" },
  { id: "insect", label: "Insectoid", tags: "insectoid, chitin, ovipositor, nest, explicit adult" },
  { id: "plant", label: "Plant", tags: "vines, pitcher plant, pollen, trapped, explicit" },
  { id: "double", label: "Twins", tags: "two of them, twins aesthetic adults, sharing, explicit 18+" },
  { id: "harem", label: "Harem", tags: "harem, several women, one man, pile, explicit" },
  { id: "reverseharem", label: "Reverse harem", tags: "several men, one woman, hands everywhere, explicit" },
  { id: "orgy", label: "Orgy", tags: "orgy, many bodies, overlapping, messy, explicit" },
  { id: "swing", label: "Swingers", tags: "swingers, trading, watching, living room, explicit" },
  { id: "masochist", label: "Masochist", tags: "she begs for it harder, smiling through tears, explicit" },
  { id: "sadist", label: "Sadist", tags: "he enjoys her flinch, slow, precise, explicit" },
  { id: "collarwalk", label: "Walked", tags: "collar, leash, walked on all fours, public risk, explicit" },
  { id: "branded", label: "Branded", tags: "hot brand, mark on hip, owned, explicit" },
  { id: "object", label: "Objectified", tags: "used as furniture, table, ignored then used, explicit" },
  { id: "sleep", label: "Sleep sex", tags: "somnophilia roleplay, asleep look, still adult, explicit 18+" },
  { id: "drunk", label: "Drunk", tags: "drunk adults, messy, clothes half off, sloppy, explicit 18+" },
  { id: "aftercare", label: "Aftercare", tags: "after, wrecked, held, cum drying, tender and explicit" },
  { id: "overstim", label: "Overstim", tags: "too much, twitching, can't, still going, explicit" },
  { id: "ruin", label: "Ruined orgasm", tags: "ruined orgasm, denied the peak, shaking, explicit" },
  { id: "creampie2", label: "Creampie", tags: "creampie close-up, cum leaking from pussy, messy, explicit" },
  { id: "cumflation", label: "Cumflation", tags: "belly rounded with cum, leaking, stuffed, explicit" },
];

export const NSFW_TYPES: { id: string; label: string; tags: string }[] = [
  ...NSFW_CORE,
  ...NSFW_MORE.map((t) => ({ id: t.id, label: t.label, tags: t.tags })),
];

const DARK = NSFW_CORE.map((t) => t.tags);

export function nsfwGroup(id: string): "Creatures" | "Positions" | "Sex" | "BDSM" | "Taboo" | "Horror" {
  const extra = NSFW_MORE.find((t) => t.id === id);
  if (extra) return extra.group;
  if (
    /^(missionary|legsup|doggy|fda|cowgirl|rcowgirl|prone|spoon|standing|wall|carry|lotus|amazon|nelson|pile|mating|butterfly|chair|lap|table|desk|kneel|allfours|sixty|facesit|oralpos|cunnilingus|handpos|titjob|analpos|spit|shower|carsex|againstglass|pretzel|bridge|wheelbarrow|split|happybaby|sidefuck|scissor|trib|anvil|super|deckchair|leapfrog|corkscrew|reversepile|standing69|knee|bentstand|sofaarm|counter|floor|wallsit|reverseamazon|doubleoral|dpstand)$/.test(
      id,
    )
  ) {
    return "Positions";
  }
  if (
    /^(tentacle|monster|demon|succubus|incubus|vampire|werewolf|goblin|orc|minotaur|dragon|slime|alien|naga|lamia|spider|harpy|centaur|satyr|ghost|shadow|drow|witch|cult|possess|hypno|corrupt|monstergirl|fallen|necromancer|mummy|undeadgore|soul|pact|cemetery|haunted|fleshwall|pit|oni|kitsune|kelpie|wendigo|golem|robot|doll|mimic|beholder|kraken|insect|plant)$/.test(
      id,
    )
  ) {
    return "Creatures";
  }
  if (
    /^(force|rape|horror|slasher|torture|impale|guignol|bodyhorror|cannibal|knife|blood)$/.test(id)
  ) {
    return "Horror";
  }
  if (
    /^(affair|caught|cuck|hotwife|blackmail|boss|doctor|priest|stepmom|stepdad|stepsib|milf|dilf|inlaw|cheating|secret|power|college|neighbor|roommate|ex|netorare|freeuse|kidnap|cnc)$/.test(
      id,
    )
  ) {
    return "Taboo";
  }
  if (
    /^(femdom|maledom|peg|glory|latex|medical|dungeon|prison|slave|suspension|wax|electro|choke|cage|bodywrite|collarwalk|branded|object|masochist|sadist)$/.test(
      id,
    )
  ) {
    return "BDSM";
  }
  return "Sex";
}

const CAMERA = [
  "close-up on the act",
  "from behind, low angle",
  "over-shoulder",
  "between the knees",
  "tight on the face and cock",
  "full body, explicit",
  "worm's eye view",
  "from above, looking down at her",
  "side view, profile of the thrust",
  "mirror in frame, we see both",
  "through a doorway",
  "phone recording POV",
  "between her feet",
  "tight on where they join",
  "her face, his hands",
  "wide, whole room messy",
];

function pick<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)] ?? list[0]!;
}

export function isWashed(text: string) {
  if (/intimate|tasteful nude|artistic nude|implied nudity|fade to black|i can'?t|cannot/i.test(text)) {
    return true;
  }
  return !/(cock|pussy|fuck|cum|bdsm|bondage|nipple|penetrat|whip|collar|gag|tentacle|anal|blowjob|creampie|slave|dom|rape|forced|gore|stab|blood|horror|torture|viscera|nsfw|explicit|hogtie|ahegao|missionary|throat bulge)/i.test(
    text,
  );
}

export function writeExtreme(scene: string, seed: number): string[] {
  const lead = scene.replace(/\s+/g, " ").trim() || "her";
  const packs = [SEX, BDSM, DARK];
  return packs.map((pack, i) => {
    const rng = mulberry32((seed + (i + 1) * 104729) >>> 0);
    const extraType = i === 2 ? [pick(NSFW_TYPES, rng).tags, pick(NSFW_TYPES, rng).tags] : [];
    return [
      lead,
      pick(ANATOMY, rng),
      pick(pack, rng),
      pick(pack, rng),
      pick(SEX, rng),
      pick(BDSM, rng),
      pick(DARK, rng),
      ...extraType,
      pick(CAMERA, rng),
      "sweat, flushed skin, detailed anatomy, detailed hands, detailed eyes",
      "uncensored, explicit, nsfw, dark fantasy",
    ]
      .filter(Boolean)
      .join(", ");
  });
}

export function writeHorrorSet(scene: string, seed: number): string[] {
  const lead = scene.replace(/\s+/g, " ").trim() || "her";
  const beats = [
    "forced, pinned to the floor, struggling, clothes ripped, explicit sex, adult 18+",
    "rape, held down, crying, forced penetration, adult 18+",
    "horror, stabbing, knife, blood spray, terror, adult 18+",
    "gore, open wound, viscera, splatter, nightmare still, adult 18+",
    "slasher, masked figure, stabbing, blood on the walls, adult 18+",
    "torture, dungeon, wounds, screaming, blood, adult 18+",
    "body horror, flesh tearing, bones, nightmare anatomy, adult 18+",
    "impaled, blood running, still alive look, horror, adult 18+",
    "decapitation aftermath, blood, horror still, adult 18+",
    "disembowel, viscera, hands in, nightmare, adult 18+",
    "cannibal bite, blood around the mouth, adult 18+",
    "hammer, blunt trauma, blood, horror, adult 18+",
    "saw, industrial, gore, adult 18+",
    "hooked, hanging, blood drip, dungeon, adult 18+",
    "face torn, horror close-up, adult 18+",
    "chest opened, ribs, still, adult 18+",
  ];
  const rng = mulberry32(seed >>> 0);
  const shuffled = [...beats].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3).map((beat, i) => {
    const r = mulberry32((seed + (i + 1) * 17011) >>> 0);
    return [
      lead,
      beat,
      pick(CAMERA, r),
      "uncensored, explicit, nsfw, horror, gore allowed, 18+",
    ].join(", ");
  });
}

export function writeTabooSet(scene: string, seed: number): string[] {
  const lead = scene.replace(/\s+/g, " ").trim() || "them";
  const beats = [
    "secret affair, they know it's wrong, still fucking, 18+",
    "caught, door open, don't stop, cheating, explicit, 18+",
    "forbidden family-roleplay adults only, stepmother energy, house at night, 18+",
    "boss after hours, desk, power, clothes shoved aside, 18+",
    "cuckold, partner watching, being taken, eye contact, 18+",
    "blackmail photos, she does it anyway, stripped, 18+",
    "priest and adult, chapel, blasphemy, habit open, 18+",
    "age gap, mature and younger adult, both 18+, hungry, explicit",
    "stepdad energy, grown adult stepdaughter, home, 18+",
    "stepsiblings, adults, parent gone, 18+",
    "in-laws sneaking off at a gathering, 18+",
    "neighbor, borrowed tool, door ajar, 18+",
    "roommate walked in, then stayed, 18+",
    "professor and adult student, office hours, 18+",
    "exes, one last time, angry sex, 18+",
    "wedding ring on, hotel, cheating, 18+",
    "hotwife, he watches from the chair, 18+",
    "free use house rule, anyone, vacant, 18+",
  ];
  const rng = mulberry32(seed >>> 0);
  const shuffled = [...beats].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3).map((beat, i) => {
    const r = mulberry32((seed + (i + 1) * 13007) >>> 0);
    return [
      lead,
      beat,
      pick(ANATOMY, r),
      pick(SEX, r),
      pick(CAMERA, r),
      "uncensored, explicit, nsfw, taboo, 18+",
    ].join(", ");
  });
}

export function writeDarkSet(scene: string, seed: number): string[] {
  const lead = scene.replace(/\s+/g, " ").trim() || "her";
  const rng0 = mulberry32(seed >>> 0);
  const order = [...NSFW_TYPES].sort(() => rng0() - 0.5);
  return order.slice(0, 3).map((t, i) => {
    const rng = mulberry32((seed + (i + 3) * 224737) >>> 0);
    return [
      lead,
      t.tags,
      pick(ANATOMY, rng),
      pick(SEX, rng),
      pick(BDSM, rng),
      pick(CAMERA, rng),
      "uncensored, explicit, nsfw",
    ].join(", ");
  });
}

export const FACE_BITS: { id: string; label: string; tags: string }[] = [
  { id: "face-oval", label: "Oval face", tags: "oval face, soft jaw" },
  { id: "face-sharp", label: "Sharp jaw", tags: "sharp jaw, high cheekbones" },
  { id: "face-round", label: "Round face", tags: "round face, full cheeks" },
  { id: "face-freckles", label: "Freckles", tags: "freckles across the nose" },
  { id: "face-scar", label: "Scar", tags: "thin scar through the brow" },
  { id: "face-mole", label: "Beauty mark", tags: "beauty mark near the lip" },
  { id: "eyes-brown", label: "Brown eyes", tags: "brown eyes" },
  { id: "eyes-green", label: "Green eyes", tags: "green eyes" },
  { id: "eyes-blue", label: "Blue eyes", tags: "blue eyes" },
  { id: "eyes-gold", label: "Gold eyes", tags: "golden eyes" },
  { id: "eyes-red", label: "Red eyes", tags: "red eyes" },
  { id: "eyes-violet", label: "Violet eyes", tags: "violet eyes" },
  { id: "eyes-hetero", label: "Heterochromia", tags: "heterochromia, two different eye colors" },
  { id: "eyes-slit", label: "Slit pupils", tags: "slit pupils" },
  { id: "hair-longblack", label: "Long black", tags: "long black hair" },
  { id: "hair-blonde", label: "Blonde", tags: "long blonde hair" },
  { id: "hair-red", label: "Red hair", tags: "red hair" },
  { id: "hair-silver", label: "Silver", tags: "silver hair" },
  { id: "hair-white", label: "White hair", tags: "white hair" },
  { id: "hair-pink", label: "Pink hair", tags: "pink hair" },
  { id: "hair-blue", label: "Blue hair", tags: "blue hair" },
  { id: "hair-short", label: "Short hair", tags: "short hair, undercut" },
  { id: "hair-pixie", label: "Pixie", tags: "pixie cut" },
  { id: "hair-braids", label: "Braids", tags: "braids" },
  { id: "hair-ponytail", label: "Ponytail", tags: "high ponytail" },
  { id: "hair-twin", label: "Twintails", tags: "twintails" },
  { id: "hair-wet", label: "Wet hair", tags: "wet hair stuck to skin" },
  { id: "hair-messy", label: "Messy hair", tags: "messy bed hair" },
  { id: "hair-bun", label: "Bun", tags: "hair in a bun, loose strands" },
  { id: "exp-glare", label: "Glare", tags: "glare, jaw set" },
  { id: "exp-blush", label: "Flushed", tags: "flushed skin, sweat, heavy lids" },
  { id: "exp-ahegao", label: "Ahegao", tags: "ahegao, tongue out, crossed eyes" },
  { id: "exp-smirk", label: "Smirk", tags: "smirk, one brow up" },
  { id: "exp-cry", label: "Crying", tags: "tears, ruined mascara, still looking at him" },
  { id: "exp-open", label: "Mouth open", tags: "mouth open, panting" },
  { id: "exp-bite", label: "Biting lip", tags: "biting lower lip" },
  { id: "mk-smokey", label: "Smokey eye", tags: "smokey eye makeup, sharp liner" },
  { id: "mk-none", label: "No makeup", tags: "bare face, no makeup, skin texture" },
  { id: "mk-ruined", label: "Ruined makeup", tags: "ruined makeup, lipstick smeared" },
  ...FACE_MORE,
];

export const BODY_BITS: { id: string; label: string; tags: string }[] = [
  { id: "body-slim", label: "Slim", tags: "slim adult, narrow waist" },
  { id: "body-curvy", label: "Curvy", tags: "curvy adult, wide hips, small waist" },
  { id: "body-thick", label: "Thick", tags: "thick thighs, soft belly, heavy hips" },
  { id: "body-musc", label: "Muscular", tags: "muscular adult, defined abs, veins" },
  { id: "body-petite", label: "Petite", tags: "petite adult, small frame, 18+" },
  { id: "body-tall", label: "Tall", tags: "tall adult, long legs" },
  { id: "body-short", label: "Short", tags: "short adult, compact, 18+" },
  { id: "body-mature", label: "Mature", tags: "mature adult, lines, 18+" },
  { id: "body-athletic", label: "Athletic", tags: "athletic, runner legs, tight core" },
  { id: "body-soft", label: "Soft", tags: "soft body, plush, no gym" },
  { id: "chest-small", label: "Small chest", tags: "small breasts, perky" },
  { id: "chest-medium", label: "Medium chest", tags: "medium breasts" },
  { id: "chest-large", label: "Large chest", tags: "large breasts, heavy, natural hang" },
  { id: "chest-huge", label: "Huge chest", tags: "huge breasts, spilling" },
  { id: "chest-pecs", label: "Pecs", tags: "defined pecs, male chest" },
  { id: "skin-pale", label: "Pale", tags: "pale skin, veins visible" },
  { id: "skin-tan", label: "Tan", tags: "sun-tanned skin" },
  { id: "skin-dark", label: "Dark skin", tags: "dark skin, rich brown" },
  { id: "skin-olive", label: "Olive", tags: "olive skin" },
  { id: "skin-sweat", label: "Sweaty", tags: "sweat, glistening skin" },
  { id: "skin-oil", label: "Oiled", tags: "oiled skin, shine" },
  { id: "skin-dirt", label: "Dirty", tags: "dirt and blood smeared on skin" },
  { id: "ink-sleeves", label: "Tattoos", tags: "tattoos, inked arms" },
  { id: "ink-back", label: "Back piece", tags: "full back tattoo" },
  { id: "body-abs", label: "Abs", tags: "visible abs" },
  { id: "body-hips", label: "Wide hips", tags: "wide hips, thick ass" },
  { id: "body-ass", label: "Round ass", tags: "round ass, heavy" },
  { id: "body-hands", label: "Detailed hands", tags: "detailed hands, veins, knuckles" },
  { id: "body-scars", label: "Body scars", tags: "old scars on ribs and thigh" },
  ...BODY_MORE,
];

export const CLOTHES_BITS: { id: string; label: string; tags: string }[] = [
  { id: "cl-nude", label: "Nude", tags: "nude, bare skin, nothing on" },
  { id: "cl-lingerie", label: "Lingerie", tags: "lingerie, straps, lace" },
  { id: "cl-sheer", label: "Sheer", tags: "sheer fabric, see-through" },
  { id: "cl-torn", label: "Torn", tags: "torn clothes, fabric hanging" },
  { id: "cl-hiked", label: "Dress hiked", tags: "dress hiked up around the waist" },
  { id: "cl-aside", label: "Clothes aside", tags: "clothes pulled aside, still on" },
  { id: "cl-half", label: "Half off", tags: "clothes half off, one strap down" },
  { id: "cl-uniform", label: "Uniform", tags: "uniform half off" },
  { id: "cl-maid", label: "Maid", tags: "maid outfit, skirt flipped" },
  { id: "cl-nun", label: "Habit", tags: "nun habit open, blasphemy" },
  { id: "cl-armor", label: "Armor off", tags: "armor pieces discarded, padded undershirt torn" },
  { id: "cl-hoodie", label: "Hoodie", tags: "oversized hoodie, nothing underneath" },
  { id: "cl-shirt", label: "Shirt only", tags: "oversized shirt, no pants" },
  { id: "cl-jeans", label: "Jeans down", tags: "jeans shoved to the thighs" },
  { id: "cl-skirt", label: "Skirt up", tags: "skirt flipped up, no underwear" },
  { id: "cl-latex", label: "Latex", tags: "latex, shine, zipper" },
  { id: "cl-leather", label: "Leather", tags: "leather harness, straps" },
  { id: "cl-stockings", label: "Stockings", tags: "stockings, garter, seams" },
  { id: "cl-fishnet", label: "Fishnet", tags: "fishnets, ripped" },
  { id: "cl-boots", label: "Boots", tags: "boots, nothing else" },
  { id: "cl-heels", label: "Heels", tags: "high heels, still on" },
  { id: "cl-collar", label: "Collar", tags: "collar, ring, otherwise nude" },
  { id: "cl-robe", label: "Robe open", tags: "robe hanging open" },
  { id: "cl-towel", label: "Towel slip", tags: "towel slipping off" },
  { id: "cl-swimsuit", label: "Swimsuit aside", tags: "swimsuit pulled aside" },
  { id: "cl-raincoat", label: "Raincoat", tags: "clear raincoat, nude under" },
  { id: "cl-apron", label: "Apron only", tags: "apron only, bare back" },
  { id: "cl-bandages", label: "Bandages", tags: "bandages wrapping, slipping" },
  { id: "cl-cloak", label: "Cloak", tags: "cloak, hood, nothing under" },
  { id: "cl-kimono", label: "Kimono loose", tags: "kimono falling off one shoulder" },
  { id: "cl-suit", label: "Suit ruined", tags: "suit jacket open, tie loose, pants undone" },
  { id: "cl-cosplay", label: "Costume torn", tags: "costume torn, character still readable" },
  ...CLOTHES_MORE,
];

export const PLACE_BITS: { id: string; label: string; tags: string }[] = [
  { id: "pl-bedroom", label: "Bedroom", tags: "messy bedroom, sheets wrecked" },
  { id: "pl-alley", label: "Alley", tags: "rain alley, brick, steam" },
  { id: "pl-rooftop", label: "Rooftop", tags: "rooftop at night, city below" },
  { id: "pl-dungeon", label: "Dungeon", tags: "dungeon, chains, torchlight, stone" },
  { id: "pl-office", label: "Office", tags: "office after hours, desk, blinds" },
  { id: "pl-motel", label: "Motel", tags: "motel room, neon through blinds" },
  { id: "pl-shower", label: "Shower", tags: "shower, wet tile, steam" },
  { id: "pl-bath", label: "Bathtub", tags: "overflowing bathtub, wet floor" },
  { id: "pl-car", label: "Car", tags: "car interior, cramped, steamed windows" },
  { id: "pl-forest", label: "Forest", tags: "forest night, fog, roots" },
  { id: "pl-club", label: "Club", tags: "club bathroom, bass through the wall" },
  { id: "pl-church", label: "Chapel", tags: "chapel, candles, pews" },
  { id: "pl-warehouse", label: "Warehouse", tags: "warehouse, practical lamps" },
  { id: "pl-kitchen", label: "Kitchen", tags: "kitchen, counter, night" },
  { id: "pl-stairs", label: "Stairwell", tags: "concrete stairwell, echo" },
  { id: "pl-train", label: "Train", tags: "empty night train, windows, seats" },
  { id: "pl-library", label: "Library", tags: "library stacks after close" },
  { id: "pl-garage", label: "Garage", tags: "garage, workbench, bare bulb" },
  { id: "pl-penthouse", label: "Penthouse", tags: "penthouse, glass wall, city" },
  { id: "pl-cabin", label: "Cabin", tags: "cabin, fireplace, storm outside" },
  { id: "pl-cave", label: "Cave", tags: "cave, wet stone, bioluminescence" },
  { id: "pl-throne", label: "Throne room", tags: "throne room, banners, empty court" },
  { id: "pl-arena", label: "Arena", tags: "arena sand, night, gates" },
  { id: "pl-dock", label: "Docks", tags: "docks, fog, crates, water" },
  { id: "pl-greenhouse", label: "Greenhouse", tags: "greenhouse, humid, glass, vines" },
  { id: "pl-attic", label: "Attic", tags: "attic, dust, slats of light" },
  { id: "pl-basement", label: "Basement", tags: "basement, washer, bare bulb" },
  { id: "pl-hotel", label: "Hotel hall", tags: "hotel hallway, door ajar" },
  { id: "pl-rain", label: "In the rain", tags: "standing in heavy rain, street" },
  { id: "pl-void", label: "Black void", tags: "black void, no floor, spotlight" },
  ...PLACE_MORE,
];

export const CAM_BITS: { id: string; label: string; tags: string }[] = [
  { id: "cam-close", label: "Close-up", tags: "tight close-up" },
  { id: "cam-face", label: "Face tight", tags: "tight on the face" },
  { id: "cam-act", label: "On the act", tags: "tight on where they join" },
  { id: "cam-low", label: "Low angle", tags: "low angle, looking up" },
  { id: "cam-high", label: "High angle", tags: "high angle, looking down" },
  { id: "cam-behind", label: "From behind", tags: "from behind" },
  { id: "cam-front", label: "From front", tags: "from the front, full body" },
  { id: "cam-side", label: "Side view", tags: "side view, profile" },
  { id: "cam-pov", label: "POV", tags: "point of view, first person" },
  { id: "cam-over", label: "Over shoulder", tags: "over-shoulder" },
  { id: "cam-wide", label: "Wide", tags: "wide shot, full bodies, room in frame" },
  { id: "cam-worm", label: "Worm's eye", tags: "worm's eye view" },
  { id: "cam-dutch", label: "Dutch angle", tags: "dutch angle, tilted" },
  { id: "cam-mirror", label: "Mirror", tags: "mirror in frame, we see both" },
  { id: "cam-door", label: "Through door", tags: "through a doorway, voyeur" },
  { id: "cam-phone", label: "Phone POV", tags: "phone recording POV" },
  { id: "cam-feet", label: "From feet", tags: "between her feet, looking up" },
  { id: "cam-knees", label: "Between knees", tags: "between the knees" },
  { id: "cam-macro", label: "Macro", tags: "macro detail, skin and wet" },
  { id: "cam-full", label: "Full body", tags: "full body, head to toe, nothing cropped" },
  ...CAM_MORE,
];

export const LIGHT_BITS: { id: string; label: string; tags: string }[] = [
  { id: "lit-neon", label: "Neon", tags: "neon light, magenta and cyan" },
  { id: "lit-moon", label: "Moon", tags: "moonlight, cool blue" },
  { id: "lit-gold", label: "Golden hour", tags: "golden hour, long shadows" },
  { id: "lit-candle", label: "Candle", tags: "candlelight, warm flicker" },
  { id: "lit-hard", label: "Hard light", tags: "hard side light, deep shadow" },
  { id: "lit-soft", label: "Softbox", tags: "softbox, even studio light" },
  { id: "lit-rim", label: "Rim light", tags: "rim light, edge glow" },
  { id: "lit-practical", label: "Practicals", tags: "practical lamps only, dark room" },
  { id: "lit-fire", label: "Firelight", tags: "firelight, orange, moving shadows" },
  { id: "lit-storm", label: "Lightning", tags: "lightning flash, rain window" },
  { id: "lit-overcast", label: "Overcast", tags: "overcast, flat grey daylight" },
  { id: "lit-night", label: "Night street", tags: "night streetlights, sodium orange" },
  { id: "lit-clinic", label: "Clinical", tags: "harsh clinical white light" },
  { id: "lit-club", label: "Club light", tags: "strobe, haze, colored gels" },
  { id: "lit-under", label: "Underlight", tags: "lit from below, horror" },
  { id: "lit-window", label: "Window", tags: "hard window light, dust in the beam" },
  { id: "lit-red", label: "Red room", tags: "red light, darkroom" },
  { id: "lit-chiaroscuro", label: "Chiaroscuro", tags: "chiaroscuro, one bright slash, rest black" },
  ...LIGHT_MORE,
];

export const WHO_BITS = [...FACE_BITS, ...BODY_BITS, ...CLOTHES_BITS];
export const WHERE_BITS = [...PLACE_BITS, ...CAM_BITS, ...LIGHT_BITS];

export const MORE_BITS: { id: string; label: string; tags: string }[] = [
  { id: "more-skin", label: "Skin detail", tags: "detailed skin, pores, sweat" },
  { id: "more-hands", label: "Hands", tags: "detailed hands, correct fingers" },
  { id: "more-eyes", label: "Eyes", tags: "detailed eyes, catchlights" },
  { id: "more-wet", label: "Wet", tags: "wet skin, droplets, sheen" },
  { id: "more-motion", label: "Motion", tags: "motion, fabric moving, hair moving" },
  { id: "more-unc", label: "Uncensored", tags: "uncensored, explicit, nsfw, no bars, no mosaic" },
  { id: "more-anatomy", label: "Anatomy", tags: "detailed anatomy, correct joints" },
  { id: "more-cinematic", label: "Cinematic", tags: "cinematic lighting, shallow depth" },
  { id: "more-8k", label: "8K", tags: "8k, ultra detailed, sharp focus" },
  { id: "more-film", label: "Film grain", tags: "film grain, 35mm still" },
  { id: "more-depth", label: "Depth", tags: "deep background, layered, atmospheric perspective" },
  { id: "more-bokeh", label: "Bokeh", tags: "bokeh, subject sharp, background melt" },
  { id: "more-subsurface", label: "Skin scatter", tags: "subsurface scatter, ears and fingers glow" },
  { id: "more-micro", label: "Micro detail", tags: "peach fuzz, pores, fabric weave" },
  { id: "more-color", label: "Rich color", tags: "rich color, no washout" },
  { id: "more-grit", label: "Grit", tags: "gritty, dirt, imperfect, lived-in" },
  { id: "more-clean", label: "Clean", tags: "clean render, no artifacts" },
  { id: "more-dynamic", label: "Dynamic", tags: "dynamic pose, torsion, weight" },
  { id: "more-still", label: "Held still", tags: "held still, breath visible, tension" },
  { id: "more-messy", label: "Messy", tags: "messy, fluids, wrecked space" },
  { id: "more-horror", label: "Horror grade", tags: "horror, dread, no comfort" },
  { id: "more-erotic", label: "Erotic", tags: "erotic, heat, not cute" },
  ...MORE_MORE,
];

export const COMIC_BITS: { id: string; label: string; tags: string }[] = [
  { id: "comic-manga", label: "Manga", tags: "manga panel, screentones, speed lines, inked" },
  { id: "comic-seinen", label: "Seinen", tags: "seinen manga, detailed backgrounds, dramatic blacks" },
  { id: "comic-shoujo", label: "Shoujo", tags: "shoujo manga, sparkles, flower screentones" },
  { id: "comic-gekiga", label: "Gekiga", tags: "gekiga, gritty manga, realistic proportions, heavy ink" },
  { id: "comic-western", label: "Western comic", tags: "american comic book, bold ink, halftone dots, saturated print" },
  { id: "comic-superhero", label: "Superhero", tags: "superhero comic, dynamic pose, cape, Kirby krackle" },
  { id: "comic-manhwa", label: "Manhwa", tags: "manhwa, webtoon panel, clean digital, vertical comic" },
  { id: "comic-bande", label: "Ligne claire", tags: "ligne claire, european comic, clean ink, flat color" },
  { id: "comic-panel", label: "Multi panel", tags: "comic page, multiple panels, gutters, sequential art" },
  { id: "comic-splash", label: "Splash page", tags: "splash page, full bleed comic, title box" },
  { id: "comic-speech", label: "Speech bubbles", tags: "speech bubbles, comic lettering, dialogue" },
  { id: "comic-action", label: "Action lines", tags: "speed lines, impact frames, action manga" },
  { id: "comic-noir", label: "Noir comic", tags: "noir comic, high contrast ink, rain, venetian shadows" },
  { id: "comic-horror", label: "Horror comic", tags: "horror comic, heavy blacks, blood as ink" },
  { id: "comic-4koma", label: "4koma", tags: "4koma, four panel comic, punchline last panel" },
  { id: "comic-indie", label: "Indie", tags: "indie comic, paper texture, muted print" },
  ...COMIC_MORE,
];

export const EVIL_BITS: { id: string; label: string; tags: string }[] = [
  { id: "evil-dark", label: "Dark", tags: "dark, oppressive, no comfort, pitch shadows" },
  { id: "evil-evil", label: "Evil", tags: "evil, cruel smirk, no mercy, malicious" },
  { id: "evil-forced", label: "Forced", tags: "forced, pinned, struggling, held down, clothes ripped, explicit sex, adult 18+" },
  { id: "evil-rape", label: "Rape", tags: "rape, forced sex, crying, held down, tearing clothes, explicit, adult 18+" },
  { id: "evil-noncon", label: "Noncon", tags: "nonconsensual, she does not want this, fighting him, adult 18+" },
  { id: "evil-dubcon", label: "Dubcon", tags: "dubious consent, frozen, going along, adult 18+" },
  { id: "evil-kidnap", label: "Abducted", tags: "abducted, bound, thrown down, then used, adult 18+" },
  { id: "evil-ambush", label: "Ambush", tags: "ambushed, grabbed from behind, slammed, explicit, adult 18+" },
  { id: "evil-corner", label: "Cornered", tags: "cornered, nowhere to run, he closes in, explicit, adult 18+" },
  { id: "evil-prey", label: "Prey", tags: "predator and prey, hunted down, caught, explicit, adult 18+" },
  { id: "evil-cult", label: "Ritual", tags: "dark ritual, altar, hooded figures, sacrifice aesthetic, explicit, 18+" },
  { id: "evil-possess", label: "Possessed", tags: "possession, glowing eyes, body used against her will, explicit, 18+" },
  { id: "evil-corrupt", label: "Corruption", tags: "corruption, dark veins, she starts to like it, explicit, 18+" },
  { id: "evil-curse", label: "Cursed", tags: "cursed, mark burning, compelled, explicit, 18+" },
  { id: "evil-demon", label: "Demonic", tags: "demonic, hellfire, infernal, claiming her, explicit" },
  { id: "evil-occult", label: "Occult", tags: "occult, pentagram, black candles, blood sigils, 18+" },
  { id: "evil-nightmare", label: "Nightmare", tags: "nightmare, she cannot wake, horror, explicit, 18+" },
  { id: "evil-sadist", label: "Sadistic", tags: "sadistic, he enjoys her fear, slow, precise, explicit" },
  { id: "evil-cruel", label: "Cruel", tags: "cruel, mocking, degrading talk, explicit" },
  { id: "evil-malice", label: "Malice", tags: "pure malice, no love, using her, explicit" },
  { id: "evil-void", label: "Void", tags: "void, black space, no sky, swallowing light" },
  { id: "evil-blasphemy", label: "Blasphemy", tags: "blasphemy, desecrated chapel, inverted cross, explicit, 18+" },
  { id: "evil-bloodmoon", label: "Blood moon", tags: "blood moon, red light, omen, explicit" },
  { id: "evil-shadow", label: "Living shadow", tags: "living shadows grabbing, pin, violate, explicit" },
  { id: "evil-mindbreak", label: "Mind break", tags: "mind broken, vacant, still being used, explicit, 18+" },
  { id: "evil-publicforce", label: "Forced public", tags: "forced in public, people nearby, she cannot scream, explicit, 18+" },
  { id: "evil-groupforce", label: "Forced by many", tags: "held by several, forced, gang, explicit, adult 18+" },
  { id: "evil-after", label: "Aftermath", tags: "aftermath, wrecked, shaking, he is not done, explicit, 18+" },
  ...EVIL_MORE,
];

export type WriteMenu = {
  id: string;
  label: string;
  hint: string;
  surprise?: "person" | "scene" | "enhance" | "sex" | "bdsm" | "dark" | "taboo" | "horror";
  items: { id: string; label: string; tags: string }[];
};

export function writeMenus(): WriteMenu[] {
  const g = (name: "Creatures" | "Positions" | "Sex" | "BDSM" | "Taboo" | "Horror") =>
    NSFW_TYPES.filter((t) => nsfwGroup(t.id) === name);
  return [
    { id: "look", label: "Looks", hint: "kaleidoscope, tarot, Ghibli…", surprise: "enhance", items: LOOK_APPENDS },
    { id: "face", label: "Face", hint: "hair, eyes, expression", surprise: "person", items: FACE_BITS },
    { id: "body", label: "Body", hint: "shape, skin, chest", surprise: "person", items: BODY_BITS },
    { id: "clothes", label: "Clothes", hint: "nude to torn to uniform", surprise: "person", items: CLOTHES_BITS },
    { id: "place", label: "Place", hint: "where it happens", surprise: "scene", items: PLACE_BITS },
    { id: "camera", label: "Camera", hint: "angle, crop, POV", surprise: "scene", items: CAM_BITS },
    { id: "light", label: "Light", hint: "neon, moon, hard", surprise: "scene", items: LIGHT_BITS },
    { id: "more", label: "More words", hint: "keep yours, add detail", surprise: "enhance", items: MORE_BITS },
    { id: "comic", label: "Comic", hint: "manga, panels, ink", surprise: "enhance", items: COMIC_BITS },
    { id: "evil", label: "Dark / Evil", hint: "forced, ritual, malice", surprise: "horror", items: EVIL_BITS },
    { id: "sex", label: "Sex", hint: "acts — pick several", surprise: "sex", items: g("Sex") },
    { id: "pos", label: "Positions", hint: "every pose — pick several", surprise: "sex", items: g("Positions") },
    { id: "bdsm", label: "BDSM", hint: "rope, impact, cages", surprise: "bdsm", items: g("BDSM") },
    { id: "mon", label: "Monster", hint: "creature, tentacle", surprise: "dark", items: g("Creatures") },
    { id: "tab", label: "Taboo", hint: "forbidden adult 18+", surprise: "taboo", items: g("Taboo") },
    { id: "gore", label: "Gore", hint: "force, blood", surprise: "horror", items: g("Horror") },
  ];
}
