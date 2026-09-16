export function isVideoName(name: string) {
  return /\.(mp4|m4v|webm|mov|mkv|avi)(\?|$)/i.test(name || "");
}

export function mediaMime(name: string, hinted = ""): string {
  const h = (hinted || "").split(";")[0].trim().toLowerCase();
  if (h.startsWith("video/") || (h.startsWith("image/") && h !== "image/png")) {
    if (h !== "application/octet-stream") return h;
  }
  const n = (name || "").toLowerCase().split("?")[0] ?? "";
  if (/\.(mp4|m4v)$/.test(n)) return "video/mp4";
  if (/\.webm$/.test(n)) return "video/webm";
  if (/\.mov$/.test(n)) return "video/quicktime";
  if (/\.mkv$/.test(n)) return "video/x-matroska";
  if (/\.avi$/.test(n)) return "video/x-msvideo";
  if (/\.webp$/.test(n)) return "image/webp";
  if (/\.(jpg|jpeg)$/.test(n)) return "image/jpeg";
  if (/\.gif$/.test(n)) return "image/gif";
  if (h.startsWith("image/")) return h;
  return "image/png";
}

export function sniffMediaMime(name: string, bytes?: Uint8Array | null): string {
  const fromName = mediaMime(name);
  if (fromName.startsWith("video/") || fromName === "image/jpeg" || fromName === "image/webp") return fromName;
  if (bytes && bytes.length >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video/mp4";
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf) return "video/webm";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  }
  return fromName;
}

/** Linux drops often have empty file.type → data:application/octet-stream, which <video> refuses. */
export function withVideoDataUrl(dataUrl: string, name: string, fileType = "") {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const mime = mediaMime(name, fileType);
  if (!mime.startsWith("video/")) return dataUrl;
  return dataUrl.replace(/^data:[^;,]*/, `data:${mime}`);
}
