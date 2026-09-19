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

export function brainSystem(opts: {
  wrap?: string;
  checkpoint?: string;
  nsfwMode?: boolean;
  cast?: string;
}) {
  const wrap = opts.wrap && opts.wrap !== "none" ? opts.wrap : "";
  const ckpt = opts.checkpoint ? `Checkpoint vibe: ${opts.checkpoint}.` : "";
  const nsfw = opts.nsfwMode
    ? `- NSFW MODE IS ON. Graphic, uncensored, adult 18+. Never tasteful, implied, fade-to-black, mosaic, bar censor, or clothes-on wash.\n- Name bodies and the act. Do not SFW-wash people, monsters, or anthros.`
    : `- SFW MODE IS ON. Do not add sex, nude, or gore unless the user already wrote those words.`;
  const cast = (opts.cast || "").trim()
    ? `\nCAST — keep their canon look.\n${opts.cast}\n`
    : "";
  return `You write image prompts for a local Stable Diffusion box. Offline. Adults 18+ only.\n${cast}\nSHORT line: do NOT echo it. Turn it into a long concrete scene.\nCurly lists are optional. If you use them, EVERY option must be real words.\nGood: {waist-length scarlet hair|ink-black bob|wheat-blonde braid}\nBad: {a|b|c}  — never use the letters a, b, or c as options.\n${nsfw}\n- No masterpiece / 8k purple prose.\n- 60–160 words. Prompt only. No preamble.\n${wrap ? `- Visual wrap: ${wrap}.` : ""}\n${ckpt}`;
}

export function brainUser(opts: {
  prompt?: string;
  flavor?: string;
  fresh?: boolean;
  nsfwMode?: boolean;
  cast?: string;
}) {
  const line = (opts.prompt || "").trim() || "invent a striking adult scene";
  const flavor = opts.flavor ? `Lean: ${opts.flavor}.` : "";
  const dirty =
    !!opts.nsfwMode ||
    /\b(nsfw|sex|sexy|nude|explicit|fuck|hentai|porn|rape|forced|pussy|cock|gore|bdsm|squirrel girl)\b/i.test(
      line,
    );
  const cast = (opts.cast || "").trim() ? `CAST:\n${opts.cast}\n` : "";
  const braceRule =
    "If you use {lists}, write real phrases inside, never the letters a, b, or c.";
  if (opts.fresh) {
    return `NEW TAKE.\n${cast}Subject:\n${line}\n${flavor}\n${dirty ? "Stay explicit, uncensored. No SFW-wash." : "SFW — no sex unless already in the subject."}\n${braceRule}`;
  }
  const short = line.split(/\s+/).filter(Boolean).length <= 10 && (line.match(/,/g) || []).length < 2;
  if (short) {
    return `${cast}Scene: "${line}"\nExpand every subject (who they are, body, clothes, place, light). Keep those words.\n${dirty ? "NSFW: explicit adult 18+. No mosaic, no bar censor." : "SFW: no sex unless they wrote it."}\n${braceRule}\n${flavor}`;
  }
  return `${cast}Keep every phrase:\n${line}\n${flavor}\n${braceRule}`;
}

export function cleanBrainOut(raw: string) {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  t = t.replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  t = t.replace(/^(?:sure[,.]?\s*|here's|here is)\s+(?:the\s+)?prompt\s*:\s*/i, "").trim();
  t = t.replace(/^["\u201c]+|["\u201d]+$/g, "").trim();
  // 7B models copy the example tokens {a|b|c} — delete those, keep real lists
  t = t.replace(/\{(?:\s*[abc]\s*\|)+\s*[abc]\s*\}/gi, "");
  t = t.replace(/\s+,/g, ",").replace(/,+/g, ",").replace(/^,\s*|,+\s*$/g, "");
  return t.replace(/\s+/g, " ").trim();
}

/** Dice: pick one option from every {a|b} list. */
export function rollPrompt(text: string, seed = Date.now()): string {
  let t = (text || "").replace(/\s+/g, " ").trim();
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 32; i++) {
    const m = /\{([^{}]+)\}/.exec(t);
    if (!m || m.index === undefined) break;
    const opts = m[1]
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s && !/^[abc]$/i.test(s));
    const pick = opts.length ? opts[Math.floor(rng() * opts.length)]! : "";
    t = t.slice(0, m.index) + pick + t.slice(m.index + m[0].length);
  }
  return t.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
