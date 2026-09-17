export function nextGenerateSeed(current: number, locked: boolean, keepSeed?: boolean): number {
  if (locked || keepSeed) return current;
  let n = Math.floor(Math.random() * 1_000_000_000);
  if (n === current) n = (n + 1) % 1_000_000_000;
  return n;
}

export function sameStillMeansSameSeed(
  a: { seed: number; prompt: string; checkpoint: string },
  b: { seed: number; prompt: string; checkpoint: string },
) {
  return a.seed === b.seed && a.prompt === b.prompt && a.checkpoint === b.checkpoint;
}
