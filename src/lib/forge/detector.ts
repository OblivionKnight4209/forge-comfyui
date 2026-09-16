import type { DetectedBox, ScanResult } from "./types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function colorName(h: number, s: number, l: number): string {
  if (l < 0.08) return "black";
  if (l > 0.92) return "white";
  if (s < 0.12) return l > 0.6 ? "silver" : "gray";
  if (h < 18 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "magenta";
}

function isSkin(r: number, g: number, b: number) {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && Math.abs(r - g) > 15;
}

type Cell = { x: number; y: number; v: number; r: number; g: number; b: number; skin: number };

function labelRegion(avgR: number, avgG: number, avgB: number, skinRatio: number, yFrac: number) {
  const { h, s, l } = rgbToHsl(avgR, avgG, avgB);
  if (skinRatio > 0.28) return { label: "person", conf: clamp(0.55 + skinRatio, 0.55, 0.92) };
  if (l > 0.55 && s < 0.25 && yFrac < 0.4) return { label: "sky / backdrop", conf: 0.62 };
  if (h >= 70 && h < 160 && s > 0.2) return { label: "foliage", conf: 0.58 };
  if (h >= 190 && h < 255 && s > 0.25) return { label: "water / cloth", conf: 0.52 };
  if (l < 0.18) return { label: "dark region", conf: 0.5 };
  if (s > 0.45) return { label: colorName(h, s, l) + " object", conf: 0.48 };
  return { label: "form", conf: 0.42 };
}

