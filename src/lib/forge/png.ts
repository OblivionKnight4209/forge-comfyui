function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i] ?? 0;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function latin1(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    b[i] = c < 256 ? c : 0x3f;
  }
  return b;
}

function textChunk(keyword: string, text: string): Uint8Array {
  const data = concat([latin1(keyword), new Uint8Array([0]), latin1(text)]);
  const type = latin1("tEXt");
  const crc = crc32(concat([type, data]));
  return concat([u32(data.length), type, data, u32(crc)]);
}

export function embedWorkflowPng(
  png: Uint8Array,
  workflowJson: string,
  promptJson: string,
): Uint8Array {
  if (png.length < 8 || png[0] !== 0x89) throw new Error("Not a PNG");
  const sig = png.slice(0, 8);
  const chunks: Uint8Array[] = [sig];
  let i = 8;
  const extras = [textChunk("prompt", promptJson), textChunk("workflow", workflowJson)];
  let injected = false;
  while (i + 8 <= png.length) {
    const len = new DataView(png.buffer, png.byteOffset + i, 4).getUint32(0);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    const end = i + 12 + len;
    const chunk = png.slice(i, end);
    if (type === "IEND" && !injected) {
      chunks.push(...extras);
      injected = true;
    }
    chunks.push(chunk);
    i = end;
  }
  return concat(chunks);
}

export function readPngText(png: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 8;
  while (i + 8 <= png.length) {
    const len = new DataView(png.buffer, png.byteOffset + i, 4).getUint32(0);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    const start = i + 8;
    if (type === "tEXt") {
      const data = png.slice(start, start + len);
      const z = data.indexOf(0);
      if (z > 0) {
        const key = String.fromCharCode(...data.slice(0, z));
        out[key] = String.fromCharCode(...data.slice(z + 1));
      }
    }
    i += 12 + len;
  }
  return out;
}

export function seedFromPngText(text: Record<string, string>): { seed?: number; prompt?: string } {
  let seed: number | undefined;
  let prompt: string | undefined;
  if (text.forge_seed && Number.isFinite(Number(text.forge_seed))) seed = Number(text.forge_seed);
  if (text.forge_prompt) prompt = text.forge_prompt;
  const raw = text.prompt || text.workflow || "";
  if (!raw) return { seed, prompt };
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const nodes = (j.prompt && typeof j.prompt === "object" ? j.prompt : j) as Record<
      string,
      { class_type?: string; inputs?: Record<string, unknown>; _meta?: { title?: string } }
    >;
    for (const n of Object.values(nodes)) {
      if (!n || typeof n !== "object") continue;
      const inputs = n.inputs ?? {};
      if (typeof inputs.seed === "number") seed = inputs.seed;
      if (n.class_type === "CLIPTextEncode" && typeof inputs.text === "string" && inputs.text.length > 8) {
        if (!prompt || /positive/i.test(n._meta?.title || "")) prompt = inputs.text;
      }
    }
  } catch {
    /* not json */
  }
  return { seed, prompt };
}

export function seedFromBytes(bytes: Uint8Array): number {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i] ?? 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000_000;
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}
