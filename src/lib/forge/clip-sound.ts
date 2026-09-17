export type VoiceLine = { voice: "female" | "male"; text: string };
export type SfxKind = "rain" | "fight" | "sex" | "wind" | "horror" | "city" | "room" | "water" | "fire" | "crowd";

function pick<T>(arr: T[], i = 0): T {
  return arr[Math.abs(i) % arr.length]!;
}

/** Scene-matched SFX + spoken lines from the prompt. Offline. Not a cloud lip-sync model. */
export function designClipAudio(prompt: string): { lines: VoiceLine[]; sfx: SfxKind; extra: SfxKind[] } {
  const p = (prompt || "").toLowerCase();
  const girl = /\b(girl|woman|she|her|female|lady|wife|queen|maid|heroine)\b/.test(p);
  const dude = /\b(guy|man|he|him|male|dude|king|husband|warrior|goblin|orc)\b/.test(p);
  const extra: SfxKind[] = [];
  let sfx: SfxKind = "room";
  if (/\b(fuck|sex|moan|cock|pussy|orgasm|nsfw|rape|thrust|creampie|blowjob|anal|uncensored|explicit|nude|naked|hot anime)\b/.test(p)) sfx = "sex";
  else if (/\b(fight|punch|kick|clash|sword|battle|war|slash)\b/.test(p)) sfx = "fight";
  else if (/\b(horror|blood|scream|monster|gore|stab)\b/.test(p)) sfx = "horror";
  else if (/\b(rain|storm|thunder|downpour)\b/.test(p)) sfx = "rain";
  else if (/\b(ocean|sea|wave|river|water|wet)\b/.test(p)) sfx = "water";
  else if (/\b(wind|canyon|cliff)\b/.test(p)) sfx = "wind";
  else if (/\b(city|street|neon|traffic|alley)\b/.test(p)) sfx = "city";
  else if (/\b(fire|burn|flame|torch)\b/.test(p)) sfx = "fire";
  if (/\b(rain|storm|thunder)\b/.test(p) && sfx !== "rain") extra.push("rain");
  if (/\b(city|street|alley|crowd)\b/.test(p) && sfx !== "city") extra.push("city");
  if (/\b(fire|torch|burn)\b/.test(p) && sfx !== "fire") extra.push("fire");

  const quoted = [...(prompt || "").matchAll(/["“']([^"”']{3,72})["”']/g)].map((m) => m[1]!.trim());
  const lines: VoiceLine[] = [];
  if (quoted.length) {
    quoted.slice(0, 2).forEach((t, i) => {
      lines.push({ voice: i === 0 && girl ? "female" : dude && i === 1 ? "male" : girl ? "female" : "male", text: t });
    });
    return { lines, sfx, extra };
  }
  if (sfx === "fight") {
    if (girl) lines.push({ voice: "female", text: pick(["look out", "get off me", "move"]) });
    if (dude) lines.push({ voice: "male", text: pick(["come on", "stay down", "now"]) });
  } else if (sfx === "sex") {
    if (girl) lines.push({ voice: "female", text: pick(["don't stop", "yes like that", "ah, harder", "right there"]) });
    if (dude) lines.push({ voice: "male", text: pick(["yeah", "take it", "don't move", "stay there"]) });
    if (!girl && !dude) lines.push({ voice: "female", text: pick(["don't stop", "yes like that"]) });
  } else if (sfx === "horror") {
    if (girl) lines.push({ voice: "female", text: pick(["no, get away", "help me", "stay back"]) });
    else if (dude) lines.push({ voice: "male", text: pick(["run", "stay back", "no"]) });
  } else if (girl && dude) {
    lines.push({ voice: "female", text: pick(["hey, wait", "over here", "look at me"]) });
    lines.push({ voice: "male", text: pick(["come on", "right here", "I see you"]) });
  } else if (girl) {
    lines.push({ voice: "female", text: pick(["look at me", "over here", "wait"]) });
  } else if (dude) {
    lines.push({ voice: "male", text: pick(["come on", "right here", "look"]) });
  }
  return { lines, sfx, extra };
}
