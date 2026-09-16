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
  if (/\b(fuck|sex|moan|cock|pussy|orgasm|nsfw|rape|thrust|creampie|blowjob|anal)\b/.test(p)) sfx = "sex";
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
    if (girl) lines.push({ voice: "female", text: pick(["don't stop", "yes like that", "ahhh", "harder"]) });
    if (dude) lines.push({ voice: "male", text: pick(["yeah", "take it", "fuck", "stay there"]) });
  } else if (sfx === "horror") {
    if (girl) lines.push({ voice: "female", text: pick(["no", "get away", "help"]) });
    else if (dude) lines.push({ voice: "male", text: pick(["no", "run", "stay back"]) });
  } else if (girl && dude) {
    lines.push({ voice: "female", text: pick(["hey", "wait", "over here"]) });
    lines.push({ voice: "male", text: pick(["yeah", "come on", "right here"]) });
  } else if (girl) {
    lines.push({ voice: "female", text: pick(["mm", "okay", "here"]) });
  } else if (dude) {
    lines.push({ voice: "male", text: pick(["yeah", "alright", "here"]) });
  }
  return { lines, sfx, extra };
}

export function ensureVoice(
  plan: { lines: VoiceLine[]; sfx: SfxKind; extra?: SfxKind[] },
  prompt: string,
): { lines: VoiceLine[]; sfx: SfxKind; extra: SfxKind[] } {
  const extra = plan.extra ?? [];
  if (plan.lines.length) return { ...plan, extra };
  const girl = /\b(girl|woman|she|her|female|lady|wife|queen)\b/i.test(prompt || "");
  const snippet =
    (prompt || "")
      .replace(/same face.*$/i, "")
      .replace(/[^\w\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 6)
      .join(" ") || "yeah";
  return {
    ...plan,
    extra,
    lines: [{ voice: girl ? "female" : "male", text: snippet.slice(0, 60) }],
  };
}

function bedOne(sfx: SfxKind, tag: string): string {
  switch (sfx) {
    case "rain":
      return `anoisesrc=d=90:c=pink:a=0.32,highpass=f=900,volume=1.5[${tag}]`;
    case "water":
      return `anoisesrc=d=90:c=white:a=0.2,bandpass=f=700:width_type=h:w=500,volume=1.4[${tag}]`;
    case "fight":
      return `anoisesrc=d=90:c=brown:a=0.24[n];sine=frequency=70:duration=90,volume=0.14[d];[n][d]amix=inputs=2:duration=first,volume=1.4[${tag}]`;
    case "sex":
      return `sine=frequency=90:duration=90,volume=0.11[a];anoisesrc=d=90:c=pink:a=0.1,lowpass=f=500[b];sine=frequency=2.2:duration=90,volume=0.08[p];[a][b][p]amix=inputs=3:duration=first,volume=1.5[${tag}]`;
    case "wind":
      return `anoisesrc=d=90:c=brown:a=0.26,lowpass=f=450,volume=1.4[${tag}]`;
    case "horror":
      return `sine=frequency=55:duration=90,volume=0.2[a];sine=frequency=58:duration=90,volume=0.14[b];[a][b]amix=inputs=2:duration=first,volume=1.5[${tag}]`;
    case "city":
      return `anoisesrc=d=90:c=white:a=0.14,lowpass=f=1800,volume=1.5[${tag}]`;
    case "fire":
      return `anoisesrc=d=90:c=pink:a=0.2,bandpass=f=1200:width_type=h:w=800,volume=1.3[${tag}]`;
    case "crowd":
      return `anoisesrc=d=90:c=white:a=0.1,lowpass=f=900,volume=1.2[${tag}]`;
    default:
      return `anoisesrc=d=90:c=pink:a=0.18,lowpass=f=800,volume=1.7[n];sine=frequency=180:duration=90,volume=0.05[t];[n][t]amix=inputs=2:duration=first[${tag}]`;
  }
}

/** ffmpeg -filter_complex fragment that ends with [bed] */
export function ffmpegBed(sfx: SfxKind | SfxKind[]): string {
  const kinds = [...new Set((Array.isArray(sfx) ? sfx : [sfx]).filter(Boolean))].slice(0, 3) as SfxKind[];
  if (kinds.length <= 1) return bedOne(kinds[0] || "room", "bed");
  const parts = kinds.map((k, i) => bedOne(k, `b${i}`));
  const labels = kinds.map((_, i) => `[b${i}]`).join("");
  return `${parts.join(";")};${labels}amix=inputs=${kinds.length}:duration=first:normalize=0,volume=1.25[bed]`;
}

export function espeakVoice(voice: VoiceLine["voice"]): { v: string; s: string; p: string } {
  return voice === "female" ? { v: "en+f3", s: "118", p: "52" } : { v: "en+m3", s: "122", p: "18" };
}