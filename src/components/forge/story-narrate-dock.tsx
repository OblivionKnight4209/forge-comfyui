import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForge } from "@/lib/forge/store";
import { NSFW_SFX, SFW_SFX, cueLabel, parseAnyText, type SfxKind } from "@/lib/forge/narrate";
import { playNarration, playSfx, stopNarration } from "@/lib/forge/narrate-play";

export function StoryNarrateDock() {
  const prompt = useForge((s) => s.prompt);
  const nsfw = useForge((s) => s.nsfwMode);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() ?? [];
      setVoices(all);
      if (!voiceURI && all[0]) {
        const hot = all.find((v) => /female|woman|samantha|zira|aria|jenny|amy|emma|moira|hazel/i.test(v.name));
        setVoiceURI((hot || all[0]).voiceURI);
      }
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      stopNarration();
    };
  }, [voiceURI]);

  function start() {
    if (running) {
      stopNarration();
      setRunning(false);
      setNow("");
      return;
    }
    const cues = parseAnyText(prompt || "");
    if (!cues.length) return;
    setRunning(true);
    setNow(cueLabel(cues[0]!));
    void playNarration(cues, {
      voices: voices.length ? voices : window.speechSynthesis?.getVoices() ?? [],
      narratorURI: voiceURI,
      onCue: (c) => setNow(cueLabel(c)),
    }).finally(() => {
      setRunning(false);
      setNow("");
    });
  }

  const chips: SfxKind[] = nsfw ? [...SFW_SFX.slice(0, 10), ...NSFW_SFX] : SFW_SFX;

  return (
    <div className="pointer-events-none fixed right-3 bottom-20 z-40 flex w-[min(100%-1.5rem,22rem)] flex-col items-end gap-2 md:bottom-6">
      {open ? (
        <div className="pointer-events-auto w-full rounded-2xl border border-white/10 bg-bg/95 p-3 shadow-xl backdrop-blur">
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Narrate</p>
          <p className="mt-1 text-xs text-muted">
            Reads the box. <span className="text-fg">Name: &quot;line&quot;</span> switches voice.
            Words and [tags] fire SFX. NSFW chips only when Settings is NSFW. No cloud.
          </p>
          {now ? <p className="mt-1 text-xs font-medium text-accent">Now · {now}</p> : null}
          <select
            className="mt-2 h-8 w-full rounded-full bg-raised px-3 text-xs"
            value={voiceURI}
            onChange={(e) => setVoiceURI(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
            {!voices.length ? <option value="">No voices yet</option> : null}
          </select>
          <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-auto">
            {chips.map((k) => (
              <button
                key={k}
                type="button"
                className="rounded-full bg-raised px-2 py-1 text-[10px] text-fg hover:bg-accent hover:text-accent-fg"
                onClick={() => void playSfx(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="flex-1" onClick={start} disabled={!prompt.trim()}>
              <Volume2 />
              {running ? "Stop" : "Narrate"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Hide
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg shadow-lg"
          onClick={() => setOpen(true)}
        >
          <Volume2 className="h-4 w-4" />
          Narrate
        </button>
      )}
    </div>
  );
}