function loadElement(src: string): Promise<HTMLImageElement | HTMLVideoElement> {
  if (src.startsWith("data:video") || /\.(mp4|webm|mov)(\?|$)/i.test(src)) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject(new Error("Could not read video"));
      v.src = src;
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = src.startsWith("data:") || src.startsWith("blob:") ? null : "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

export async function extractFrame(dataUrl: string): Promise<string> {
  const el = await loadElement(dataUrl);
  const w = "videoWidth" in el ? el.videoWidth || 640 : el.naturalWidth;
  const h = "videoHeight" in el ? el.videoHeight || 360 : el.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(el as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export async function scanMedia(dataUrl: string): Promise<ScanResult> {
  const el = await loadElement(dataUrl);
  const w = "videoWidth" in el ? el.videoWidth || 640 : el.naturalWidth;
  const h = "videoHeight" in el ? el.videoHeight || 360 : el.naturalHeight;
  const canvas = document.createElement("canvas");
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas");
  if ("currentTime" in el) {
    try {
      el.currentTime = 0.05;
    } catch {
      /* ignore */
    }
  }
  ctx.drawImage(el as CanvasImageSource, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const grid = 8;
  const cell = size / grid;
  const cells: Cell[] = [];
  let lumSum = 0;
  let satSum = 0;
  let edgeSum = 0;
  let skinCount = 0;
  const colorHits = new Map<string, number>();

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let r = 0,
        g = 0,
        b = 0,
        n = 0,
        skin = 0,
        varAcc = 0,
        lumCell = 0;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell; x < (gx + 1) * cell; x++) {
          const i = (Math.floor(y) * size + Math.floor(x)) * 4;
          const rr = data[i] ?? 0;
          const gg = data[i + 1] ?? 0;
          const bb = data[i + 2] ?? 0;
          r += rr;
          g += gg;
          b += bb;
          n++;
          const lum = (rr + gg + bb) / 3;
          lumCell += lum;
          if (isSkin(rr, gg, bb)) {
            skin++;
            skinCount++;
          }
          const right = data[i + 4] ?? rr;
          edgeSum += Math.abs(rr - right);
        }
      }
      r /= n;
      g /= n;
      b /= n;
      lumCell /= n;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell; x < (gx + 1) * cell; x++) {
          const i = (Math.floor(y) * size + Math.floor(x)) * 4;
          const lum = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
          varAcc += (lum - lumCell) ** 2;
        }
      }
      const hsl = rgbToHsl(r, g, b);
      lumSum += hsl.l;
      satSum += hsl.s;
      const name = colorName(hsl.h, hsl.s, hsl.l);
      colorHits.set(name, (colorHits.get(name) ?? 0) + 1);
      cells.push({ x: gx, y: gy, v: varAcc / n, r, g, b, skin: skin / n });
    }
  }

  const meanV = cells.reduce((s, c) => s + c.v, 0) / cells.length;
  const hot = cells.filter((c) => c.v > meanV * 1.35 || c.skin > 0.22);
  const seen = new Set<string>();
  const boxes: DetectedBox[] = [];

  function key(c: Cell) {
    return `${c.x},${c.y}`;
  }

  for (const start of hot) {
    if (seen.has(key(start))) continue;
    const stack = [start];
    const group: Cell[] = [];
    seen.add(key(start));
    while (stack.length) {
      const cur = stack.pop()!;
      group.push(cur);
      for (const n of hot) {
        if (seen.has(key(n))) continue;
        if (Math.abs(n.x - cur.x) + Math.abs(n.y - cur.y) === 1) {
          seen.add(key(n));
          stack.push(n);
        }
      }
    }
    if (group.length < 2) continue;
    const minX = Math.min(...group.map((c) => c.x));
    const minY = Math.min(...group.map((c) => c.y));
    const maxX = Math.max(...group.map((c) => c.x));
    const maxY = Math.max(...group.map((c) => c.y));
    const ar = group.reduce((s, c) => s + c.r, 0) / group.length;
    const ag = group.reduce((s, c) => s + c.g, 0) / group.length;
    const ab = group.reduce((s, c) => s + c.b, 0) / group.length;
    const skin = group.reduce((s, c) => s + c.skin, 0) / group.length;
    const lab = labelRegion(ar, ag, ab, skin, (minY + maxY) / 2 / grid);
    boxes.push({
      id: `b${boxes.length}`,
      label: lab.label,
      confidence: lab.conf,
      x: minX / grid,
      y: minY / grid,
      w: (maxX - minX + 1) / grid,
      h: (maxY - minY + 1) / grid,
    });
  }

  boxes.sort((a, b) => b.w * b.h * b.confidence - a.w * a.h * a.confidence);
  const topBoxes = boxes.slice(0, 8);

  const avgLum = lumSum / cells.length;
  const avgSat = satSum / cells.length;
  const edge = edgeSum / (size * size);
  const skinRatio = skinCount / (size * size);
  const aspect = w / h;
  const palette = [...colorHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n]) => n);

  const tags: { tag: string; confidence: number }[] = [];
  const add = (tag: string, confidence: number) => tags.push({ tag, confidence });

  if (aspect > 1.4) add("landscape", 0.84);
  else if (aspect < 0.75) add("portrait", 0.86);
  else add("square", 0.7);

  if (avgLum < 0.28) add("low light", 0.78);
  else if (avgLum > 0.7) add("bright", 0.74);
  else add("balanced lighting", 0.6);

  if (avgSat < 0.18) add("desaturated", 0.7);
  else if (avgSat > 0.45) add("vivid color", 0.68);

  if (edge > 18) add("photograph", 0.64);
  else add("soft / painted", 0.58);

  if (skinRatio > 0.04) add("person", clamp(0.5 + skinRatio * 3, 0.5, 0.93));
  if (skinRatio > 0.12) add("close-up", 0.62);
  if (topBoxes.some((b) => b.label.includes("sky"))) add("outdoors", 0.6);
  if (topBoxes.some((b) => b.label.includes("foliage"))) add("nature", 0.58);
  for (const c of palette.slice(0, 3)) add(c, 0.55);

  const subjects = topBoxes.filter((b) => b.label === "person").length;
  if (subjects === 1) add("solo", 0.66);
  if (subjects >= 2) add("multiple subjects", 0.6);

  const subjectBit =
    subjects >= 2
      ? "more than one person"
      : subjects === 1
        ? "a person"
        : topBoxes[0]
          ? topBoxes[0].label
          : "the scene";
  const lightBit = avgLum < 0.28 ? "dim" : avgLum > 0.7 ? "bright" : "even";
  const shotBit = aspect < 0.8 ? "portrait" : aspect > 1.4 ? "wide" : "square";
  const summary = `A ${shotBit} frame of ${subjectBit}, ${lightBit} ${palette[0] ?? "neutral"} palette. Local scanner — not a cloud model.`;

  const notes: string[] = [];
  if (skinRatio > 0.2 && aspect < 0.9) notes.push("Likely a figure-forward still. Check hands and face on zoom.");
  if (edge < 10) notes.push("Low edge energy — could be blur, fog, or illustration.");
  if (avgLum < 0.18) notes.push("Very dark. Lift exposure in the next prompt if that was not the intent.");
  if (!notes.length) notes.push("Composition looks usable. Send tags into the prompt if you want to lock this look.");

  return {
    summary,
    tags: tags.sort((a, b) => b.confidence - a.confidence),
    boxes: topBoxes,
    palette,
    notes,
    scannedAt: Date.now(),
  };
}

