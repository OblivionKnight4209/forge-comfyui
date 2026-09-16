import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyVote, emptyTaste, type TasteBook, type TasteVote } from "./taste";

function tastePath() {
  return path.join(os.homedir(), ".forge-taste.json");
}

export function readTaste(): TasteBook {
  try {
    const raw = fs.readFileSync(tastePath(), "utf8");
    const json = JSON.parse(raw) as TasteBook;
    if (!json || typeof json !== "object") return emptyTaste();
    return {
      ckpt: json.ckpt || {},
      lora: json.lora || {},
      byJob: json.byJob || {},
      reasons: json.reasons || {},
      votes: Array.isArray(json.votes) ? json.votes.slice(0, 400) : [],
    };
  } catch {
    return emptyTaste();
  }
}

export function writeTaste(book: TasteBook) {
  const tmp = `${tastePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(book));
  fs.renameSync(tmp, tastePath());
}

export function recordTasteVote(vote: TasteVote): TasteBook {
  const next = applyVote(readTaste(), vote);
  try {
    writeTaste(next);
  } catch {
    /* disk full / perms — still return the in-memory book */
  }
  return next;
}

export function resetTaste(): TasteBook {
  const empty = emptyTaste();
  try {
    writeTaste(empty);
  } catch {
    /* ignore */
  }
  return empty;
}