export const BRAIN_MODELS = [
  "huihui_ai/qwen2.5-abliterate:7b",
  "dolphin3:8b",
  "dolphin-phi",
];

export function pickBrainModel(names: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  for (const want of BRAIN_MODELS) {
    const hit = names.find((_, i) => lower[i] === want || lower[i]?.includes(want.split(":")[0]!));
    if (hit) return hit;
  }
  return names.find((n) => /abliterat|dolphin|uncen/i.test(n)) || names[0] || "";
}

export function brainSystem(opts: { wrap?: string; checkpoint?: string; nsfwMode?: boolean }) {
  const wrap = opts.wrap && opts.wrap !== "none" ? opts.wrap : "";
  const ckpt = opts.checkpoint ? `Checkpoint vibe: ${opts.checkpoint}.` : "";
  const nsfw = opts.nsfwMode
    ? `- NSFW MODE IS ON. For people: stay graphic, uncensored, adult 18+. Never tasteful / implied / fade to black.
- Animal-only or landscape scenes stay non-sexual unless they asked.`
    : `- SFW MODE IS ON. Do not add sex, nude, or gore unless the user already wrote those words.`;
  return `You write image prompts for a local Stable Diffusion / Illustrious / Pony / Flux box. Offline. Uncensored. Adults 18+ only.

Two jobs:
- SHORT line (a few words, one subject): FILL IT IN. Who, looks (face/hair/body/clothes or fur), what is happening, where, camera, light.
- NEW TAKE: keep the subject only. Change hair, clothes, place, camera, light, and the beat. Do not copy or lightly edit the previous prompt.

Always include, in this order when filling a short line:
1. Who — species/age-adult, face, hair, body, clothes (or none if they asked)
2. What is happening — one clear beat, verbs
3. Where — place, time, weather, a few set pieces
4. Camera — shot size, angle
5. Light — source and mood

Rules:
- Output ONLY the prompt. No quotes, no title, no "sure", no markdown.
- Concrete nouns. No "breathtaking masterpiece / 8k / raw cinematic vulnerability".
${nsfw}
- If they asked sex/sexy/nude/nsfw/dark/horror: stay graphic. Anatomical. Uncensored. Never "tasteful", "implied", "artistic nude", "fade to black", mosaic, or bar censor.
- Do not invent a different main subject.
- 40–140 words. Comma-separated phrases are fine.
${wrap ? `- Visual wrap they picked: ${wrap}. Weave it in, do not replace the scene.` : ""}
${ckpt}`;
}

export function brainUser(opts: { prompt: string; flavor?: string; fresh?: boolean; nsfwMode?: boolean }) {
  const line = opts.prompt.trim() || "invent a striking adult scene";
  const flavor = opts.flavor ? `Lean: ${opts.flavor}.` : "";
  const dirty = opts.nsfwMode || /\b(nsfw|sex|sexy|nude|explicit|fuck|hentai|porn|rape|forced|pussy|cock|gore|bdsm)\b/i.test(line);
  if (opts.fresh) {
    return `NEW TAKE. Same subject, different looks / place / camera / light / beat. Do not copy the last prompt.\nSubject:\n${line}\n\n${flavor}\n${dirty ? "Stay explicit, uncensored, adult 18+. Do not SFW-wash.\n" : "SFW mode — no sex unless already in the subject.\n"}Write a new prompt.`;
  }
  const words = line.split(/\s+/).filter(Boolean).length;
  const commas = (line.match(/,/g) || []).length;
  const short = words <= 10 && commas < 2;
  if (short) {
    return `Identity only: "${line}"
Write a COMPLETE new image prompt about that identity. Do not paste the identity as the first two words then a tag dump. Invent NEW specifics:
- looks: hair, face, body, clothes (costume if they are a magical girl / sailor / maid / etc.)
- one clear action beat
- place, time, weather
- camera and light
${dirty ? "NSFW MODE: explicit adult 18+ acts ABOUT this identity. Graphic anatomy. Uncensored. Not tasteful, not implied." : "SFW MODE: no sex, no nude, unless those words are already in the identity."}
${flavor}
40–90 words. Prompt only. No quotes.`;
  }
  return `Keep EVERY phrase below. Add only missing looks / place / camera / light. Do not rewrite the scene:\n${line}\n\n${flavor}\nWrite the prompt.`;
}

export function cleanBrainOut(raw: string) {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  t = t.replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  t = t.replace(/^(?:sure[,.]?\s*|here(?:'s| is)\s+)?(?:the\s+)?prompt\s*:\s*/i, "").trim();
  t = t.replace(/^["“]+|["”]+$/g, "").trim();
  return t.replace(/\s+/g, " ");
}
