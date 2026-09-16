export type TasteReason = "deformed" | "wrong" | "ugly" | "other";

export type TasteVote = {
  id: string;
  jobId?: string;
  at: number;
  vote: "up" | "down";
  checkpoint: string;
  loras: string[];
  prompt: string;
  seed: number;
  reason?: TasteReason;
};

export type TasteBook = {
  ckpt: Record<string, { up: number; down: number }>;
  lora: Record<string, { up: number; down: number }>;
  byJob: Record<string, "up" | "down">;
  reasons: Record<string, number>;
  votes: TasteVote[];
};

export function emptyTaste(): TasteBook {
  return { ckpt: {}, lora: {}, byJob: {}, reasons: {}, votes: [] };
}

function stem(name: string) {
  return (name || "").replace(/\\/g, "/").split("/").pop() || name || "";
}

function bump(map: Record<string, { up: number; down: number }>, key: string, side: "up" | "down", n: number) {
  if (!key) return;
  const cur = map[key] || { up: 0, down: 0 };
  cur[side] = Math.max(0, cur[side] + n);
  map[key] = cur;
}

export function applyVote(book: TasteBook, vote: TasteVote): TasteBook {
  const next: TasteBook = {
    ckpt: { ...book.ckpt },
    lora: { ...book.lora },
    byJob: { ...book.byJob },
    reasons: { ...book.reasons },
    votes: book.votes.slice(),
  };
  const jobKey = vote.jobId || vote.id;
  const prev = jobKey ? next.byJob[jobKey] : undefined;
  const ck = stem(vote.checkpoint);
  const apply = (side: "up" | "down", n: number) => {
    bump(next.ckpt, ck, side, n);
    for (const l of vote.loras) bump(next.lora, stem(l), side, n);
  };
  if (prev === vote.vote) {
    apply(prev, -1);
    if (jobKey) delete next.byJob[jobKey];
    next.votes = next.votes.filter((v) => (v.jobId || v.id) !== jobKey);
    return next;
  }
  if (prev) apply(prev, -1);
  apply(vote.vote, 1);
  if (jobKey) next.byJob[jobKey] = vote.vote;
  if (vote.vote === "down" && vote.reason) {
    next.reasons[vote.reason] = (next.reasons[vote.reason] || 0) + 1;
  }
  next.votes = [vote, ...next.votes.filter((v) => (v.jobId || v.id) !== jobKey)].slice(0, 400);
  return next;
}

export function ckptScore(book: TasteBook, name: string) {
  const s = book.ckpt[stem(name)];
  if (!s) return 0;
  return s.up - s.down;
}

export function loraScore(book: TasteBook, name: string) {
  const s = book.lora[stem(name)];
  if (!s) return 0;
  return s.up - s.down;
}

export function tasteLabel(book: TasteBook, name: string) {
  const s = book.ckpt[stem(name)];
  if (!s || (s.up === 0 && s.down === 0)) return "";
  return ` ▲${s.up} ▼${s.down}`;
}

export function extraNegFromTaste(book: TasteBook) {
  if ((book.reasons.deformed || 0) < 2) return "";
  return "extra fingers, extra limbs, fused fingers, mutated hands, bad anatomy, deformed hands, missing fingers";
}

export function warnForCheckpoint(book: TasteBook, name: string) {
  const s = book.ckpt[stem(name)];
  if (!s || s.down < 3 || s.down <= s.up) return "";
  const better = Object.entries(book.ckpt)
    .filter(([, v]) => v.up > v.down)
    .sort((a, b) => b[1].up - b[1].down - (a[1].up - a[1].down))[0];
  if (better) return `${stem(name)} has ${s.down} thumbs down. ${better[0]} has ${better[1].up} up.`;
  return `${stem(name)} has ${s.down} thumbs down.`;
}

export function sortCkptsByTaste(names: string[], book: TasteBook, current = "") {
  const cur = stem(current);
  return names.slice().sort((a, b) => {
    const as = stem(a) === cur ? 1 : 0;
    const bs = stem(b) === cur ? 1 : 0;
    if (as !== bs) return bs - as;
    return ckptScore(book, b) - ckptScore(book, a);
  });
}

export function tasteSummary(book: TasteBook) {
  const up = Object.values(book.ckpt).reduce((n, s) => n + s.up, 0);
  const down = Object.values(book.ckpt).reduce((n, s) => n + s.down, 0);
  return { up, down };
}