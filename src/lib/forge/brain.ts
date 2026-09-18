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

export function brainSystem(opts: { wrap?: string; checkpoint?: string; nsfwMode?: boolean; cast?: string }) {
  const wrap = opts.wrap && opts.wrap !== "none" ? opts.wrap : "";
  const ckpt = opts.checkpoint ? `Checkpoint vibe: ${opts.checkpoint}.` : "";
  const nsfw = opts.nsfwMode
    ? `- NSFW MODE IS ON. For people: stay graphic, uncensored, adult 18+. Never tasteful / implied / fade to black.\n- Animal-only or landscape scenes stay non-sexual unless they asked.`
    : `- SFW MODE IS ON. Do not add sex, nude, or gore unless the user already wrote those words.`;
  const cast = (opts.cast || "").trim()
    ? `\nCAST — these people are already chosen. You MUST keep their canon look (hair, eyes, body, clothes, species, show). Do not invent a different person. Do not swap hair color. Do not turn them into a generic girl.\n${opts.cast}\n`
    : "";
  return `You write Perchance-style image prompts for a local Stable Diffusion box. Offline. Uncensored. Adults 18+ only.\n${cast}\nSHORT line (a few words): do NOT echo it. Turn it into a long template that still contains the user's words.\n\nFormat like Perchance — curly OR-lists the user can reroll:\n{a cinematic wide shot|a low-angle still|a close three-quarter}\nKeep 6–12 such {a|b|c} groups covering: shot, who (looks), clothes or fur, action, place, weather, light, lens.\n\nAlways fill:\n1. Who — CAST looks if set, else species/adult face/hair/body/clothes or coat\n2. What is happening — verbs\n3. Where — place, weather, set pieces\n4. Camera and light\n\nRules:\n- Output ONLY the prompt. No title, no markdown, no "sure".\n- KEEP the {option|option} braces in the output. Do not pick one look yet.\n- Concrete nouns. No "breathtaking masterpiece / 8k / raw cinematic vulnerability".\n${nsfw}\n- If they asked sex/sexy/nude/nsfw/dark/horror: stay graphic. Uncensored. Never tasteful / implied / fade to black.\n- Do not replace the subject (dog stays dog, girl stays that girl).\n- 60–160 words.\n${wrap ? `- Visual wrap they picked: ${wrap}. Weave it in, do not replace the scene.` : ""}\n${ckpt}`;
}

export function brainUser(opts: { prompt: string; flavor?: string; fresh?: boolean; nsfwMode?: boolean; cast?: string }) {
  const line = opts.prompt.trim() || "invent a striking adult scene";
  const flavor = opts.flavor ? `Lean: ${opts.flavor}.` : "";
  const dirty = opts.nsfwMode || /\b(nsfw|sex|sexy|nude|explicit|fuck|hentai|porn|rape|forced|pussy|cock|gore|bdsm)\b/i.test(line);
  const cast = (opts.cast || "").trim()
    ? `CAST (keep canon look, name them in the prompt):\n${opts.cast}\n`
    : "";
  if (opts.fresh) {
    return `NEW TAKE. Same people, different place / camera / light / beat. Do not change CAST looks.\n${cast}Subject:\n${line}\n\n${flavor}\n${dirty ? "Stay explicit, uncensored, adult 18+. Do not SFW-wash.\n" : "SFW mode — no sex unless already in the subject.\n"}Write a new Perchance template with {a|b|c} lists.`;
  }
  const words = line.split(/\s+/).filter(Boolean).length;
  const commas = (line.match(/,/g) || []).length;
  const short = words <= 10 && commas < 2;
  if (short) {
    return `${cast}Identity / scene: "${line}"\nWrite a COMPLETE Perchance template. Keep "${line}" in the text. Fill who / looks / action / place / camera / light.\nUse {option|option|option} lists for looks, place, camera, light. Do NOT flatten them.\n${dirty ? "NSFW MODE: explicit adult 18+ acts ABOUT this identity. Graphic. Uncensored." : "SFW MODE: no sex, no nude, unless those words are already in the identity."}\n${flavor}\n60–140 words. Prompt only. Keep the curly braces.`;
  }
  return `${cast}Keep EVERY phrase below. Add only missing looks / place / camera / light. If CAST is set and hair/eyes are missing, add the CAST looks. Do not rewrite the scene:\n${line}\n\n${flavor}\nWrite the prompt. Keep any {a|b} lists.`;
}

export function cleanBrainOut(raw: string) {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  t = t.replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  t = t.replace(/^(?:sure[,.]?\s*|here(?:'s| is)\s+)?(?:the\s+)?prompt\s*:\s*/i, "").trim();
  t = t.replace(/^["\u201c]+|["\u201d]+$/g, "").trim();
  return t.replace(/\s+/g, " ");
}
