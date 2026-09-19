import type { WildcardFile } from "./types";
import { expandPrompt, fillGaps, flattenPrompt, mulberry32, nsfwWanted, stripAutoNsfw } from "./wildcards";

/** Keep the typed sentence first. Only append missing looks. */
export function grokExpand(opts: {
  typed: string;
  files: WildcardFile[];
  seed: number;
  family?: "flux" | "sdxl" | "sd15";
  checkpoint?: string;
  roll?: "normal" | "random";
  nsfwMode?: boolean;
  cast?: string[];
}): string {
  const raw = (opts.typed ?? "").replace(/\s+/g, " ").trim();
  const bios = (opts.cast || []).filter(Boolean);
  if (!raw && !bios.length) return raw;
  const lead0 = raw || bios.join(", ");
  const missing = bios.filter((b) => {
    const first = (b.split(",")[0] || "").split(/\s+/)[0] || "";
    return first.length > 2 && !new RegExp(`\\b${first.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(lead0);
  });
  const locked = missing.length ? `${lead0}, ${missing.join(", ")}` : lead0;
  const { expanded } = expandPrompt(locked, opts.files || [], opts.seed);
  const ckpt = (opts.checkpoint ?? "").toLowerCase();
  const anime =
    opts.family === "sd15" ||
    (/mix|anime|kitten|illustrious|noob|nai|pony/.test(ckpt) && !ckpt.includes("flux"));
  const nsfwOn = opts.nsfwMode === true;
  const lead = nsfwOn ? expanded : stripAutoNsfw(expanded);
  const filled = fillGaps(lead, anime, mulberry32((opts.seed + 17) >>> 0), nsfwOn);
  let out = keepUserFirst(lead0, filled);
  if (nsfwOn && nsfwWanted(lead0, true) && !/\buncensored\b/i.test(out)) {
    out = `${out}, uncensored, explicit, nsfw, adult 18+`;
  }
  return flattenPrompt(out, opts.seed);
}

function keepUserFirst(user: string, filled: string): string {
  const u = (user || "").replace(/\s+/g, " ").trim();
  const f = (filled || "").replace(/\s+/g, " ").trim();
  if (!u) return f;
  if (!f) return u;
  if (f.toLowerCase().startsWith(u.toLowerCase())) return f;
  const rest = f
    .replace(new RegExp(`^${u.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}[,.\\s]*`, "i"), "")
    .trim();
  if (!rest || rest.toLowerCase() === u.toLowerCase()) return u;
  return `${u}. ${rest}`.replace(/\.\s*\./g, ".").trim();
}

export { flattenPrompt, writePrompt, writeIdeas, grokMotion, isAdult, userLead, recoverScene, composeNewScene, isPurpleProse, sceneCore, tokenOverlap, nsfwWanted, isShortSubject, expandPrompt, PROMPT_FLAVORS } from "./wildcards";
export type { PromptFlavor } from "./wildcards";
