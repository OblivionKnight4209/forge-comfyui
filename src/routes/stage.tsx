import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { mediaMime } from "@/lib/forge/media-mime";
import { comfyMediaFn, listComfyRecentFn } from "@/lib/forge/functions";

export const Route = createFileRoute("/stage")({ component: Stage });

function Stage() {
  const [src, setSrc] = useState("");
  const [mime, setMime] = useState("image/png");
  const [name, setName] = useState("waiting for a generate…");
  const last = useRef("");

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const list = await listComfyRecentFn({ data: { all: false } });
        const latest = list.find((f) => f.folder === "output" && /(?:^|\/)Forge_/i.test(f.name))
          ?? list.find((f) => f.folder === "output");
        if (!latest || stop) return;
        const key = `${latest.name}:${latest.mtime}`;
        if (key === last.current && src) return;
        const file = await comfyMediaFn({ data: { folder: "output", name: latest.name } });
        if (stop || !file.ok) return;
        last.current = key;
        setSrc(file.dataUrl);
        setMime(file.mime);
        setName(latest.name);
      } catch {
        /* keep last frame */
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <p className="shrink-0 px-4 py-2 text-center text-xs text-white/60">
        Display only · no controls · generate from the laptop at this PC’s LAN address :8080
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {src ? (
          mime.startsWith("video") ? (
            <video autoPlay loop muted playsInline className="max-h-full max-w-full object-contain">
              <source src={src} type={mediaMime(name, mime)} />
            </video>
          ) : (
            <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
          )
        ) : (
          <p className="text-sm text-white/50">Waiting for Comfy output…</p>
        )}
      </div>
      <p className="shrink-0 truncate px-4 py-2 text-center font-mono text-[11px] text-white/40">{name}</p>
    </div>
  );
}