export function scanFromTags(raw: string): ScanResult {
  const tags = raw
    .split(/[,;\n]/)
    .map((t) => t.trim().replace(/_/g, " "))
    .filter(Boolean)
    .slice(0, 32)
    .map((tag) => ({ tag, confidence: 0.9 }));
  const summary =
    tags.length > 0
      ? `WD14: ${tags
          .slice(0, 14)
          .map((t) => t.tag)
          .join(", ")}.`
      : "WD14 returned no tags.";
  return {
    summary,
    tags,
    boxes: boxesFromTags(tags),
    palette: [],
    notes: ["ComfyUI-WD14-Tagger — local, not a cloud model."],
    scannedAt: Date.now(),
  };
}

/** Fallback boxes from tags so the overlay is never empty after a WD14 hit. */
export function boxesFromTags(tags: { tag: string }[]): DetectedBox[] {
  const blob = tags.map((t) => t.tag.toLowerCase()).join(" ");
  const boxes: DetectedBox[] = [];
  const person = /\b(1girl|2girls|1boy|2boys|girl|woman|man|person|solo|people)\b/.test(blob);
  const face = /\b(face|portrait|close.?up|looking at viewer)\b/.test(blob);
  const two = /\b(2girls|2boys|couple|multiple)\b/.test(blob);
  if (two) {
    boxes.push({ id: "left", label: "subject", confidence: 0.62, x: 0.04, y: 0.08, w: 0.44, h: 0.86 });
    boxes.push({ id: "right", label: "subject", confidence: 0.62, x: 0.52, y: 0.08, w: 0.44, h: 0.86 });
  } else if (person) {
    boxes.push({ id: "subject", label: "subject", confidence: 0.7, x: 0.16, y: 0.06, w: 0.68, h: 0.9 });
  }
  if (face) {
    boxes.push({ id: "face", label: "face", confidence: 0.66, x: 0.32, y: 0.05, w: 0.36, h: 0.34 });
  }
  if (/\b(pussy|penis|breasts|nipples|nude|naked)\b/.test(blob) && !boxes.some((b) => b.id === "body")) {
    boxes.push({ id: "body", label: "body", confidence: 0.58, x: 0.22, y: 0.28, w: 0.56, h: 0.62 });
  }
  if (!boxes.length) {
    boxes.push({ id: "frame", label: "frame", confidence: 0.4, x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
  }
  return boxes.slice(0, 8);
}

export function mergeScan(wd14: ScanResult, local: ScanResult | null): ScanResult {
  if (!local) {
    return { ...wd14, boxes: wd14.boxes.length ? wd14.boxes : boxesFromTags(wd14.tags) };
  }
  const seen = new Set<string>();
  const tags: { tag: string; confidence: number }[] = [];
  for (const t of [...wd14.tags, ...local.tags]) {
    const k = t.tag.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(t);
  }
  return {
    summary: wd14.tags.length ? wd14.summary : local.summary,
    tags: tags.sort((a, b) => b.confidence - a.confidence).slice(0, 40),
    boxes: local.boxes.length ? local.boxes : wd14.boxes.length ? wd14.boxes : boxesFromTags(tags),
    palette: local.palette.length ? local.palette : wd14.palette,
    notes: [...new Set([...(wd14.notes || []), ...(local.notes || [])])],
    scannedAt: Date.now(),
  };
}
