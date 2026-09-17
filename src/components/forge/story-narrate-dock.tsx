import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForge } from "@/lib/forge/store";
import { NSFW_SFX, SFW_SFX, cueLabel, parseAnyText, type SfxKind, type VoiceRole } from "@/lib/forge/narrate";
import { playNarration, playSfx, stopNarration, VOICE_STYLES, type VoiceStyle } from "@/lib/forge/narrate-play";

const ROLES: { id: VoiceRole; label: string }[] = [
  { id: "narrator", label: "Narrator" },
  { id: "female", label: "Woman" },
  { id: "male", label: "Man" },
  { id: "creature", label: "Creature" },
];

export function StoryNarrateDock() {
  const prompt = useForge((s) => s.prompt);
  const nsfw = useForge((s) => s.nsfwMode);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceByRole, setVoiceByRole] = useState<Partial<Record<VoiceRole, string>>>({});
  const [styleByRole, setStyleByRole] = useState<Partial<Record<VoiceRole, VoiceStyle>>>({
    narrator: "calm",
    female: "hot",
    male: "growl",
    creature: "growl",
  });

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() ?? [];
      setVoices(all);
      setVoiceByRole((prev) => {
        if (prev.narrator || !all.length) return prev;
        const fem = all.filter((v) => /female|woman|samantha|zira|aria|jenny|amy|emma|moira|hazel/i.test(v.name));
        const masc = all.filter((v) => /male|man|david|mark|daniel|george|alex|fred/i.test(v.name));
        return {
          narrator: (fem[0] || all[0]).voiceURI,
          female: (fem[1] || fem[0] || all[0]).voiceURI,
          male: (masc[0] || all[all.length - 1]).voiceURI,
          creature: (masc[1] || masc[0] || all[all.length - 1]).voiceURI,
        };
      });
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      stopNarration();
    };
  }, []);

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
      voiceByRole,
      styleByRole,
      onCue: (c) => setNow(cueLabel(c)),
    }).finally(() => {
      setRunning(false);
      setNow("");
    });
  }

  const chips: SfxKind[] = nsfw ? [...SFW_SFX.slice(0, 8), ...NSFW_SFX] : SFW_SFX;

  return (
    <div className="pointer-events-none fixed right-3 bottom-20 z-40 flex w-[min(100%-1.5rem,24rem)] flex-col items-end gap-2 md:bottom-6">
      {open ? (
        <div className="pointer-events-auto max-h-[70dvh] w-full overflow-auto rounded-2xl border border-white/10 bg-bg/95 p-3 shadow-xl backdrop-blur">
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Narrate · voices</p>
          <p className="mt-1 text-xs text-muted">
            Four roles. Name: &quot;line&quot; picks Woman / Man / Creature. Two women get different OS voices when more than one exists. Styles change pitch/speed on the same voice.
          </p>
          {now ? <p className="mt-1 text-xs font-medium text-accent">Now · {now}</p> : null}
          <div className="mt-2 space-y-2">
            {ROLES.map((r) => (
              <label key={r.id} className="block text-[10px] uppercase tracking-wide text-subtle">
                {r.label}
                <select
                  className="mt-0.5 h-8 w-full rounded-full bg-raised px-3 text-xs normal-case text-fg"
                  value={voiceByRole[r.id] || ""}
                  onChange={(e) => setVoiceByRole((p) => ({ ...p, [r.id]: e.target.value }))}
                >
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                  {!voices.length ? <option value="">No OS voices</option> : null}
                </select>
                <span className="mt-1 flex flex-wrap gap-1">
                  {VOICE_STYLES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={
                        styleByRole[r.id] === st
                          ? "rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-fg"
                          : "rounded-full bg-raised px-2 py-0.5 text-[10px] text-fg"
                      }
                      onClick={() => setStyleByRole((p) => ({ ...p, [r.id]: st }))}
                    >
                      {st}
                    </button>
                  ))}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-auto">
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
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Hide</Button>
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
