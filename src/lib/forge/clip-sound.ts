export type VoiceLine = { voice: "female" | "male"; text: string };
export type SfxKind = "rain" | "fight" | "sex" | "wind" | "horror" | "city" | "room" | "water";

export function designClipAudio(prompt: string): { lines: VoiceLine[]; sfx: SfxKind } {
  const p = (prompt || "").toLowerCase();
  const girl = /\b(girl|woman|she|her|female|lady|wife|queen)\b/.test(p);
  const dude = /\b(guy|man|he|him|male|dude|king|husband|warrior)\b/.test(p);
  let sfx: SfxKind = "room";
  if (/\b(rain|storm|thunder|downpour)\b/.test(p)) sfx = "rain";
  else if (/\b(ocean|sea|wave|river|rain)\b/.test(p)) sfx = "water";
  else if (/\b(fight|punch|kick|clash|sword|battle|war)\b/.test(p)) sfx = "fight";
  else if (/\b(fuck|sex|moan|cock|pussy|orgasm|nsfw|rape|thrust)\b/.test(p)) sfx = "sex";
  else if (/\b(wind|storm|canyon|cliff)\b/.test(p)) sfx = "wind";
  else if (/\b(horror|blood|scream|monster|gore|dark)\b/.test(p)) sfx = "horror";
  else if (/\b(city|street|neon|traffic|alley)\b/.test(p)) sfx = "city";

  const lines: VoiceLine[] = [];
  if (sfx === "fight" && girl && dude) {
    lines.push({ voice: "female", text: "look out" });
    lines.push({ voice: "male", text: "come on" });
  } else if (sfx === "sex") {
    if (girl) lines.push({ voice: "female", text: "ah" });
    if (dude) lines.push({ voice: "male", text: "yeah" });
  } else if (sfx === "horror") {
    if (girl) lines.push({ voice: "female", text: "no" });
    else if (dude) lines.push({ voice: "male", text: "no" });
  } else if (girl && dude) {
    lines.push({ voice: "female", text: "hey" });
    lines.push({ voice: "male", text: "yeah" });
  }
  return { lines, sfx };
}

export function ensureVoice(
  plan: { lines: VoiceLine[]; sfx: SfxKind },
  prompt: string,
): { lines: VoiceLine[]; sfx: SfxKind } {
  if (plan.lines.length) return plan;
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
    lines: [{ voice: girl ? "female" : "male", text: snippet.slice(0, 60) }],
  };
}

/** ffmpeg -filter_complex fragment that ends with [bed] */
export function ffmpegBed(sfx: SfxKind): string {
  switch (sfx) {
    case "rain":
      return "anoisesrc=d=60:c=pink:a=0.28,highpass=f=900,volume=1.4[bed]";
    case "water":
      return "anoisesrc=d=60:c=white:a=0.18,bandpass=f=700:width_type=h:w=500,volume=1.3[bed]";
    case "fight":
      return "anoisesrc=d=60:c=brown:a=0.22[n];sine=frequency=70:duration=60,volume=0.12[d];[n][d]amix=inputs=2:duration=first,volume=1.3[bed]";
    case "sex":
      return "sine=frequency=90:duration=60,volume=0.09[a];anoisesrc=d=60:c=pink:a=0.08,lowpass=f=500[b];[a][b]amix=inputs=2:duration=first,volume=1.4[bed]";
    case "wind":
      return "anoisesrc=d=60:c=brown:a=0.24,lowpass=f=450,volume=1.3[bed]";
    case "horror":
      return "sine=frequency=55:duration=60,volume=0.18[a];sine=frequency=58:duration=60,volume=0.12[b];[a][b]amix=inputs=2:duration=first,volume=1.4[bed]";
    case "city":
      return "anoisesrc=d=60:c=white:a=0.12,lowpass=f=1800,volume=1.4[bed]";
    default:
      return "anoisesrc=d=60:c=pink:a=0.16,lowpass=f=800,volume=1.6[n];sine=frequency=180:duration=60,volume=0.05[t];[n][t]amix=inputs=2:duration=first[bed]";
  }
}

export function espeakVoice(voice: VoiceLine["voice"]): { v: string; s: string; p: string } {
  return voice === "female" ? { v: "en+f3", s: "118", p: "52" } : { v: "en+m3", s: "122", p: "18" };
}
