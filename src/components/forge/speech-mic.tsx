import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function SpeechEngine(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function SpeechMic({
  onPhrase,
  label = "Speak",
  className,
}: {
  onPhrase: (phrase: string) => void;
  label?: string;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  const recRef = useRef<Rec | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort?.();
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function toggle() {
    const Ctor = SpeechEngine();
    if (!Ctor) {
      toast.error("This browser has no speech. Use Chrome, Edge, or Safari on the phone.");
      return;
    }
    if (on) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      setOn(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (ev) => {
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const row = ev.results[i];
        if (row?.isFinal && row[0]?.transcript) final += `${row[0].transcript} `;
      }
      const phrase = final.replace(/\s+/g, " ").trim();
      if (phrase) onPhrase(phrase);
    };
    rec.onerror = (ev) => {
      setOn(false);
      const err = ev.error || "";
      if (err === "not-allowed") toast.error("Mic blocked — allow microphone for this page.");
      else if (err && err !== "no-speech" && err !== "aborted") toast.error(`Speech: ${err}`);
    };
    rec.onend = () => setOn(false);
    recRef.current = rec;
    try {
      rec.start();
      setOn(true);
    } catch {
      toast.error("Could not start the mic.");
    }
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        on ? "bg-danger text-white" : "bg-raised text-fg hover:bg-accent hover:text-accent-fg",
        className,
      )}
      aria-pressed={on}
      aria-label={on ? "Stop listening" : label}
      title={on ? "Listening — tap to stop" : "Speak into the prompt"}
      onClick={toggle}
    >
      {on ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />}
    </button>
  );
}

export function appendSpoken(cur: string, phrase: string) {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (!p) return cur;
  const c = cur.replace(/\s+/g, " ").trim();
  if (!c) return p;
  return `${c.replace(/[,;:\s]+$/, "")}, ${p}`;
}
