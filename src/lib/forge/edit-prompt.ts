export function expandEditFields(opts: { remove?: string; add?: string; change?: string }) {
  const remove = (opts.remove ?? "").replace(/\s+/g, " ").trim();
  const add = (opts.add ?? "").replace(/\s+/g, " ").trim();
  const change = (opts.change ?? "").replace(/\s+/g, " ").trim();
  return {
    remove: remove
      ? remove.length > 48
        ? remove
        : `${remove}, gone, not in the picture, no ${remove} remaining, do not redraw ${remove}`
      : "",
    add: add
      ? add.length > 48
        ? add
        : `${add}, clearly visible on this person, fits the body, detailed ${add}`
      : "",
    change: change
      ? change.length > 48
        ? change
        : `${change}, the change is obvious, same person, same face, same pose`
      : "",
  };
}

export function buildEditPrompt(opts: {
  remove?: string;
  add?: string;
  change?: string;
  scan?: string;
}): string {
  const x = expandEditFields(opts);
  const bits: string[] = [];
  if (x.remove) bits.push(`remove ${x.remove}`);
  if (x.add) bits.push(`add ${x.add}`);
  if (x.change) bits.push(`change ${x.change}`);
  if (!bits.length) return "";
  const seen = (opts.scan ?? "").replace(/\s+/g, " ").trim();
  const keep =
    "keep the same person, same face, same body, same pose, same camera, same background unless told to change it, same art style, same rendering, same lighting, same colors, same medium, do not restyle, only those edits";
  return [seen ? `the photo already shows ${seen}` : "", ...bits, keep].filter(Boolean).join(". ");
}

/** Typed box wins. Take out / Put in / Change only append if filled. */
export function composeI2iPrompt(
  typed: string,
  fields: { remove?: string; add?: string; change?: string },
  scan?: string,
): string {
  const t = (typed ?? "").replace(/\s+/g, " ").trim();
  const remove = (fields.remove ?? "").replace(/\s+/g, " ").trim();
  const add = (fields.add ?? "").replace(/\s+/g, " ").trim();
  const change = (fields.change ?? "").replace(/\s+/g, " ").trim();
  const extra: string[] = [];
  if (remove && !t.toLowerCase().includes(remove.toLowerCase())) extra.push(`remove ${remove}`);
  if (add && !t.toLowerCase().includes(add.toLowerCase())) extra.push(`add ${add}`);
  if (change && !t.toLowerCase().includes(change.toLowerCase())) extra.push(`change ${change}`);
  const seen = (scan ?? "").replace(/\s+/g, " ").trim();
  const identity = seen ? `the photo already shows ${seen}` : "";
  const lock =
    "keep everything else in the photo, same person, same face, same pose, same room, same art style, same rendering, same lighting, same colors, same medium, do not restyle, only this edit, do not add extra people extra clothes extra objects extra sex";
  if (t) return [t, ...extra, identity, lock].filter(Boolean).join(". ");
  return buildEditPrompt({ remove, add, change, scan });
}

/** CLIPSeg / inpaint mask phrase from Take out / Put in / Change. */
export function inpaintMaskText(fields: { remove?: string; add?: string; change?: string; typed?: string }): string {
  const remove = (fields.remove ?? "").replace(/\s+/g, " ").trim();
  const add = (fields.add ?? "").replace(/\s+/g, " ").trim();
  const change = (fields.change ?? "").replace(/\s+/g, " ").trim();
  const typed = (fields.typed ?? "").replace(/\s+/g, " ").trim();
  if (remove) return remove.split(",")[0]!.trim().slice(0, 48);
  if (change) {
    const first = change.split(",")[0]!.trim();
    const noun = first.replace(/^(make|turn|paint|dye|swap)\s+/i, "").slice(0, 48);
    return noun || first.slice(0, 48);
  }
  if (add) {
    if (/\b(hat|crown|helmet|hood|cap|tiara)\b/i.test(add)) return "head, hair";
    if (/\b(tattoo|scar|blood)\b/i.test(add)) return "skin, body";
    if (/\b(wing|tail|horn)\b/i.test(add)) return "person, back";
    return "person";
  }
  const m = typed.match(/\b(?:remove|take off|delete|erase)\s+(.{2,40}?)(?:\.|$|,)/i);
  if (m?.[1]) return m[1].replace(/\b(the|a|an|her|his|their)\s+/gi, "").trim().slice(0, 48);
  return "";
}
