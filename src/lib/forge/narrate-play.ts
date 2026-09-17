/** Browser TTS + Web Audio SFX. Offline. Unfiltered. */
import { type NarrationCue, type SfxKind, type VoiceRole, voiceHint } from "./narrate";

let ctx: AudioContext | null = null;
let stopped = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(ac: AudioContext, seconds: number) {
  const n = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

const BUCKET: Record<string, SfxKind> = {
  spank: "slap", whip: "slap", punch: "boom", impact: "boom",
  wet: "water", squelch: "water", thrust: "door", bed: "door",
  fabric: "fire", cloth: "fire", suck: "moan", gasp: "moan",
  breath: "moan", climax: "scream", growl: "moan", roar: "boom",
  magic: "scream", horse: "steps", birds: "kiss", bells: "kiss",
  whoosh: "wind", heartbeat: "steps", arrow: "steel", chain: "steel",
  stone: "boom", glass: "steel",
};

export function playSfx(kind: SfxKind, gain = 0.22): Promise<void> {
  const ac = audio();
  if (!ac) return Promise.resolve();
  const k = (BUCKET[kind] || kind) as SfxKind;
  const master = ac.createGain();
  master.gain.value = gain;
  master.connect(ac.destination);
  const now = ac.currentTime;
  if (k === "rain" || k === "wind" || k === "crowd" || k === "water") {
    const src = noise(ac, k === "rain" ? 1.3 : 1.0);
    const f = ac.createBiquadFilter();
    f.type = k === "water" ? "lowpass" : "bandpass";
    f.frequency.value = k === "rain" ? 1800 : k === "wind" ? 700 : k === "water" ? 400 : 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(now); src.stop(now + 1.2);
  } else if (k === "thunder" || k === "boom") {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(k === "boom" ? 90 : 70, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.56);
  } else if (k === "steel" || k === "slap") {
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(k === "slap" ? 220 : 1400, now);
    osc.frequency.exponentialRampToValueAtTime(k === "slap" ? 80 : 400, now + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.14);
  } else if (k === "steps" || k === "door") {
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(k === "door" ? 90 : 140, now);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.2);
  } else if (k === "fire") {
    const src = noise(ac, 0.8);
    const f = ac.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(now); src.stop(now + 0.82);
  } else {
    const osc = ac.createOscillator();
    osc.type = "sine";
    const hi = k === "scream";
    osc.frequency.setValueAtTime(hi ? 620 : k === "kiss" ? 380 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(hi ? 880 : 180, now + 0.32);
    const g = ac.createGain();
    g.gain.setValueAtTime(hi ? 0.16 : 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.36);
  }
  return new Promise((res) => setTimeout(res, 220));
}

export type VoiceStyle = "calm" | "hot" | "whisper" | "growl" | "shout";

export const VOICE_STYLES: VoiceStyle[] = ["calm", "hot", "whisper", "growl", "shout"];

export function styleMods(style: VoiceStyle): { rate: number; pitch: number } {
  if (style === "hot") return { rate: 0.9, pitch: 1.08 };
  if (style === "whisper") return { rate: 0.78, pitch: 0.92 };
  if (style === "growl") return { rate: 0.72, pitch: 0.62 };
  if (style === "shout") return { rate: 1.12, pitch: 1.18 };
  return { rate: 0.9, pitch: 1 };
}

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function pickVoice(
  role: VoiceRole,
  voices: SpeechSynthesisVoice[],
  opts?: { uri?: string; speaker?: string },
): SpeechSynthesisVoice | undefined {
  if (opts?.uri) {
    const named = voices.find((v) => v.voiceURI === opts.uri);
    if (named) return named;
  }
  const hint = voiceHint(role);
  const prefer = voices.filter((v) => hint.prefer.test(`${v.name} ${v.voiceURI}`));
  const pool = prefer.length ? prefer : voices;
  if (!pool.length) return undefined;
  if (opts?.speaker) return pool[hashName(opts.speaker) % pool.length];
  if (role === "female") return pool[0];
  if (role === "male" || role === "creature") return pool[pool.length - 1];
  return pool[0];
}

export function stopNarration() {
  stopped = true;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export function speakCue(
  cue: NarrationCue,
  voices: SpeechSynthesisVoice[],
  opts?: {
    voiceByRole?: Partial<Record<VoiceRole, string>>;
    styleByRole?: Partial<Record<VoiceRole, VoiceStyle>>;
  },
): Promise<void> {
  if (cue.kind !== "speak" || typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  const hint = voiceHint(cue.role);
  const st = styleMods(opts?.styleByRole?.[cue.role] || "calm");
  const voice = pickVoice(cue.role, voices, { uri: opts?.voiceByRole?.[cue.role], speaker: cue.speaker });
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(cue.text);
    if (voice) u.voice = voice;
    u.rate = hint.rate * st.rate;
    u.pitch = hint.pitch * st.pitch;
    u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function playNarration(
  cues: NarrationCue[],
  opts: {
    voices: SpeechSynthesisVoice[];
    voiceByRole?: Partial<Record<VoiceRole, string>>;
    styleByRole?: Partial<Record<VoiceRole, VoiceStyle>>;
    narratorURI?: string;
    onCue?: (c: NarrationCue, i: number) => void;
  },
): Promise<void> {
  stopped = false;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  const voiceByRole = { ...(opts.voiceByRole || {}) };
  if (opts.narratorURI && !voiceByRole.narrator) voiceByRole.narrator = opts.narratorURI;
  for (let i = 0; i < cues.length; i++) {
    if (stopped) return;
    const c = cues[i]!;
    opts.onCue?.(c, i);
    if (c.kind === "sfx" && c.sfx) await playSfx(c.sfx);
    else await speakCue(c, opts.voices, { voiceByRole, styleByRole: opts.styleByRole });
  }
}
