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

/** Quiet scenes still get one spoken line so the clip is not just "mm" / wind. */
export function ensureVoice(
  audio: { lines: VoiceLine[]; sfx: SfxKind; extra: SfxKind[] },
  prompt: string,
): { lines: VoiceLine[]; sfx: SfxKind; extra: SfxKind[] } {
  if (audio.lines.length) return audio;
  const p = (prompt || "").toLowerCase();
  const text = /\blamp\b/.test(p)
    ? "the lamp"
    : /\bquiet\b/.test(p)
      ? "it's quiet"
      : /\broom\b/.test(p)
        ? "this room"
        : "right here";
  return { ...audio, lines: [{ voice: "female", text }] };
}

export function espeakVoice(voice: VoiceLine["voice"]): { v: string; s: string; p: string } {
  if (voice === "female") return { v: "en-us+f3", s: "155", p: "48" };
  return { v: "en-us+m3", s: "140", p: "28" };
}

/** Offline ffmpeg filter that builds a [bed] bus from scene tags. */
export function ffmpegBed(kinds: SfxKind[]): string {
  const set = new Set(kinds.filter(Boolean));
  const parts: string[] = ["anullsrc=r=44100:cl=stereo,atrim=0:8,volume=0.001[base]"];
  const labels = ["[base]"];
  let i = 0;
  const add = (expr: string) => {
    const lab = `s${i++}`;
    parts.push(`${expr}[${lab}]`);
    labels.push(`[${lab}]`);
  };
  if (set.has("rain") || set.has("water")) add("anoisesrc=r=44100:c=pink:a=0.18,atrim=0:8,highpass=f=400,volume=0.35");
  if (set.has("wind")) add("anoisesrc=r=44100:c=brown:a=0.2,atrim=0:8,lowpass=f=500,volume=0.28");
  if (set.has("fight")) add("anoisesrc=r=44100:c=white:a=0.12,atrim=0:8,volume=0.12");
  if (set.has("sex")) add("sine=f=90:d=8,volume=0.08");
  if (set.has("horror")) add("sine=f=55:d=8,volume=0.1");
  if (set.has("city") || set.has("crowd")) add("anoisesrc=r=44100:c=white:a=0.08,atrim=0:8,lowpass=f=800,volume=0.16");
  if (set.has("fire")) add("anoisesrc=r=44100:c=brown:a=0.1,atrim=0:8,highpass=f=200,volume=0.16");
  if (set.has("room") && labels.length === 1) add("anoisesrc=r=44100:c=brown:a=0.05,atrim=0:8,lowpass=f=250,volume=0.08");
  const n = labels.length;
  if (n === 1) return `${parts[0]};[base]anull[bed]`;
  return `${parts.join(";")};${labels.join("")}amix=inputs=${n}:duration=first:normalize=0[bed]`;
}
