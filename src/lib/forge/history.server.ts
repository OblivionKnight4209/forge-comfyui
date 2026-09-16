import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PromptRecord = {
  at: string;
  mode: string;
  prompt: string;
  negative: string;
  seed: number;
  checkpoint: string;
  loras: string[];
};

function historyPath() {
  const home = os.homedir();
  const dir = path.join(home, "forge");
  try {
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "prompt-history.jsonl");
  } catch {
    return path.join(process.cwd(), "prompt-history.jsonl");
  }
}

export function historyLocation() {
  return historyPath();
}

export function appendPrompt(rec: PromptRecord) {
  const line = JSON.stringify(rec) + "\n";
  fs.appendFileSync(historyPath(), line, "utf8");
}

export function listPrompts(limit = 80): PromptRecord[] {
  const p = historyPath();
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
  const out: PromptRecord[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      out.push(JSON.parse(line) as PromptRecord);
    } catch {
      /* skip */
    }
  }
  return out.reverse();
}
