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
    "keep the same person, same face, same body, same pose, same camera, same background unless told to change it, only those edits";
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
  if (t) return [t, ...extra, "keep everything else in the photo, same person, same face, same pose, same room, only this edit, do not add extra people extra clothes extra objects extra sex"].join(". ");
  return buildEditPrompt({ remove, add, change });
}