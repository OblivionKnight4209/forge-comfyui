export type VoiceLine = { voice: "female" | "male"; text: string };
export type SfxKind = "rain" | "fight" | "sex" | "wind" | "horror" | "city" | "room" | "water" | "fire" | "crowd";

function pick<T>(arr: T[], i = 0): T {
  return arr[Math.abs(i) % arr.length]!;
}

/** Turn the prompt into something a person would actually say, not "mm". */
export function speakableFromPrompt(prompt: string): string {
  const raw = (prompt || "").replace(/\{[^{}]*\}/g, " ").replace(/\s+/g, " ").trim();
  const quoted = [...raw.matchAll(/["\u201c']([^"\u201d']{3,90})["\u201d']/g)].map((m) => m[1]!.trim());
  if (quoted[0]) return quoted[0]!;
  const clause = (raw.split(/[.|]/)[0] || raw).trim();
  const words = clause
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(lora|uncensored|nsfw|score_\d)$/i.test(w));
  const line = words.slice(0, 18).join(" ").trim();
  return line || "Look at this.";
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

  const quoted = [...(prompt || "").matchAll(/["\u201c']([^"\u201d']{3,72})["\u201d']/g)].map((m) => m[1]!.trim());
  const lines: VoiceLine[] = [];
  if (quoted.length) {
    quoted.slice(0, 2).forEach((t, i) => {
      lines.push({ voice: i === 0 && girl ? "female" : dude && i === 1 ? "male" : girl ? "female" : "male", text: t });
    });
    return { lines, sfx, extra };
  }
  const caption = speakableFromPrompt(prompt);
  if (sfx === "fight") {
    if (girl) lines.push({ voice: "female", text: pick(["Look out!", "Get back!", "Move!"]) });
    if (dude) lines.push({ voice: "male", text: pick(["Stay down!", "Come on!", "Now!"]) });
    if (!lines.length) lines.push({ voice: "male", text: caption });
  } else if (sfx === "horror") {
    lines.push({ voice: girl ? "female" : "male", text: pick(["Get away from me!", "No — stay back!", "Run!"]) });
  } else if (girl && dude) {
    lines.push({ voice: "female", text: caption });
  } else {
    lines.push({ voice: girl ? "female" : "male", text: caption });
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
  return {
    ...plan,
    extra,
    lines: [{ voice: girl ? "female" : "male", text: speakableFromPrompt(prompt) }],
  };
}

function bedOne(sfx: SfxKind, tag: string): string {
  switch (sfx) {
    case "rain":
      return `anoisesrc=d=90:c=pink:a=0.22,highpass=f=900,volume=1.1[${tag}]`;
    case "water":
      return `anoisesrc=d=90:c=white:a=0.14,bandpass=f=700:width_type=h:w=500,volume=1.1[${tag}]`;
    case "fight":
      return `anoisesrc=d=90:c=brown:a=0.18[n];sine=frequency=70:duration=90,volume=0.1[d];[n][d]amix=inputs=2:duration=first,volume=1.1[${tag}]`;
    case "sex":
      return `sine=frequency=90:duration=90,volume=0.06[a];anoisesrc=d=90:c=pink:a=0.06,lowpass=f=500[b];[a][b]amix=inputs=2:duration=first,volume=1.1[${tag}]`;
    case "wind":
      return `anoisesrc=d=90:c=brown:a=0.16,lowpass=f=450,volume=0.9[${tag}]`;
    case "horror":
      return `sine=frequency=55:duration=90,volume=0.12[a];sine=frequency=58:duration=90,volume=0.08[b];[a][b]amix=inputs=2:duration=first,volume=1.1[${tag}]`;
    case "city":
      return `anoisesrc=d=90:c=white:a=0.1,lowpass=f=1800,volume=1.1[${tag}]`;
    case "fire":
      return `anoisesrc=d=90:c=pink:a=0.14,bandpass=f=1200:width_type=h:w=800,volume=1.0[${tag}]`;
    case "crowd":
      return `anoisesrc=d=90:c=white:a=0.08,lowpass=f=900,volume=0.9[${tag}]`;
    default:
      return `anoisesrc=d=90:c=pink:a=0.08,lowpass=f=700,volume=0.7[${tag}]`;
  }
}

export function ffmpegBed(sfx: SfxKind | SfxKind[]): string {
  const kinds = [...new Set((Array.isArray(sfx) ? sfx : [sfx]).filter(Boolean))].slice(0, 3) as SfxKind[];
  if (kinds.length <= 1) return bedOne(kinds[0] || "room", "bed");
  const parts = kinds.map((k, i) => bedOne(k, `b${i}`));
  const labels = kinds.map((_, i) => `[b${i}]`).join("");
  return `${parts.join(";")};${labels}amix=inputs=${kinds.length}:duration=first:normalize=0,volume=0.9[bed]`;
}

export function espeakVoice(voice: VoiceLine["voice"]): { v: string; s: string; p: string } {
  return voice === "female" ? { v: "en-us+f4", s: "95", p: "58" } : { v: "en-us+m3", s: "98", p: "22" };
}

export function piperModelHint(voice: VoiceLine["voice"]): RegExp {
  return voice === "female"
    ? /amy|lessac|kristin|kathleen|jenny|ljspeech|hfc_female|libritts/i
    : /ryan|joe|alan|danny|john|northern_english_male|hfc_male/i;
}
