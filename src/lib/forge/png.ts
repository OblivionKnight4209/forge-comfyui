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
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
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
