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
    ? `- NSFW MODE IS ON. Stay graphic, uncensored, adult 18+. Never tasteful / implied / fade to black / mosaic / bar censor / clothes-on wash.\n- If they named a person, creature, or monster, describe bodies and the act. Do not SFW-wash.`
    : `- SFW MODE IS ON. Do not add sex, nude, or gore unless the user already wrote those words.`;
  const cast = (opts.cast || "").trim()
    ? `\nCAST — these people are already chosen. You MUST keep their canon look.\n${opts.cast}\n`
    : "";
  return `You write Perchance-style image prompts for a local Stable Diffusion box. Offline. Uncensored. Adults 18+ only.\n${cast}\nSHORT line: do NOT echo it. Turn it into a long template.\nUse {a|b|c} curly lists for shot, looks, place, light.\n${nsfw}\n- KEEP braces. No masterpiece / 8k purple prose.\n- Graphic when NSFW. Never mosaic or bar censor.\n- 60–160 words. Prompt only.\n${wrap ? `- Visual wrap: ${wrap}.` : ""}\n${ckpt}`;
}

export function brainUser(opts: { prompt?: string; flavor?: string; fresh?: boolean; nsfwMode?: boolean; cast?: string }) {
  const line = (opts.prompt || "").trim() || "invent a striking adult scene";
  const flavor = opts.flavor ? `Lean: ${opts.flavor}.` : "";
  const dirty = !!opts.nsfwMode || /\b(nsfw|sex|sexy|nude|explicit|fuck|hentai|porn|rape|forced|pussy|cock|gore|bdsm)\b/i.test(line);
  const cast = (opts.cast || "").trim() ? `CAST:\n${opts.cast}\n` : "";
  if (opts.fresh) {
    return `NEW TAKE.\n${cast}Subject:\n${line}\n${flavor}\n${dirty ? "Stay explicit, uncensored. No SFW-wash." : "SFW — no sex unless already in the subject."}\nWrite a Perchance template with {a|b|c} lists.`;
  }
  const short = line.split(/\s+/).filter(Boolean).length <= 10 && (line.match(/,/g) || []).length < 2;
  if (short) {
    return `${cast}Scene: "${line}"\nWrite a Perchance template. Keep those words. Use {option|option}.\n${dirty ? "NSFW: explicit adult 18+. No mosaic, no bar censor." : "SFW: no sex unless they wrote it."}\n${flavor}`;
  }
  return `${cast}Keep every phrase:\n${line}\n${flavor}\nKeep any {a|b} lists.`;
}

export function cleanBrainOut(raw: string) {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  t = t.replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  t = t.replace(/^(?:sure[,.]?\s*|here(?:'s| is)\s+)?(?:the\s+)?prompt\s*:\s*/i, "").trim();
  t = t.replace(/^["\u201c]+|["\u201d]+$/g, "").trim();
  return t.replace(/\s+/g, " ");
}
